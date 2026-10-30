import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ship, Droplets, TrendingUp, AlertTriangle, Clock, CheckCircle, Package, Wrench, Anchor, Truck, Warehouse } from "lucide-react";
import { differenceInDays, format, parseISO, subDays } from "date-fns";
import { Badge } from "@/components/ui/badge";

import MetricCard from "../components/dashboard/MetricCard";
import { useRegion } from "@/lib/RegionContext";
import { regionForLocation } from "@/lib/regions";

const SUB_REGION_TO_REGION = { SoCal: 'California', NorCal: 'California', PNW: 'PNW', 'MS River': 'Marine East', 'Gulf Coast': 'Marine East' };

export default function Dashboard() {
  const { region, isAllRegions, regionLabel } = useRegion();
  const showSub = (sub) => isAllRegions || SUB_REGION_TO_REGION[sub] === region;
  const inRegion = (market) => isAllRegions || regionForLocation(market) === region;
  const { data: deliveries = [] } = useQuery({
    queryKey: ['dispatches'],
    queryFn: () => base44.entities.Dispatch.list('-created_date'),
  });

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  const { data: tugs = [] } = useQuery({
    queryKey: ['tugs'],
    queryFn: () => base44.entities.Tug.list(),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['barge-inventory'],
    queryFn: () => base44.entities.BargeInventory.list(),
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => base44.entities.SalesOrder.list('-submitted_date'),
  });

  const { data: maintenanceTasks = [] } = useQuery({
    queryKey: ['maintenance-tasks'],
    queryFn: () => base44.entities.MaintenanceTask.list(),
  });

  const { data: truckDispatches = [] } = useQuery({
    queryKey: ['truck-dispatches'],
    queryFn: () => base44.entities.TruckDispatch.list('-created_date'),
  });

  const { data: fuelDockDeliveries = [] } = useQuery({
    queryKey: ['fuel-dock-deliveries'],
    queryFn: () => base44.entities.FuelDockDelivery.list('-created_date'),
  });

  const { data: trucks = [] } = useQuery({
    queryKey: ['trucks'],
    queryFn: () => base44.entities.Truck.list(),
  });

  const { data: trailers = [] } = useQuery({
    queryKey: ['trailers'],
    queryFn: () => base44.entities.Trailer.list(),
  });

  const { data: retailFuelDockDaily = [] } = useQuery({
    queryKey: ['retail-fuel-dock-daily'],
    queryFn: () => base44.entities.RetailFuelDockDaily.list(),
  });

  // Calculate gallons delivered over different time periods
  const today = new Date();
  const calculateGallonsForPeriod = (days, dataSource, dateField = 'start_date') => {
    const startDate = subDays(today, days);
    return dataSource
      .filter(d => {
        if (d.status !== 'delivered' && d.status !== 'completed') return false;
        if (!d[dateField] || !d.gallons_delivered && !d.gallons) return false;
        try {
          const deliveryDate = parseISO(d[dateField]);
          return deliveryDate >= startDate && deliveryDate <= today;
        } catch (e) {
          return false;
        }
      })
      .reduce((sum, d) => sum + (d.gallons_delivered || d.gallons || 0), 0);
  };

  // Calculate month to date gallons for retail fuel dock
  const calculateRetailFuelDockMTD = () => {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return retailFuelDockDaily
      .filter(d => {
        if (!d.date || !d.gallons) return false;
        try {
          const entryDate = parseISO(d.date);
          return entryDate >= startOfMonth && entryDate <= today;
        } catch (e) {
          return false;
        }
      })
      .reduce((sum, d) => sum + (d.gallons || 0), 0);
  };

  // Calculate month to date by region
  const calculateMTDByRegion = () => {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Region mappings
    const regionMap = {
      marine: {
        'SoCal': ['Long Beach'],
        'NorCal': ['Oakland'],
        'PNW': ['Seattle', 'Portland'],
        'MS River': ['Wood River', 'St. Louis', 'Wycliffe', 'Memphis', 'Baton Rouge'],
        'Gulf Coast': ['Mobile']
      },
      trucking: {
        'SoCal': ['Rancho Dominguez'],
        'NorCal': ['Richmond CA'],
        'PNW': ['Seattle'],
        'Gulf Coast': ['Mobile']
      },
      retailFuelDock: {
        'SoCal': ['Huntington Beach', 'Berth 258 - Long Beach'],
        'NorCal': ['San Francisco Pier 45'],
        'PNW': [],
        'Gulf Coast': ['Mobile Fuel Dock']
      }
    };

    const result = {
      marine: {},
      trucking: {},
      retailFuelDock: {}
    };

    // Calculate marine by region
    Object.entries(regionMap.marine).forEach(([region, markets]) => {
      result.marine[region] = marineDeliveries
        .filter(d => {
          if (!markets.includes(d.market)) return false;
          if (d.status !== 'delivered') return false;
          if (!d.start_date || !d.gallons_delivered) return false;
          try {
            const deliveryDate = parseISO(d.start_date);
            return deliveryDate >= startOfMonth && deliveryDate <= today;
          } catch (e) {
            return false;
          }
        })
        .reduce((sum, d) => sum + (d.gallons_delivered || 0), 0);
    });

    // Calculate trucking by region
    Object.entries(regionMap.trucking).forEach(([region, markets]) => {
      result.trucking[region] = truckDispatches
        .filter(d => {
          if (!markets.includes(d.market)) return false;
          if (d.status !== 'delivered') return false;
          if (!d.dispatch_date || !d.gallons) return false;
          try {
            const dispatchDate = parseISO(d.dispatch_date);
            return dispatchDate >= startOfMonth && dispatchDate <= today;
          } catch (e) {
            return false;
          }
        })
        .reduce((sum, d) => sum + (d.gallons || 0), 0);
    });

    // Calculate fuel docks (retail + commercial) by region
    Object.entries(regionMap.retailFuelDock).forEach(([region, facilities]) => {
      // Retail fuel dock daily gallons
      const retailGallons = retailFuelDockDaily
        .filter(d => {
          if (!facilities.includes(d.facility)) return false;
          if (!d.date || !d.gallons) return false;
          try {
            const entryDate = parseISO(d.date);
            return entryDate >= startOfMonth && entryDate <= today;
          } catch (e) {
            return false;
          }
        })
        .reduce((sum, d) => sum + (d.gallons || 0), 0);

      // Commercial fuel dock deliveries by matching markets
      const commercialGallons = fuelDockDeliveries
        .filter(d => {
          const marketToRegion = {
            'Long Beach': 'SoCal',
            'Oakland': 'NorCal',
            'Seattle': 'PNW',
            'Portland': 'PNW'
          };
          if (marketToRegion[d.market] !== region) return false;
          if (d.status !== 'completed') return false;
          if (!d.delivery_date || !d.gallons_delivered) return false;
          try {
            const deliveryDate = parseISO(d.delivery_date);
            return deliveryDate >= startOfMonth && deliveryDate <= today;
          } catch (e) {
            return false;
          }
        })
        .reduce((sum, d) => sum + (d.gallons_delivered || 0), 0);

      result.retailFuelDock[region] = retailGallons + commercialGallons;
    });

    return result;
  };

  // Marine (Barge) deliveries - only actual deliveries (not maintenance, etc.)
  const marineDeliveries = deliveries.filter(d => !d.event_type || d.event_type === 'delivery');
  const marineGallons7Days = calculateGallonsForPeriod(7, marineDeliveries);
  const marineGallons30Days = calculateGallonsForPeriod(30, marineDeliveries);
  const marineGallons90Days = calculateGallonsForPeriod(90, marineDeliveries);

  // Trucking deliveries
  const truckGallons7Days = calculateGallonsForPeriod(7, truckDispatches, 'dispatch_date');
  const truckGallons30Days = calculateGallonsForPeriod(30, truckDispatches, 'dispatch_date');
  const truckGallons90Days = calculateGallonsForPeriod(90, truckDispatches, 'dispatch_date');

  // Fuel Dock deliveries
  const fuelDockGallons7Days = calculateGallonsForPeriod(7, fuelDockDeliveries, 'delivery_date');
  const fuelDockGallons30Days = calculateGallonsForPeriod(30, fuelDockDeliveries, 'delivery_date');
  const fuelDockGallons90Days = calculateGallonsForPeriod(90, fuelDockDeliveries, 'delivery_date');

  // Calculate month to date totals by region
  const mtdByRegion = calculateMTDByRegion();

  // Calculate available barges and tugs (not in maintenance/retired)
  const availableBarges = barges.filter(b => b.status === 'available' || b.status === 'dispatched').length;
  const availableTugs = tugs.filter(t => t.status === 'available' || t.status === 'assigned').length;
  const availableTrucks = trucks.filter(t => t.status === 'available' || t.status === 'dispatched').length;
  const availableTrailers = trailers.filter(t => t.status === 'available' || t.status === 'dispatched').length;
  const trucksDown = trucks.filter(t => t.status === 'maintenance').length;

  // Calculate vessels currently down for maintenance
  const vesselsDown = maintenanceTasks.filter(task => {
    if (task.status === 'completed') return false;
    if (task.task_type !== 'Drydock Schedule') return false;
    if (!task.drydock_out_of_water_date || !task.drydock_back_in_water_date) return false;

    try {
      const outDate = parseISO(task.drydock_out_of_water_date);
      const backDate = parseISO(task.drydock_back_in_water_date);
      return today >= outDate && today <= backDate;
    } catch (e) {
      return false;
    }
  });

  // Get pending sales orders by market - separate by delivery method
  const pendingOrders = salesOrders.filter(o => o.status === 'pending');
  const allMarineMarkets = ['Long Beach', 'Oakland', 'Portland', 'Seattle', 'Wood River', 'St. Louis', 'Wycliffe', 'Memphis', 'Baton Rouge', 'Mobile'].filter(inRegion);
  const ordersByMarketAndMethod = Object.fromEntries(
    allMarineMarkets.map(market => [market, {
      barge: pendingOrders.filter(o => o.market === market && o.method_of_delivery === 'Barge').length,
      truck: pendingOrders.filter(o => o.market === market && o.method_of_delivery === 'Truck').length,
      xpipe: pendingOrders.filter(o => o.market === market && o.method_of_delivery === 'X-Pipe').length,
    }])
  );

  // Trucking markets from TruckDispatch (different from marine markets)
  const truckingMarketDefs = [
    { label: 'Richmond CA', market: 'Richmond CA' },
    { label: 'Rancho Dominguez', market: 'Rancho Dominguez' },
    { label: 'Seattle (Trucking)', market: 'Seattle' },
    { label: 'Mobile', market: 'Mobile' },
  ].filter(def => inRegion(def.market));
  const truckingOrdersByMarket = Object.fromEntries(
    truckingMarketDefs.map(def => [def.label, pendingOrders.filter(o => o.market === def.market && o.method_of_delivery === 'Truck').length])
  );

  // Get orders waiting to be closed out (scheduled or in_transit) - exclude non-delivery events
  const bargeOrdersAwaitingCloseout = deliveries.filter(d => 
    (d.status === 'scheduled' || d.status === 'in_transit') && 
    (!d.event_type || d.event_type === 'delivery') // Only include actual deliveries
  );

  const truckOrdersAwaitingCloseout = truckDispatches.filter(d => 
    d.status === 'scheduled' || d.status === 'in_transit'
  );

  const fuelDockOrdersAwaitingCloseout = fuelDockDeliveries.filter(d => 
    d.status === 'scheduled' || d.status === 'in_progress'
  );

  // Loading needs calculation
  const getBargeCurrentInventoryByProduct = (bargeId, productType) => {
    const bargeTanks = inventory.filter(t => t.barge_id === bargeId && t.product_type === productType);
    return bargeTanks.reduce((sum, tank) => sum + (tank.current_gallons || 0), 0);
  };

  const getUpcomingDeliveries = (bargeId) => {
    const today = new Date();
    return deliveries.filter(d => 
      d.barge_id === bargeId && 
      (d.status === 'scheduled' || d.status === 'in_transit') &&
      new Date(d.start_date) >= today
    ).sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  };

  const loadingNeeds = barges.map(barge => {
    const upcomingDeliveries = getUpcomingDeliveries(barge.id);
    const nextDelivery = upcomingDeliveries[0];
    
    let needsLoading = false;
    let gallonsNeeded = 0;
    let urgency = 'ok';
    let daysUntilDelivery = 0;
    let productType = '';
    
    if (nextDelivery && nextDelivery.gallons_delivered && nextDelivery.start_date && nextDelivery.cargo_type) {
      try {
        productType = nextDelivery.cargo_type;
        const currentInventoryOfProduct = getBargeCurrentInventoryByProduct(barge.id, productType);
        gallonsNeeded = nextDelivery.gallons_delivered - currentInventoryOfProduct;
        needsLoading = gallonsNeeded > 0;
        
        daysUntilDelivery = differenceInDays(new Date(nextDelivery.start_date), new Date());
        if (needsLoading) {
          if (daysUntilDelivery <= 2) {
            urgency = 'critical';
          } else if (daysUntilDelivery <= 5) {
            urgency = 'warning';
          }
        }
      } catch (e) {
        console.error('Error calculating loading needs for barge:', barge.name, e);
      }
    }
    
    return {
      barge,
      currentInventory: nextDelivery ? getBargeCurrentInventoryByProduct(barge.id, nextDelivery.cargo_type || '') : 0,
      productType,
      nextDelivery,
      needsLoading,
      gallonsNeeded: Math.max(0, gallonsNeeded),
      urgency,
      daysUntilDelivery
    };
  }).filter(n => n.needsLoading && (n.urgency === 'critical' || n.urgency === 'warning'));

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
            Delivery Command Center
          </h1>
          <p className="text-sm md:text-base text-slate-600">Real-time operational overview and alerts · {regionLabel}</p>
        </div>

        {/* Month to Date Regional Totals */}
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              {format(today, 'MMMM yyyy')} Month to Date by Region
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-5 gap-6 items-stretch">
              {/* SoCal */}
              {showSub('SoCal') && (
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">SoCal</h3>
                <div className="flex flex-col gap-3 flex-1">
                  <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Ship className="w-4 h-4 text-sky-600" />
                      <div className="text-xs text-slate-600">Marine (Long Beach)</div>
                    </div>
                    <div className="text-xl font-bold text-sky-600">{mtdByRegion.marine['SoCal']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="w-4 h-4 text-orange-600" />
                      <div className="text-xs text-slate-600">Trucking (Rancho Dominguez)</div>
                    </div>
                    <div className="text-xl font-bold text-orange-600">{mtdByRegion.trucking['SoCal']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Warehouse className="w-4 h-4 text-purple-600" />
                      <div className="text-xs text-slate-600">Fuel Docks</div>
                    </div>
                    <div className="text-xl font-bold text-purple-600">{mtdByRegion.retailFuelDock['SoCal']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100 border-2 border-slate-300 mt-auto">
                    <div className="text-xs text-slate-600 mb-1">Total SoCal</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {((mtdByRegion.marine['SoCal'] || 0) + (mtdByRegion.trucking['SoCal'] || 0) + (mtdByRegion.retailFuelDock['SoCal'] || 0)).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                </div>
              </div>
              )}

              {/* NorCal */}
              {showSub('NorCal') && (
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">NorCal</h3>
                <div className="flex flex-col gap-3 flex-1">
                  <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Ship className="w-4 h-4 text-sky-600" />
                      <div className="text-xs text-slate-600">Marine (Oakland)</div>
                    </div>
                    <div className="text-xl font-bold text-sky-600">{mtdByRegion.marine['NorCal']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="w-4 h-4 text-orange-600" />
                      <div className="text-xs text-slate-600">Trucking (Richmond)</div>
                    </div>
                    <div className="text-xl font-bold text-orange-600">{mtdByRegion.trucking['NorCal']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Warehouse className="w-4 h-4 text-purple-600" />
                      <div className="text-xs text-slate-600">Fuel Docks</div>
                    </div>
                    <div className="text-xl font-bold text-purple-600">{mtdByRegion.retailFuelDock['NorCal']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100 border-2 border-slate-300 mt-auto">
                    <div className="text-xs text-slate-600 mb-1">Total NorCal</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {((mtdByRegion.marine['NorCal'] || 0) + (mtdByRegion.trucking['NorCal'] || 0) + (mtdByRegion.retailFuelDock['NorCal'] || 0)).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                </div>
              </div>
              )}

              {/* PNW */}
              {showSub('PNW') && (
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">PNW</h3>
                <div className="flex flex-col gap-3 flex-1">
                  <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Ship className="w-4 h-4 text-sky-600" />
                      <div className="text-xs text-slate-600">Marine (Seattle, Portland)</div>
                    </div>
                    <div className="text-xl font-bold text-sky-600">{mtdByRegion.marine['PNW']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="w-4 h-4 text-orange-600" />
                      <div className="text-xs text-slate-600">Trucking (Seattle)</div>
                    </div>
                    <div className="text-xl font-bold text-orange-600">{mtdByRegion.trucking['PNW']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Warehouse className="w-4 h-4 text-purple-600" />
                      <div className="text-xs text-slate-600">Fuel Docks</div>
                    </div>
                    <div className="text-xl font-bold text-purple-600">{mtdByRegion.retailFuelDock['PNW']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100 border-2 border-slate-300 mt-auto">
                    <div className="text-xs text-slate-600 mb-1">Total PNW</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {((mtdByRegion.marine['PNW'] || 0) + (mtdByRegion.trucking['PNW'] || 0) + (mtdByRegion.retailFuelDock['PNW'] || 0)).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                </div>
              </div>
              )}

              {/* Mississippi River */}
              {showSub('MS River') && (
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">Mississippi River</h3>
                <div className="flex flex-col gap-3 flex-1">
                  <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Ship className="w-4 h-4 text-sky-600" />
                      <div className="text-xs text-slate-600">Marine (Mississippi)</div>
                    </div>
                    <div className="text-xl font-bold text-sky-600">{mtdByRegion.marine['MS River']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-50 border border-orange-200 opacity-40">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="w-4 h-4 text-orange-600" />
                      <div className="text-xs text-slate-600">Trucking</div>
                    </div>
                    <div className="text-xl font-bold text-orange-600">—</div>
                    <div className="text-xs text-slate-500">N/A</div>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 opacity-40">
                    <div className="flex items-center gap-2 mb-1">
                      <Warehouse className="w-4 h-4 text-purple-600" />
                      <div className="text-xs text-slate-600">Fuel Docks</div>
                    </div>
                    <div className="text-xl font-bold text-purple-600">—</div>
                    <div className="text-xs text-slate-500">N/A</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100 border-2 border-slate-300 mt-auto">
                    <div className="text-xs text-slate-600 mb-1">Total MS River</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {(mtdByRegion.marine['MS River'] || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                </div>
              </div>
              )}

              {/* Gulf Coast */}
              {showSub('Gulf Coast') && (
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">Gulf Coast</h3>
                <div className="flex flex-col gap-3 flex-1">
                  <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Ship className="w-4 h-4 text-sky-600" />
                      <div className="text-xs text-slate-600">Marine (Mobile)</div>
                    </div>
                    <div className="text-xl font-bold text-sky-600">{mtdByRegion.marine['Gulf Coast']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="w-4 h-4 text-orange-600" />
                      <div className="text-xs text-slate-600">Trucking (Mobile)</div>
                    </div>
                    <div className="text-xl font-bold text-orange-600">{mtdByRegion.trucking['Gulf Coast']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Warehouse className="w-4 h-4 text-purple-600" />
                      <div className="text-xs text-slate-600">Fuel Dock (Mobile)</div>
                    </div>
                    <div className="text-xl font-bold text-purple-600">{mtdByRegion.retailFuelDock['Gulf Coast']?.toLocaleString() || 0}</div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-100 border-2 border-slate-300 mt-auto">
                    <div className="text-xs text-slate-600 mb-1">Total Gulf Coast</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {((mtdByRegion.marine['Gulf Coast'] || 0) + (mtdByRegion.trucking['Gulf Coast'] || 0) + (mtdByRegion.retailFuelDock['Gulf Coast'] || 0)).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">gallons</div>
                  </div>
                </div>
              </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Volume Metrics by Delivery Method */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Marine (Barge) Deliveries */}
          <Card className="shadow-lg border-sky-200">
            <CardHeader className="pb-3 border-b border-sky-100">
              <div className="flex items-center gap-2">
                <Ship className="w-5 h-5 text-sky-600" />
                <CardTitle className="text-lg font-bold text-slate-900">Marine Deliveries</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last 7 Days</span>
                <span className="text-xl font-bold text-sky-600">{marineGallons7Days.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last 30 Days</span>
                <span className="text-xl font-bold text-sky-600">{marineGallons30Days.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last 90 Days</span>
                <span className="text-xl font-bold text-sky-600">{marineGallons90Days.toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-500 text-center pt-2 border-t">gallons delivered</p>
            </CardContent>
          </Card>

          {/* Trucking Deliveries */}
          <Card className="shadow-lg border-orange-200">
            <CardHeader className="pb-3 border-b border-orange-100">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-600" />
                <CardTitle className="text-lg font-bold text-slate-900">Trucking Deliveries</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last 7 Days</span>
                <span className="text-xl font-bold text-orange-600">{truckGallons7Days.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last 30 Days</span>
                <span className="text-xl font-bold text-orange-600">{truckGallons30Days.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last 90 Days</span>
                <span className="text-xl font-bold text-orange-600">{truckGallons90Days.toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-500 text-center pt-2 border-t">gallons delivered</p>
            </CardContent>
          </Card>

          {/* Fuel Dock Deliveries */}
          <Card className="shadow-lg border-purple-200">
            <CardHeader className="pb-3 border-b border-purple-100">
              <div className="flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-purple-600" />
                <CardTitle className="text-lg font-bold text-slate-900">Fuel Dock Deliveries</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last 7 Days</span>
                <span className="text-xl font-bold text-purple-600">{fuelDockGallons7Days.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last 30 Days</span>
                <span className="text-xl font-bold text-purple-600">{fuelDockGallons30Days.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last 90 Days</span>
                <span className="text-xl font-bold text-purple-600">{fuelDockGallons90Days.toLocaleString()}</span>
              </div>
              <p className="text-xs text-slate-500 text-center pt-2 border-t">gallons delivered</p>
            </CardContent>
          </Card>
        </div>

        {/* Fleet Status - Marine */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Available Barges</p>
                  <p className="text-xl md:text-2xl font-bold text-slate-900">
                    {availableBarges}
                  </p>
                  <p className="text-xs text-slate-500">of {barges.length} total</p>
                </div>
                <Ship className="w-6 h-6 md:w-8 md:h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Available Tugs</p>
                  <p className="text-xl md:text-2xl font-bold text-slate-900">
                    {availableTugs}
                  </p>
                  <p className="text-xs text-slate-500">of {tugs.length} total</p>
                </div>
                <Anchor className="w-6 h-6 md:w-8 md:h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200 sm:col-span-2 lg:col-span-1">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Vessels Down</p>
                  <p className={`text-xl md:text-2xl font-bold ${vesselsDown.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {vesselsDown.length}
                  </p>
                  <p className="text-xs text-slate-500">
                    {vesselsDown.length === 0 ? 'all operational' : 'in maintenance'}
                  </p>
                </div>
                <Wrench className={`w-6 h-6 md:w-8 md:h-8 ${vesselsDown.length > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fleet Status - Trucking */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Available Trucks</p>
                  <p className="text-xl md:text-2xl font-bold text-slate-900">
                    {availableTrucks}
                  </p>
                  <p className="text-xs text-slate-500">of {trucks.length} total</p>
                </div>
                <Truck className="w-6 h-6 md:w-8 md:h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Available Trailers</p>
                  <p className="text-xl md:text-2xl font-bold text-slate-900">
                    {availableTrailers}
                  </p>
                  <p className="text-xs text-slate-500">of {trailers.length} total</p>
                </div>
                <Package className="w-6 h-6 md:w-8 md:h-8 text-teal-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200 sm:col-span-2 lg:col-span-1">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Trucks Down</p>
                  <p className={`text-xl md:text-2xl font-bold ${trucksDown > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {trucksDown}
                  </p>
                  <p className="text-xs text-slate-500">
                    {trucksDown === 0 ? 'all operational' : 'in maintenance'}
                  </p>
                </div>
                <Wrench className={`w-6 h-6 md:w-8 md:h-8 ${trucksDown > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Orders Pending Dispatch by Market */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Orders Pending Dispatch ({pendingOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {pendingOrders.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                <p className="text-lg font-medium">All orders dispatched!</p>
                <p className="text-sm mt-2">No pending orders waiting for dispatch</p>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Marine Markets</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
                  {Object.entries(ordersByMarketAndMethod).map(([market, counts]) => {
                    const totalCount = counts.barge + counts.truck + counts.xpipe;
                    return (
                      <div
                        key={market}
                        className={`p-4 rounded-lg border-2 ${
                          totalCount > 0 
                            ? 'bg-yellow-50 border-yellow-200' 
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="text-sm font-medium text-slate-600 mb-2">{market}</div>
                        <div className={`text-3xl font-bold mb-2 ${
                          totalCount > 0 ? 'text-yellow-600' : 'text-slate-400'
                        }`}>
                          {totalCount}
                        </div>
                        <div className="text-xs text-slate-500 space-y-1">
                          {counts.barge > 0 && (
                            <div className="flex items-center gap-1">
                              <Ship className="w-3 h-3" />
                              <span>Barge: {counts.barge}</span>
                            </div>
                          )}
                          {counts.truck > 0 && (
                            <div className="flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              <span>Truck: {counts.truck}</span>
                            </div>
                          )}
                          {counts.xpipe > 0 && (
                            <div className="flex items-center gap-1">
                              <Warehouse className="w-3 h-3" />
                              <span>X-Pipe: {counts.xpipe}</span>
                            </div>
                          )}
                          {totalCount === 0 && 'No orders'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Trucking Markets</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {Object.entries(truckingOrdersByMarket).map(([market, count]) => (
                    <div
                      key={market}
                      className={`p-4 rounded-lg border-2 ${
                        count > 0 
                          ? 'bg-orange-50 border-orange-200' 
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="text-sm font-medium text-slate-600 mb-2">{market}</div>
                      <div className={`text-3xl font-bold mb-2 ${
                        count > 0 ? 'text-orange-600' : 'text-slate-400'
                      }`}>
                        {count}
                      </div>
                      <div className="text-xs text-slate-500">
                        {count === 1 ? 'truck order' : 'truck orders'}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Orders Awaiting Closeout - Barge */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Ship className="w-5 h-5 text-blue-600" />
                Barge Orders Awaiting Closeout ({bargeOrdersAwaitingCloseout.length})
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">Crew enters gallons & timing → Dispatch verifies & closes out</p>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {bargeOrdersAwaitingCloseout.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                <p className="text-lg font-medium">All barge orders closed out!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {bargeOrdersAwaitingCloseout.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 rounded-lg border-2 bg-blue-50 border-blue-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge className="bg-blue-600 text-white">
                        {order.market}
                      </Badge>
                      <Badge className={`${
                        order.status === 'scheduled' 
                          ? 'bg-blue-100 text-blue-800 border-blue-200' 
                          : 'bg-orange-100 text-orange-800 border-orange-200'
                      } border`}>
                        {order.status === 'scheduled' ? 'SCHEDULED' : 'IN TRANSIT'}
                      </Badge>
                    </div>
                    
                    {order.sage_order_number && (
                      <div className="mb-2">
                        <span className="text-xs text-slate-600 font-medium">Sage Order #:</span>
                        <div className="text-lg font-bold text-slate-900 font-mono">
                          {order.sage_order_number}
                        </div>
                      </div>
                    )}
                    
                    <div className="mb-2">
                      <span className="text-xs text-slate-600 font-medium">Customer:</span>
                      <div className="text-sm font-semibold text-slate-900">
                        {order.customer || 'N/A'}
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-blue-200 text-xs text-slate-600 space-y-1">
                      <div><span className="font-medium">Vessel:</span> {order.vessel_name}</div>
                      <div><span className="font-medium">Scheduled:</span> {formatDate(order.start_date)}</div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {!order.gallons_delivered && (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
                          Missing Gallons
                        </Badge>
                      )}
                      {!order.end_date && (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
                          Missing End Date
                        </Badge>
                      )}
                      {!order.paperwork_sent_to_billing && (
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                          No Paperwork
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders Awaiting Closeout - Trucking */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-orange-600" />
                Trucking Orders Awaiting Closeout ({truckOrdersAwaitingCloseout.length})
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">Driver completes delivery → Dispatch verifies & closes out</p>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {truckOrdersAwaitingCloseout.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                <p className="text-lg font-medium">All trucking orders closed out!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {truckOrdersAwaitingCloseout.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 rounded-lg border-2 bg-orange-50 border-orange-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge className="bg-orange-600 text-white">
                        {order.market}
                      </Badge>
                      <Badge className={`${
                        order.status === 'scheduled' 
                          ? 'bg-blue-100 text-blue-800 border-blue-200' 
                          : 'bg-orange-100 text-orange-800 border-orange-200'
                      } border`}>
                        {order.status === 'scheduled' ? 'SCHEDULED' : 'IN TRANSIT'}
                      </Badge>
                    </div>
                    
                    {order.sage_order_number && (
                      <div className="mb-2">
                        <span className="text-xs text-slate-600 font-medium">Sage Order #:</span>
                        <div className="text-lg font-bold text-slate-900 font-mono">
                          {order.sage_order_number}
                        </div>
                      </div>
                    )}
                    
                    <div className="mb-2">
                      <span className="text-xs text-slate-600 font-medium">Customer:</span>
                      <div className="text-sm font-semibold text-slate-900">
                        {order.customer_name || 'N/A'}
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-orange-200 text-xs text-slate-600 space-y-1">
                      <div><span className="font-medium">Truck:</span> {order.truck_number || 'N/A'}</div>
                      <div><span className="font-medium">Driver:</span> {order.driver_name || 'N/A'}</div>
                      <div><span className="font-medium">Scheduled:</span> {formatDate(order.dispatch_date)}</div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {!order.gallons && (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
                          Missing Gallons
                        </Badge>
                      )}
                      {!order.bol_number && (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
                          Missing BOL
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders Awaiting Closeout - Fuel Dock */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-purple-600" />
                Fuel Dock Orders Awaiting Closeout ({fuelDockOrdersAwaitingCloseout.length})
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">Dock crew completes delivery → Dispatch verifies & closes out</p>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {fuelDockOrdersAwaitingCloseout.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                <p className="text-lg font-medium">All fuel dock orders closed out!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {fuelDockOrdersAwaitingCloseout.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 rounded-lg border-2 bg-purple-50 border-purple-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge className="bg-purple-600 text-white">
                        {order.market}
                      </Badge>
                      <Badge className={`${
                        order.status === 'scheduled' 
                          ? 'bg-blue-100 text-blue-800 border-blue-200' 
                          : 'bg-orange-100 text-orange-800 border-orange-200'
                      } border`}>
                        {order.status === 'scheduled' ? 'SCHEDULED' : 'IN PROGRESS'}
                      </Badge>
                    </div>
                    
                    {order.sage_order_number && (
                      <div className="mb-2">
                        <span className="text-xs text-slate-600 font-medium">Sage Order #:</span>
                        <div className="text-lg font-bold text-slate-900 font-mono">
                          {order.sage_order_number}
                        </div>
                      </div>
                    )}
                    
                    <div className="mb-2">
                      <span className="text-xs text-slate-600 font-medium">Customer:</span>
                      <div className="text-sm font-semibold text-slate-900">
                        {order.customer || 'N/A'}
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-purple-200 text-xs text-slate-600 space-y-1">
                      <div><span className="font-medium">Vessel:</span> {order.vessel_name || 'N/A'}</div>
                      <div><span className="font-medium">Location:</span> {order.fuel_dock_location || 'N/A'}</div>
                      <div><span className="font-medium">Scheduled:</span> {formatDate(order.delivery_date)}</div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {!order.gallons_delivered && (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
                          Missing Gallons
                        </Badge>
                      )}
                      {!order.paperwork_sent_to_billing && (
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                          No Paperwork
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vessels Currently Down */}
        {vesselsDown.length > 0 && (
          <Card className="shadow-md border-2 border-red-300 bg-red-50">
            <CardHeader className="border-b border-red-200">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-red-600" />
                Vessels Currently Down for Maintenance ({vesselsDown.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {vesselsDown.map(task => {
                  const daysDown = task.drydock_out_of_water_date 
                    ? differenceInDays(today, parseISO(task.drydock_out_of_water_date))
                    : 0;
                  const daysRemaining = task.drydock_back_in_water_date 
                    ? differenceInDays(parseISO(task.drydock_back_in_water_date), today)
                    : 0;

                  return (
                    <div key={task.id} className="p-4 bg-white rounded-lg border-2 border-red-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Ship className="w-5 h-5 text-red-600" />
                          <h3 className="font-bold text-slate-900">{task.vessel_name}</h3>
                        </div>
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          {task.status_code}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-slate-600">
                        <div>
                          <span className="font-medium">Facility:</span> {task.facility_location || 'TBD'}
                        </div>
                        <div>
                          <span className="font-medium">Days Down:</span> {daysDown} days
                        </div>
                        <div>
                          <span className="font-medium">Expected Back:</span>{' '}
                          {task.drydock_back_in_water_date 
                            ? `${formatDate(task.drydock_back_in_water_date)} (${daysRemaining} days)`
                            : 'TBD'}
                        </div>
                        {task.current_condition && (
                          <div>
                            <span className="font-medium">Condition:</span> {task.current_condition}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading Needs Alert */}
        {loadingNeeds.length > 0 && (
          <Card className="shadow-md border-2 border-orange-300 bg-orange-50">
            <CardHeader className="border-b border-orange-200">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Barges Requiring Loading ({loadingNeeds.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {loadingNeeds.map((need) => (
                  <div
                    key={need.barge.id}
                    className={`p-4 rounded-lg border-2 ${
                      need.urgency === 'critical' 
                        ? 'bg-red-50 border-red-300' 
                        : 'bg-yellow-50 border-yellow-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Ship className={`w-5 h-5 ${
                          need.urgency === 'critical' ? 'text-red-600' : 'text-yellow-600'
                        }`} />
                        <div>
                          <h3 className="font-bold text-slate-900">{need.barge.name}</h3>
                          <p className="text-xs text-slate-600">{need.barge.market}</p>
                        </div>
                      </div>
                      <Badge className={`${
                        need.urgency === 'critical' 
                          ? 'bg-red-100 text-red-800 border-red-200' 
                          : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                      } border`}>
                        {need.urgency === 'critical' ? 'URGENT' : 'SOON'}
                      </Badge>
                    </div>

                    <div className="grid md:grid-cols-4 gap-3 text-sm mb-3">
                      <div>
                        <p className="text-xs text-slate-600">Current Inventory</p>
                        <p className="font-bold text-slate-900">
                          {need.currentInventory.toLocaleString()} gal
                        </p>
                        <p className="text-xs text-slate-500">{need.productType}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Delivery Needs</p>
                        <p className="font-bold text-slate-900">
                          {need.nextDelivery.gallons_delivered?.toLocaleString()} gal
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Must Load</p>
                        <p className={`font-bold ${
                          need.urgency === 'critical' ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {need.gallonsNeeded.toLocaleString()} gal
                        </p>
                        <p className="text-xs text-slate-500">{need.productType}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Delivery In</p>
                        <p className={`font-bold ${
                          need.urgency === 'critical' ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {need.daysUntilDelivery} day{need.daysUntilDelivery !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-sm text-slate-700 bg-white rounded p-2 border border-slate-200">
                      <span className="font-medium">Next Delivery:</span> {need.nextDelivery.vessel_name} on{' '}
                      {formatDate(need.nextDelivery.start_date)} → {need.nextDelivery.destination}
                      {need.nextDelivery.cargo_type && (
                        <span className="ml-2">({need.nextDelivery.cargo_type})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}