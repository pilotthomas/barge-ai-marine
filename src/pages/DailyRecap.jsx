import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Calendar } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

export default function DailyRecap() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedBarge, setSelectedBarge] = useState('all');
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [generating, setGenerating] = useState(false);

  const { data: dispatches = [] } = useQuery({
    queryKey: ['dispatches'],
    queryFn: () => base44.entities.Dispatch.list(),
  });

  const { data: fuelDockDeliveries = [] } = useQuery({
    queryKey: ['fuel-dock-deliveries'],
    queryFn: () => base44.entities.FuelDockDelivery.list(),
  });

  const { data: loadingEvents = [] } = useQuery({
    queryKey: ['loading-events'],
    queryFn: () => base44.entities.LoadingEvent.list(),
  });

  const { data: storageTankTransactions = [] } = useQuery({
    queryKey: ['storage-tank-transactions'],
    queryFn: () => base44.entities.StorageTankTransaction.list('-transaction_date'),
  });

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  const { data: cargoTypes = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const { data: truckDispatches = [] } = useQuery({
    queryKey: ['truck-dispatches'],
    queryFn: () => base44.entities.TruckDispatch.list(),
  });

  const markets = ['Long Beach', 'Oakland', 'Portland', 'Seattle'];

  const generateRecap = () => {
    const targetDate = selectedDate;

    // Filter deliveries for the selected date
    let dayDeliveries = dispatches.filter(d => 
      d.start_date === targetDate && 
      d.status === 'delivered' &&
      (!d.event_type || d.event_type === 'delivery')
    );

    let dayFuelDock = fuelDockDeliveries.filter(f => 
      f.delivery_date === targetDate && 
      f.status === 'completed'
    );

    let dayLoadings = loadingEvents.filter(l => 
      l.scheduled_date === targetDate && 
      l.status === 'completed'
    );

    // Apply barge filter
    if (selectedBarge !== 'all') {
      dayDeliveries = dayDeliveries.filter(d => d.barge_id === selectedBarge);
      dayLoadings = dayLoadings.filter(l => l.barge_id === selectedBarge);
    }

    // Apply market filter
    if (selectedMarket !== 'all') {
      dayDeliveries = dayDeliveries.filter(d => d.market === selectedMarket);
      dayLoadings = dayLoadings.filter(l => {
        const barge = barges.find(b => b.id === l.barge_id);
        return barge?.market === selectedMarket;
      });
      dayFuelDock = dayFuelDock.filter(f => f.market === selectedMarket);
    }

    const dayTankTransactions = storageTankTransactions.filter(t => 
      t.transaction_date === targetDate
    );

    // Calculate totals by product
    const productTotals = {};

    dayDeliveries.forEach(d => {
      if (d.cargo_type && d.gallons_delivered) {
        productTotals[d.cargo_type] = (productTotals[d.cargo_type] || 0) + d.gallons_delivered;
      }
    });

    dayFuelDock.forEach(f => {
      if (f.cargo_type && f.gallons_delivered) {
        productTotals[f.cargo_type] = (productTotals[f.cargo_type] || 0) + f.gallons_delivered;
      }
    });

    const totalGallons = Object.values(productTotals).reduce((sum, g) => sum + g, 0);
    const totalLoadedGallons = dayLoadings.reduce((sum, l) => sum + (l.gallons_to_load || 0), 0);

    return {
      date: targetDate,
      deliveries: dayDeliveries,
      fuelDockDeliveries: dayFuelDock,
      loadings: dayLoadings,
      tankTransactions: dayTankTransactions,
      productTotals,
      totalGallons,
      totalLoadedGallons
    };
  };

  const downloadWharfageReport = () => {
    setGenerating(true);
    try {
      const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
      const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));
      
      // Filter for Long Beach deliveries in the selected month
      const longBeachDeliveries = dispatches.filter(d => {
        if (d.market !== 'Long Beach') return false;
        if (!d.start_date) return false;
        if (d.status !== 'delivered') return false;
        if (d.event_type && d.event_type !== 'delivery') return false;
        
        const deliveryDate = parseISO(d.start_date);
        return deliveryDate >= monthStart && deliveryDate <= monthEnd;
      });

      // Sort by date
      longBeachDeliveries.sort((a, b) => {
        const dateA = parseISO(a.start_date);
        const dateB = parseISO(b.start_date);
        return dateA - dateB;
      });

      const headers = [
        'DATE',
        'VESSEL NAME',
        'PORT',
        'LOAD/DISCH LOCATION',
        'LOAD/DISCH TIME',
        'SUPPLY SOURCE',
        'GRAD E',
        'M.O.D.',
        'GALLONS',
        'METR C TON',
        'NET BBL'
      ];

      const rows = longBeachDeliveries.map(d => {
        const cargo = cargoTypes.find(c => c.name === d.cargo_type);
        const metricTons = cargo?.metric_tons_per_gallon_conversion 
          ? (d.gallons_delivered * cargo.metric_tons_per_gallon_conversion).toFixed(2)
          : '';
        const netBbl = d.gallons_delivered ? (d.gallons_delivered / 42).toFixed(2) : '';
        
        return [
          format(parseISO(d.start_date), 'M/d/yyyy'),
          d.vessel_name || '',
          'LONG BEACH',
          d.destination || '',
          d.requested_delivery_time || '',
          d.barge_name || '',
          d.cargo_type || '',
          'BARGE',
          d.gallons_delivered || '',
          metricTons,
          netBbl
        ];
      });

      // Calculate totals
      const totalGallons = longBeachDeliveries.reduce((sum, d) => sum + (d.gallons_delivered || 0), 0);
      const totalMetricTons = longBeachDeliveries.reduce((sum, d) => {
        const cargo = cargoTypes.find(c => c.name === d.cargo_type);
        return sum + (cargo?.metric_tons_per_gallon_conversion ? d.gallons_delivered * cargo.metric_tons_per_gallon_conversion : 0);
      }, 0);
      const totalBbl = totalGallons / 42;

      rows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        totalGallons.toFixed(2),
        totalMetricTons.toFixed(2),
        totalBbl.toFixed(2)
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          const cellStr = String(cell);
          return cellStr.includes(',') ? `"${cellStr}"` : cellStr;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Port-of-Long-Beach-Wharfage-Report-${selectedMonth}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate CSV:', error);
      alert('Failed to generate CSV. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadStorageTankCSV = () => {
    setGenerating(true);
    try {
      const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
      const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));
      
      const monthTransactions = storageTankTransactions.filter(t => {
        const txDate = parseISO(t.transaction_date);
        return txDate >= monthStart && txDate <= monthEnd;
      });

      const headers = [
        'Date',
        'Facility',
        'Tank',
        'Product',
        'Type',
        'Gallons',
        'Truck #',
        'BOL #',
        'Driver',
        'Customer/Supplier',
        'Used Carrier',
        'Previous Level',
        'New Level',
        'Notes'
      ];

      const rows = monthTransactions.map(tx => [
        format(parseISO(tx.transaction_date), 'yyyy-MM-dd'),
        tx.facility_name || '',
        tx.tank_number || '',
        tx.product_type || '',
        tx.transaction_type === 'truck_in' ? 'Truck In' : 'Truck Out',
        tx.gallons || 0,
        tx.truck_number || '',
        tx.bol_number || '',
        tx.driver_name || '',
        tx.transaction_type === 'truck_in' ? (tx.supplier || '') : (tx.customer || ''),
        tx.used_carrier ? 'Yes' : 'No',
        tx.previous_gallons || 0,
        tx.new_gallons || 0,
        tx.notes || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          const cellStr = String(cell);
          return cellStr.includes(',') ? `"${cellStr}"` : cellStr;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `storage-tank-transactions-${selectedMonth}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate CSV:', error);
      alert('Failed to generate CSV. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadTruckProductDeliveriesCSV = () => {
    setGenerating(true);
    try {
      const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
      const monthEnd = endOfMonth(parseISO(`${selectedMonth}-01`));
      
      const monthDeliveries = truckDispatches.filter(d => {
        if (!d.dispatch_date) return false;
        const dispatchDate = parseISO(d.dispatch_date);
        return dispatchDate >= monthStart && dispatchDate <= monthEnd && d.status === 'delivered';
      });

      // Sort by date
      monthDeliveries.sort((a, b) => {
        const dateA = parseISO(a.dispatch_date);
        const dateB = parseISO(b.dispatch_date);
        return dateA - dateB;
      });

      const headers = [
        'Date',
        'Market',
        'Customer',
        'Vessel',
        'Product',
        'Brand',
        'Gallons',
        'Truck #',
        'Driver',
        'Truck Type',
        'Delivery Type',
        'SO #',
        'BOL #',
        'Notes'
      ];

      const rows = monthDeliveries.map(d => [
        format(parseISO(d.dispatch_date), 'yyyy-MM-dd'),
        d.market || '',
        d.customer_name || '',
        d.vessel_name || '',
        d.product || '',
        d.brand || '',
        d.gallons || 0,
        d.truck_number || '',
        d.driver_name || '',
        d.truck_type || '',
        d.delivery_type || '',
        d.so_number || '',
        d.bol_number || '',
        d.notes || ''
      ]);

      // Calculate totals by product
      const productTotals = {};
      monthDeliveries.forEach(d => {
        if (d.product && d.gallons) {
          productTotals[d.product] = (productTotals[d.product] || 0) + d.gallons;
        }
      });

      const totalGallons = monthDeliveries.reduce((sum, d) => sum + (d.gallons || 0), 0);

      // Add summary rows
      rows.push([]);
      rows.push(['SUMMARY']);
      rows.push([]);
      rows.push(['Product', '', '', '', '', '', 'Gallons']);
      Object.entries(productTotals).forEach(([product, gallons]) => {
        rows.push([product, '', '', '', '', '', gallons]);
      });
      rows.push([]);
      rows.push(['TOTAL', '', '', '', '', '', totalGallons]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          const cellStr = String(cell);
          return cellStr.includes(',') ? `"${cellStr}"` : cellStr;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `truck-deliveries-by-product-${selectedMonth}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate CSV:', error);
      alert('Failed to generate CSV. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadDailyRecapCSV = () => {
    setGenerating(true);
    try {
      const recap = generateRecap();
      const dateFormatted = format(parseISO(recap.date), 'MMM d, yyyy');

      let csvContent = `Daily Operations Recap - ${dateFormatted}\n\n`;
      
      // Summary
      csvContent += `SUMMARY\n`;
      csvContent += `Total Gallons Delivered,${recap.totalGallons}\n`;
      csvContent += `Number of Deliveries,${recap.deliveries.length + recap.fuelDockDeliveries.length}\n`;
      csvContent += `Total Gallons Loaded,${recap.totalLoadedGallons}\n\n`;

      // Product breakdown
      csvContent += `GALLONS BY PRODUCT\n`;
      csvContent += `Product,Gallons\n`;
      Object.entries(recap.productTotals).forEach(([product, gallons]) => {
        csvContent += `${product || 'Unknown'},${gallons}\n`;
      });
      csvContent += `TOTAL,${recap.totalGallons}\n\n`;

      // Delivery details
      if (recap.deliveries.length + recap.fuelDockDeliveries.length > 0) {
        csvContent += `DELIVERY DETAILS\n`;
        csvContent += `Vessel,Customer,Product,Gallons,Barge/Location\n`;
        
        recap.deliveries.forEach(d => {
          csvContent += `"${d.vessel_name || '-'}","${d.customer || '-'}","${d.cargo_type || '-'}",${d.gallons_delivered || 0},"${d.barge_name || '-'}"\n`;
        });

        recap.fuelDockDeliveries.forEach(f => {
          csvContent += `"${f.vessel_name || '-'}","${f.customer || '-'}","${f.cargo_type || '-'}",${f.gallons_delivered || 0},"Fuel Dock"\n`;
        });
        csvContent += `\n`;
      }

      // Loading events
      if (recap.loadings.length > 0) {
        csvContent += `LOADING EVENTS\n`;
        csvContent += `Barge,Product,Gallons,Terminal\n`;
        recap.loadings.forEach(l => {
          csvContent += `"${l.barge_name || 'Unknown'}","${l.product_type || 'Unknown'}",${l.gallons_to_load || 0},"${l.terminal_location || 'Unknown'}"\n`;
        });
        csvContent += `\n`;
      }

      // Storage Tank Transactions
      if (recap.tankTransactions.length > 0) {
        csvContent += `STORAGE TANK TRANSACTIONS\n`;
        csvContent += `Facility,Tank,Type,Product,Gallons,Truck/BOL,Driver,Supplier/Customer\n`;
        recap.tankTransactions.forEach(t => {
          const truckBol = t.truck_number && t.bol_number ? `${t.truck_number}/${t.bol_number}` : (t.truck_number || t.bol_number || '-');
          const party = t.transaction_type === 'truck_in' ? (t.supplier || '-') : (t.customer || '-');
          csvContent += `"${t.facility_name || 'Unknown'}","${t.tank_number || 'Unknown'}","${t.transaction_type}","${t.product_type || 'Unknown'}",${t.gallons || 0},"${truckBol}","${t.driver_name || '-'}","${party}"\n`;
        });
      }

      // Create and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Daily_Recap_${recap.date}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to generate CSV:', error);
      alert('Failed to generate CSV. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const recap = generateRecap();

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              CSV Exports
            </h1>
            <p className="text-slate-600">Download reports and transaction data</p>
          </div>
        </div>

        {/* Daily Recap Export */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900">Daily Operations Recap</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-4 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="market">Market</Label>
                <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Markets</SelectItem>
                    {markets.map(market => (
                      <SelectItem key={market} value={market}>{market}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="barge">Barge</Label>
                <Select value={selectedBarge} onValueChange={setSelectedBarge}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Barges</SelectItem>
                    {barges.map(barge => (
                      <SelectItem key={barge.id} value={barge.id}>{barge.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={downloadDailyRecapCSV}
                  disabled={generating}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 w-full"
                >
                  <Download className="w-5 h-5 mr-2" />
                  {generating ? 'Generating...' : 'Download'}
                </Button>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Daily summary of deliveries, loadings, and tank transactions
            </p>
          </CardContent>
        </Card>

        {/* Port of Long Beach Wharfage Report */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900">Port of Long Beach Wharfage Report</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="wharfage-month">Month</Label>
                <Input
                  id="wharfage-month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <Button
                onClick={downloadWharfageReport}
                disabled={generating}
                className="bg-gradient-to-r from-green-600 to-green-700"
              >
                <Download className="w-5 h-5 mr-2" />
                {generating ? 'Generating...' : 'Download Report'}
              </Button>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Monthly wharfage report for all Long Beach barge deliveries
            </p>
          </CardContent>
        </Card>

        {/* Truck Product Deliveries Export */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900">Truck Product Deliveries</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="truck-month">Month</Label>
                <Input
                  id="truck-month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <Button
                onClick={downloadTruckProductDeliveriesCSV}
                disabled={generating}
                className="bg-gradient-to-r from-orange-600 to-orange-700"
              >
                <Download className="w-5 h-5 mr-2" />
                {generating ? 'Generating...' : 'Download Report'}
              </Button>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Monthly report of all truck deliveries by product
            </p>
          </CardContent>
        </Card>

        {/* Storage Tank Transactions Export */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900">Storage Tank Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="month">Month</Label>
                <Input
                  id="month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <Button
                onClick={downloadStorageTankCSV}
                disabled={generating}
                className="bg-gradient-to-r from-purple-600 to-purple-700"
              >
                <Download className="w-5 h-5 mr-2" />
                {generating ? 'Generating...' : 'Download Transactions'}
              </Button>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Monthly report of all truck in/out movements
            </p>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900">
              Preview: {format(parseISO(recap.date), 'EEEE, MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
                <div className="text-sm text-green-700 font-semibold mb-2">Total Delivered</div>
                <div className="text-4xl font-bold text-green-900">{recap.totalGallons.toLocaleString()}</div>
                <div className="text-sm text-green-600">gallons</div>
              </div>
              <div className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border-2 border-orange-200">
                <div className="text-sm text-orange-700 font-semibold mb-2">Deliveries</div>
                <div className="text-4xl font-bold text-orange-900">{recap.deliveries.length + recap.fuelDockDeliveries.length}</div>
                <div className="text-sm text-orange-600">completed</div>
              </div>
              <div className="p-6 bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg border-2 border-purple-200">
                <div className="text-sm text-purple-700 font-semibold mb-2">Loaded</div>
                <div className="text-4xl font-bold text-purple-900">{recap.totalLoadedGallons.toLocaleString()}</div>
                <div className="text-sm text-purple-600">gallons</div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Gallons by Product</h3>
              <div className="space-y-2">
                {Object.entries(recap.productTotals).map(([product, gallons]) => (
                  <div key={product} className="flex justify-between items-center p-3 bg-slate-50 rounded border border-slate-200">
                    <span className="font-medium text-slate-900">{product}</span>
                    <span className="font-bold text-blue-600">{gallons.toLocaleString()} gal</span>
                  </div>
                ))}
                <div className="flex justify-between items-center p-4 bg-blue-50 rounded border-2 border-blue-300">
                  <span className="font-bold text-slate-900 text-lg">TOTAL</span>
                  <span className="font-bold text-blue-600 text-xl">{recap.totalGallons.toLocaleString()} gal</span>
                </div>
              </div>
            </div>

            {recap.deliveries.length + recap.fuelDockDeliveries.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">
                  Deliveries ({recap.deliveries.length + recap.fuelDockDeliveries.length})
                </h3>
                <div className="space-y-2">
                  {recap.deliveries.map((d, idx) => (
                    <div key={idx} className="p-3 bg-white rounded border border-slate-200">
                      <div className="font-semibold text-slate-900">{d.vessel_name}</div>
                      <div className="text-sm text-slate-600 mt-1">
                        {d.cargo_type} • {(d.gallons_delivered || 0).toLocaleString()} gal • {d.barge_name}
                      </div>
                    </div>
                  ))}
                  {recap.fuelDockDeliveries.map((f, idx) => (
                    <div key={`fd-${idx}`} className="p-3 bg-white rounded border border-slate-200">
                      <div className="font-semibold text-slate-900">{f.vessel_name}</div>
                      <div className="text-sm text-slate-600 mt-1">
                        {f.cargo_type} • {(f.gallons_delivered || 0).toLocaleString()} gal • Fuel Dock
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}