import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileDown, Ship, Calendar } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from "date-fns";

export default function MonthlyBargeReport() {
  const [selectedBarge, setSelectedBarge] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  const { data: dispatches = [] } = useQuery({
    queryKey: ['dispatches'],
    queryFn: () => base44.entities.Dispatch.list(),
  });

  const { data: loadingEvents = [] } = useQuery({
    queryKey: ['loading-events'],
    queryFn: () => base44.entities.LoadingEvent.list(),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['barge-inventory'],
    queryFn: () => base44.entities.BargeInventory.list(),
  });

  const { data: transfers = [] } = useQuery({
    queryKey: ['barge-transfers'],
    queryFn: () => base44.entities.BargeTransfer.list(),
  });

  const { data: cargoTypes = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const { data: monthlySnapshots = [] } = useQuery({
    queryKey: ['monthly-snapshots'],
    queryFn: () => base44.entities.MonthlyInventorySnapshot.list(),
  });

  // Generate report data
  const generateReportData = () => {
    if (!selectedBarge || !selectedMonth) return null;

    const barge = barges.find(b => b.id === selectedBarge);
    if (!barge) return null;

    const monthStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const monthEnd = endOfMonth(monthStart);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get initial inventory for the month
    const bargeInventory = inventory.filter(i => i.barge_id === selectedBarge);
    
    // Get all transactions for this barge and month
    const monthDeliveries = dispatches.filter(d => {
      if (d.barge_id !== selectedBarge) return false;
      if (!d.start_date) return false;
      const deliveryDate = parseISO(d.start_date);
      return isWithinInterval(deliveryDate, { start: monthStart, end: monthEnd });
    }).sort((a, b) => a.start_date.localeCompare(b.start_date));

    const monthLoadings = loadingEvents.filter(l => {
      if (l.barge_id !== selectedBarge) return false;
      if (!l.scheduled_date) return false;
      const loadDate = parseISO(l.scheduled_date);
      return isWithinInterval(loadDate, { start: monthStart, end: monthEnd });
    }).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

    const monthTransfers = transfers.filter(t => {
      if ((t.from_barge_id !== selectedBarge && t.to_barge_id !== selectedBarge)) return false;
      if (!t.transfer_date) return false;
      const transferDate = parseISO(t.transfer_date);
      return isWithinInterval(transferDate, { start: monthStart, end: monthEnd });
    }).sort((a, b) => a.transfer_date.localeCompare(b.transfer_date));

    // Build product-wise inventory tracking
    const productTypes = [...new Set([
      ...monthDeliveries.map(d => d.cargo_type).filter(Boolean),
      ...monthLoadings.map(l => l.product_type).filter(Boolean),
      ...bargeInventory.map(i => i.product_type).filter(Boolean)
    ])];

    // Calculate beginning inventory per product from monthly snapshots
    const beginningInventory = {};
    productTypes.forEach(product => {
      // Look for snapshot for this barge, product, and month
      const snapshot = monthlySnapshots.find(s => 
        s.barge_id === selectedBarge && 
        s.product_type === product && 
        s.month_year === selectedMonth
      );
      
      if (snapshot) {
        beginningInventory[product] = snapshot.beginning_inventory || 0;
      } else {
        // Fallback to current tank levels if no snapshot exists
        const tanks = bargeInventory.filter(i => i.product_type === product);
        beginningInventory[product] = tanks.reduce((sum, t) => sum + (t.current_gallons || 0), 0);
      }
    });

    return {
      barge,
      monthStart,
      monthEnd,
      daysInMonth,
      deliveries: monthDeliveries,
      loadings: monthLoadings,
      transfers: monthTransfers,
      productTypes,
      beginningInventory
    };
  };

  const exportToExcel = () => {
    const reportData = generateReportData();
    if (!reportData) return;

    const { barge, monthStart, monthEnd, daysInMonth, deliveries, loadings, transfers, productTypes, beginningInventory } = reportData;

    // Create CSV content
    let csv = `Monthly Barge Report - ${barge.name}\n`;
    csv += `Month: ${format(monthStart, 'MMMM yyyy')}\n\n`;

    // Summary Section
    csv += `SUMMARY\n`;
    csv += `Total Deliveries:,${deliveries.length}\n`;
    csv += `Total Loadings:,${loadings.length}\n`;
    csv += `Total Transfers:,${transfers.length}\n`;
    csv += `Total Gallons Delivered:,${deliveries.reduce((sum, d) => sum + (d.gallons_delivered || 0), 0)}\n`;
    csv += `Total Gallons Loaded:,${loadings.reduce((sum, l) => sum + (l.gallons_to_load || 0), 0)}\n\n`;

    // Beginning Inventory
    csv += `BEGINNING INVENTORY\n`;
    csv += `Product,Gallons\n`;
    productTypes.forEach(product => {
      csv += `${product},${beginningInventory[product]}\n`;
    });
    csv += `\n`;

    // Daily Transactions
    csv += `DAILY TRANSACTIONS\n`;
    csv += `Date,Type,Product,Vessel/Terminal,Gallons,Status,Notes\n`;

    daysInMonth.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      
      // Deliveries on this day
      const dayDeliveries = deliveries.filter(d => d.start_date === dateStr);
      dayDeliveries.forEach(d => {
        csv += `${format(day, 'MMM d')},Delivery,${d.cargo_type || ''},${d.vessel_name},${-(d.gallons_delivered || 0)},${d.status || ''},"${(d.notes || '').replace(/"/g, '""')}"\n`;
      });

      // Loadings on this day
      const dayLoadings = loadings.filter(l => l.scheduled_date === dateStr);
      dayLoadings.forEach(l => {
        csv += `${format(day, 'MMM d')},Loading,${l.product_type || ''},${l.terminal_location},${l.gallons_to_load || 0},${l.status || ''},"${(l.notes || '').replace(/"/g, '""')}"\n`;
      });

      // Transfers on this day
      const dayTransfers = transfers.filter(t => t.transfer_date === dateStr);
      dayTransfers.forEach(t => {
        const isSource = t.from_barge_id === selectedBarge;
        const isDestination = t.to_barge_id === selectedBarge;
        
        // Handle blending (same barge transfer)
        if (t.is_blend && isSource && isDestination) {
          // Show product going out (being converted)
          csv += `${format(day, 'MMM d')},Blend Out,${t.product_type || ''},Self (Blending),${-(t.gallons_transferred || 0)},Completed,"${(t.notes || '').replace(/"/g, '""')}"\n`;
          // Show product coming in (converted to)
          csv += `${format(day, 'MMM d')},Blend In,${t.resulting_product_type || ''},Self (Blending),${t.gallons_transferred || 0},Completed,"${(t.notes || '').replace(/"/g, '""')}"\n`;
        } else {
          // Regular transfer between barges
          const gallons = isSource ? -(t.gallons_transferred || 0) : (t.gallons_transferred || 0);
          const otherBarge = isSource ? t.to_barge_name : t.from_barge_name;
          csv += `${format(day, 'MMM d')},Transfer,${t.product_type || ''},${isSource ? 'To' : 'From'} ${otherBarge},${gallons},Completed,"${(t.notes || '').replace(/"/g, '""')}"\n`;
        }
      });
    });

    csv += `\n`;

    // Port of Long Beach Wharfage Report (only for Global Long Beach and Global Portland)
    if (barge.name === 'GLOBAL LONG BEACH' || barge.name === 'GLOBAL PORTLAND') {
      csv += `PORT OF LONG BEACH WHARFAGE REPORT\n`;
      csv += `Date,Vessel Name,Supply Source,Product,Gallons\n`;
      
      // Get ALL fuel deliveries from Global Long Beach and Global Portland for this month
      const wharfageDeliveries = dispatches.filter(d => {
        if (d.status !== 'delivered') return false;
        if (!d.start_date) return false;
        
        // Check if delivery is in the selected month
        const deliveryDate = parseISO(d.start_date);
        if (!isWithinInterval(deliveryDate, { start: monthStart, end: monthEnd })) return false;
        
        // Only include Global Long Beach and Global Portland barges
        const deliveryBarge = barges.find(b => b.id === d.barge_id);
        if (!deliveryBarge || (deliveryBarge.name !== 'GLOBAL LONG BEACH' && deliveryBarge.name !== 'GLOBAL PORTLAND')) return false;
        
        // Only include fuel deliveries (not lubricants)
        const cargo = cargoTypes.find(c => c.name === d.cargo_type);
        return cargo?.category === 'Fuel';
      }).sort((a, b) => a.start_date.localeCompare(b.start_date));
      
      wharfageDeliveries.forEach(d => {
        const deliveryBarge = barges.find(b => b.id === d.barge_id);
        csv += `${format(parseISO(d.start_date), 'MMM d, yyyy')},${d.vessel_name || ''},${deliveryBarge?.name || ''},${d.cargo_type || ''},${d.gallons_delivered || 0}\n`;
      });
      
      const totalWharfageGallons = wharfageDeliveries.reduce((sum, d) => sum + (d.gallons_delivered || 0), 0);
      
      csv += `\nTotal Wharfage Gallons:,${totalWharfageGallons}\n\n`;
    }

    // Inventory Flow by Product
    csv += `INVENTORY FLOW BY PRODUCT\n`;
    productTypes.forEach(product => {
      csv += `\nProduct: ${product}\n`;
      csv += `Date,Beginning,Loaded,Delivered,Transfers In,Transfers Out,Ending\n`;

      let runningBalance = beginningInventory[product];
      
      daysInMonth.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayBeginning = runningBalance;

        // Only count COMPLETED loadings
        const loaded = loadings
          .filter(l => l.scheduled_date === dateStr && l.product_type === product && l.status === 'completed')
          .reduce((sum, l) => sum + (l.gallons_to_load || 0), 0);

        // Only count DELIVERED dispatches
        const delivered = deliveries
          .filter(d => d.start_date === dateStr && d.cargo_type === product && d.status === 'delivered')
          .reduce((sum, d) => sum + (d.gallons_delivered || 0), 0);

        const dayTransfers = transfers.filter(t => t.transfer_date === dateStr);

        // Transfers IN: receiving from another barge OR gaining product from blending
        const transfersIn = dayTransfers
          .filter(t => {
            // Regular transfer to this barge
            if (t.to_barge_id === selectedBarge && !t.is_blend && t.product_type === product) return true;
            // Blend resulting in this product (on same barge)
            if (t.is_blend && t.to_barge_id === selectedBarge && t.from_barge_id === selectedBarge && t.resulting_product_type === product) return true;
            return false;
          })
          .reduce((sum, t) => sum + (t.gallons_transferred || 0), 0);

        // Transfers OUT: sending to another barge OR losing product from blending
        const transfersOut = dayTransfers
          .filter(t => t.from_barge_id === selectedBarge && t.product_type === product)
          .reduce((sum, t) => sum + (t.gallons_transferred || 0), 0);

        runningBalance = dayBeginning + loaded - delivered + transfersIn - transfersOut;

        if (loaded > 0 || delivered > 0 || transfersIn > 0 || transfersOut > 0) {
          csv += `${format(day, 'MMM d')},${dayBeginning},${loaded},${delivered},${transfersIn},${transfersOut},${runningBalance}\n`;
        }
      });
    });

    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${barge.name}_${format(monthStart, 'yyyy-MM')}_Report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reportData = generateReportData();

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Monthly Barge Report
            </h1>
            <p className="text-slate-600">Export detailed transaction and inventory flow reports</p>
          </div>
        </div>

        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900">Report Parameters</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="barge">Select Barge *</Label>
                <Select value={selectedBarge} onValueChange={setSelectedBarge}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose barge" />
                  </SelectTrigger>
                  <SelectContent>
                    {barges.map((barge) => (
                      <SelectItem key={barge.id} value={barge.id}>
                        {barge.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="month">Select Month *</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const date = new Date();
                      date.setMonth(date.getMonth() - i);
                      const value = format(date, 'yyyy-MM');
                      return (
                        <SelectItem key={value} value={value}>
                          {format(date, 'MMMM yyyy')}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={exportToExcel}
                  disabled={!selectedBarge || !selectedMonth}
                  className="bg-gradient-to-r from-green-600 to-green-700 w-full"
                >
                  <FileDown className="w-5 h-5 mr-2" />
                  Export to Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {reportData && (
          <>
            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-slate-900">
                    {reportData.barge.name} - {format(reportData.monthStart, 'MMMM yyyy')}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm text-slate-600 mb-1">Total Deliveries</div>
                    <div className="text-2xl font-bold text-slate-900">{reportData.deliveries.length}</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-sm text-slate-600 mb-1">Total Loadings</div>
                    <div className="text-2xl font-bold text-slate-900">{reportData.loadings.length}</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-sm text-slate-600 mb-1">Gallons Delivered</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {reportData.deliveries.reduce((sum, d) => sum + (d.gallons_delivered || 0), 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="text-sm text-slate-600 mb-1">Gallons Loaded</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {reportData.loadings.reduce((sum, l) => sum + (l.gallons_to_load || 0), 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-900">Beginning Inventory</h3>
                  <div className="grid md:grid-cols-3 gap-3">
                    {reportData.productTypes.map(product => (
                      <div key={product} className="p-3 bg-slate-50 rounded border border-slate-200">
                        <div className="text-sm text-slate-600">{product}</div>
                        <div className="text-lg font-bold text-slate-900">
                          {reportData.beginningInventory[product].toLocaleString()} gal
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-3">Transactions Summary</h3>
                  <div className="text-sm text-slate-600">
                    <p>• {reportData.deliveries.length} deliveries</p>
                    <p>• {reportData.loadings.length} loading events</p>
                    <p>• {reportData.transfers.length} transfers</p>
                    <p className="mt-2 text-blue-600">Click "Export to Excel" to download the complete detailed report with daily inventory flow.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}