import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Calendar } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";

export default function DailyOps() {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

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

  const { data: maintenanceTasks = [] } = useQuery({
    queryKey: ['maintenance-tasks'],
    queryFn: () => base44.entities.MaintenanceTask.list(),
  });

  const { data: fuelDockDeliveries = [] } = useQuery({
    queryKey: ['fuel-dock-deliveries'],
    queryFn: () => base44.entities.FuelDockDelivery.list(),
  });

  const { data: retailFuelDockDaily = [] } = useQuery({
    queryKey: ['retail-fuel-dock-daily'],
    queryFn: () => base44.entities.RetailFuelDockDaily.list(),
  });

  // Filter deliveries and fuel dock by date range
  const filteredDeliveries = deliveries.filter(d => {
    if (d.status === 'cancelled') return false;
    const deliveryDate = parseISO(d.start_date);
    return deliveryDate >= new Date(startDate) && deliveryDate <= new Date(endDate);
  });

  const filteredFuelDock = fuelDockDeliveries.filter(d => {
    if (d.status !== 'completed') return false;
    const deliveryDate = parseISO(d.delivery_date);
    return deliveryDate >= new Date(startDate) && deliveryDate <= new Date(endDate);
  });

  const filteredRetailFuelDock = retailFuelDockDaily.filter(d => {
    if (!d.date) return false;
    try {
      const entryDate = parseISO(d.date);
      return entryDate >= new Date(startDate) && entryDate <= new Date(endDate);
    } catch (e) {
      return false;
    }
  });

  // Calculate location statistics
  const locationStats = {};
  const locations = [
    { name: 'Long Beach', key: 'Long Beach' },
    { name: 'Seattle', key: 'Seattle' },
    { name: 'Oakland', key: 'Oakland' },
    { name: 'Portland', key: 'Portland' },
    { name: 'San Francisco', key: 'Oakland', isSFRetail: true },
    { name: 'Huntington Beach', key: null, isHBRetail: true },
    { name: 'Port Hueneme', key: null, isPHRetail: true }
  ];

  locations.forEach(({ name, key, isSFRetail, isHBRetail, isPHRetail }) => {
    let locationDeliveries = [];
    let locationFuelDock = [];
    
    if (isSFRetail) {
      // San Francisco fuel dock - use facility-based retail fuel dock data
      locationFuelDock = filteredRetailFuelDock.filter(d => d.facility === 'San Francisco Pier 45');
    } else if (isHBRetail) {
      // Huntington Beach - use facility-based retail fuel dock data
      locationFuelDock = filteredRetailFuelDock.filter(d => d.facility === 'Huntington Beach');
    } else if (isPHRetail) {
      // Port Hueneme - use facility-based retail fuel dock data
      locationFuelDock = filteredRetailFuelDock.filter(d => d.facility === 'Port Hueneme');
    } else {
      locationDeliveries = filteredDeliveries.filter(d => d.market === key);
      // For Long Beach, also include Berth 258 fuel dock location
      if (name === 'Long Beach') {
        locationFuelDock = filteredFuelDock.filter(d => d.market === key || d.fuel_dock_location === 'Berth 258 - Long Beach');
      } else {
        locationFuelDock = filteredFuelDock.filter(d => d.market === key);
      }
    }
    
    // Total gallons (barge + fuel dock)
    const gallonsBarge = locationDeliveries.reduce((sum, d) => sum + (d.gallons_delivered || 0), 0);
    // For retail locations, use gallons field; for others use gallons_delivered
    const gallonsFuelDock = locationFuelDock.reduce((sum, d) => sum + (d.gallons || d.gallons_delivered || 0), 0);
    const totalGallons = gallonsBarge + gallonsFuelDock;
    
    // Count deliveries by tug usage
    const tugDeliveries = locationDeliveries.filter(d => d.tug_id && !d.is_third_party_towing).length;
    const thirdPartyDeliveries = locationDeliveries.filter(d => d.is_third_party_towing).length;
    const totalDeliveries = locationDeliveries.length;
    
    // Utilization percentages
    const tugUtilization = totalDeliveries > 0 ? ((tugDeliveries / totalDeliveries) * 100).toFixed(1) : 0;
    const bargeUtilization = totalDeliveries > 0 ? ((locationDeliveries.filter(d => d.barge_id).length / totalDeliveries) * 100).toFixed(1) : 0;
    const thirdPartyPercent = totalDeliveries > 0 ? ((thirdPartyDeliveries / totalDeliveries) * 100).toFixed(1) : 0;
    
    // Calculate average crew per day (only for non-retail locations)
    const dailyCrewCounts = {};
    if (!isSFRetail && !isHBRetail && !isPHRetail) {
      locationDeliveries.forEach(d => {
        const dateKey = format(parseISO(d.start_date), 'yyyy-MM-dd');
        if (!dailyCrewCounts[dateKey]) {
          dailyCrewCounts[dateKey] = new Set();
        }
        
        if (d.captain) dailyCrewCounts[dateKey].add(`captain-${d.captain}`);
        if (d.deckhand) dailyCrewCounts[dateKey].add(`deckhand-${d.deckhand}`);
        if (d.tankerman) dailyCrewCounts[dateKey].add(`tankerman-${d.tankerman}`);
        if (d.crew_members) {
          d.crew_members.forEach(c => dailyCrewCounts[dateKey].add(`crew-${c}`));
        }
      });
    }
    
    const operatingDays = Object.keys(dailyCrewCounts).length;
    const totalCrewDays = Object.values(dailyCrewCounts).reduce((sum, set) => sum + set.size, 0);
    const avgCrewPerDay = operatingDays > 0 ? (totalCrewDays / operatingDays).toFixed(1) : 0;
    
    // Fuel dock uptime - calculate as % of days open (excluding closed days)
    let fuelDockDays = 0;
    let closedDays = 0;
    if (isSFRetail || isHBRetail || isPHRetail) {
      // For retail locations, count operational days and closed days
      const allDays = new Set(locationFuelDock.map(d => d.date));
      fuelDockDays = locationFuelDock.filter(d => d.status !== 'closed').length;
      closedDays = locationFuelDock.filter(d => d.status === 'closed').length;
    } else {
      // For other locations, use delivery_date field (only operational days)
      fuelDockDays = new Set(locationFuelDock.map(d => d.delivery_date ? format(parseISO(d.delivery_date), 'yyyy-MM-dd') : null).filter(d => d)).size;
      closedDays = 0;
    }
    const totalDays = fuelDockDays + closedDays || 1;
    const fuelDockUptime = totalDays > 0 ? ((fuelDockDays / totalDays) * 100).toFixed(1) : 0;
    
    locationStats[name] = {
      totalGallons,
      tugUtilization: parseFloat(tugUtilization),
      bargeUtilization: parseFloat(bargeUtilization),
      thirdPartyPercent: parseFloat(thirdPartyPercent),
      avgCrewPerDay: parseFloat(avgCrewPerDay),
      fuelDockUptime: parseFloat(fuelDockUptime),
      fuelDockGallons: gallonsFuelDock,
      charterCost: 0, // Placeholder
      isRetailOnly: isSFRetail || isHBRetail
    };
  });

  // Fleet health stats
  const totalTugs = tugs.length;
  const totalBarges = barges.length;
  
  const vesselsDownRegulatory = maintenanceTasks.filter(t => {
    if (t.status === 'completed') return false;
    if (!['USCG Compliance', 'ABS Compliance', 'SIRE Compliance'].includes(t.task_type)) return false;
    
    const today = new Date();
    if (t.drydock_out_of_water_date && t.drydock_back_in_water_date) {
      const start = new Date(t.drydock_out_of_water_date);
      const end = new Date(t.drydock_back_in_water_date);
      return today >= start && today <= end;
    }
    return false;
  });

  const vesselsDownMechanical = maintenanceTasks.filter(t => {
    if (t.status === 'completed') return false;
    if (t.task_type !== 'Drydock Schedule' && t.task_type !== 'Scheduled Maintenance') return false;
    
    const today = new Date();
    if (t.drydock_out_of_water_date && t.drydock_back_in_water_date) {
      const start = new Date(t.drydock_out_of_water_date);
      const end = new Date(t.drydock_back_in_water_date);
      return today >= start && today <= end;
    }
    return false;
  });

  // Count vessels down for Unplanned R&M only
  const vesselsDownUnplannedRM = maintenanceTasks.filter(t => {
    if (t.status === 'completed') return false;
    if (t.task_type !== 'Unplanned R&M') return false;
    
    const today = new Date();
    if (t.drydock_out_of_water_date && t.drydock_back_in_water_date) {
      const start = new Date(t.drydock_out_of_water_date);
      const end = new Date(t.drydock_back_in_water_date);
      return today >= start && today <= end;
    }
    return false;
  });
  
  const tugsDownUnplannedRM = vesselsDownUnplannedRM.filter(t => t.vessel_type === 'tug').length;
  const bargesDownUnplannedRM = vesselsDownUnplannedRM.filter(t => t.vessel_type === 'barge').length;
  
  const tugsOperating = totalTugs - tugsDownUnplannedRM;
  const bargesOperating = totalBarges - bargesDownUnplannedRM;
  
  const tugFleetUptime = totalTugs > 0 ? ((tugsOperating / totalTugs) * 100).toFixed(1) : 0;
  const bargeFleetUptime = totalBarges > 0 ? ((bargesOperating / totalBarges) * 100).toFixed(1) : 0;
  
  // Calculate overall average crew per day
  const allDailyCrewCounts = {};
  filteredDeliveries.forEach(d => {
    const dateKey = format(parseISO(d.start_date), 'yyyy-MM-dd');
    if (!allDailyCrewCounts[dateKey]) {
      allDailyCrewCounts[dateKey] = new Set();
    }
    
    if (d.captain) allDailyCrewCounts[dateKey].add(`captain-${d.captain}`);
    if (d.deckhand) allDailyCrewCounts[dateKey].add(`deckhand-${d.deckhand}`);
    if (d.tankerman) allDailyCrewCounts[dateKey].add(`tankerman-${d.tankerman}`);
    if (d.crew_members) {
      d.crew_members.forEach(c => allDailyCrewCounts[dateKey].add(`crew-${c}`));
    }
  });
  
  const totalOperatingDays = Object.keys(allDailyCrewCounts).length;
  const totalCrewDays = Object.values(allDailyCrewCounts).reduce((sum, set) => sum + set.size, 0);
  const overallAvgCrewPerDay = totalOperatingDays > 0 ? (totalCrewDays / totalOperatingDays).toFixed(1) : 0;

  // Calculate West Region totals
  const westRegionTotals = {
    totalGallons: Object.values(locationStats).reduce((sum, s) => sum + s.totalGallons, 0),
    tugUtilization: (Object.values(locationStats).reduce((sum, s) => sum + s.tugUtilization, 0) / locations.length).toFixed(1),
    bargeUtilization: (Object.values(locationStats).reduce((sum, s) => sum + s.bargeUtilization, 0) / locations.length).toFixed(1),
    thirdPartyPercent: (Object.values(locationStats).reduce((sum, s) => sum + s.thirdPartyPercent, 0) / locations.length).toFixed(1),
    avgCrewPerDay: (Object.values(locationStats).reduce((sum, s) => sum + s.avgCrewPerDay, 0) / locations.length).toFixed(1),
    fuelDockUptime: (Object.values(locationStats).reduce((sum, s) => sum + s.fuelDockUptime, 0) / locations.length).toFixed(1),
    fuelDockGallons: Object.values(locationStats).reduce((sum, s) => sum + s.fuelDockGallons, 0),
    charterCost: 0
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Marine KPIs
            </h1>
            <p className="text-slate-600">Auto-calculated from delivery data</p>
          </div>
        </div>

        {/* Date Range Filter */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Date Range Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="start-date" className="text-sm font-medium mb-2 block">
                  Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="end-date" className="text-sm font-medium mb-2 block">
                  End Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                  }}
                >
                  Current Month
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setStartDate(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
                    setEndDate(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
                  }}
                >
                  Last Month
                </Button>
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-3">
              Showing data from {format(new Date(startDate), 'MMM d, yyyy')} to {format(new Date(endDate), 'MMM d, yyyy')} 
              ({filteredDeliveries.length} barge deliveries, {filteredFuelDock.length} fuel dock deliveries)
            </p>
          </CardContent>
        </Card>

        {/* Executive Summary */}
        <Card className="shadow-lg border-blue-300">
          <CardHeader className="bg-blue-600 text-white">
            <CardTitle className="text-xl font-bold">EXECUTIVE SUMMARY</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-50">
                    <th className="text-left py-3 px-4 font-bold">Metric</th>
                    <th className="text-center py-3 px-4 font-bold">Value</th>
                    <th className="text-center py-3 px-4 font-bold">Target</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4">Tug Fleet Uptime %</td>
                    <td className="text-center py-3 px-4 font-medium">{tugFleetUptime}%</td>
                    <td className="text-center py-3 px-4">90%</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4">Barge Fleet Uptime %</td>
                    <td className="text-center py-3 px-4 font-medium">{bargeFleetUptime}%</td>
                    <td className="text-center py-3 px-4">90%</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4">Vessels Down - Regulatory</td>
                    <td className="text-center py-3 px-4 font-medium">{vesselsDownRegulatory.length}</td>
                    <td className="text-center py-3 px-4">-</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4">Vessels Down - Mechanical</td>
                    <td className="text-center py-3 px-4 font-medium">{vesselsDownMechanical.length}</td>
                    <td className="text-center py-3 px-4">0</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Avg. Crew/Day</td>
                    <td className="text-center py-3 px-4 font-medium">{overallAvgCrewPerDay}</td>
                    <td className="text-center py-3 px-4">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* West Region Detail */}
        <Card className="shadow-lg border-green-300">
          <CardHeader className="bg-green-600 text-white">
            <CardTitle className="text-xl font-bold">WEST REGION DETAIL</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-50">
                    <th className="text-left py-3 px-4 font-bold">Metric</th>
                    <th className="text-center py-3 px-4 font-bold">Value</th>
                    <th className="text-center py-3 px-4 font-bold">Target</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4">Total Gallons</td>
                    <td className="text-center py-3 px-4 font-medium">{westRegionTotals.totalGallons.toLocaleString()}</td>
                    <td className="text-center py-3 px-4">-</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4">Tug Utilization %</td>
                    <td className="text-center py-3 px-4 font-medium">{westRegionTotals.tugUtilization}%</td>
                    <td className="text-center py-3 px-4">-</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4">Barge Utilization %</td>
                    <td className="text-center py-3 px-4 font-medium">{westRegionTotals.bargeUtilization}%</td>
                    <td className="text-center py-3 px-4">-</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4">3rd Party Towing %</td>
                    <td className="text-center py-3 px-4 font-medium">{westRegionTotals.thirdPartyPercent}%</td>
                    <td className="text-center py-3 px-4">-</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4">Avg. Crew/Day</td>
                    <td className="text-center py-3 px-4 font-medium">{westRegionTotals.avgCrewPerDay}</td>
                    <td className="text-center py-3 px-4">-</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4">Fuel Dock Uptime %</td>
                    <td className="text-center py-3 px-4 font-medium">{westRegionTotals.fuelDockUptime}%</td>
                    <td className="text-center py-3 px-4">-</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-3 px-4">Fuel Dock Gallons</td>
                    <td className="text-center py-3 px-4 font-medium">{westRegionTotals.fuelDockGallons.toLocaleString()}</td>
                    <td className="text-center py-3 px-4">-</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Charter Cost (Monthly)</td>
                    <td className="text-center py-3 px-4 font-medium">${westRegionTotals.charterCost.toLocaleString()}</td>
                    <td className="text-center py-3 px-4">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* West Location Detail */}
        <Card className="shadow-lg border-purple-300">
          <CardHeader className="bg-purple-100 border-b border-purple-200">
            <CardTitle className="text-xl font-bold text-purple-900">WEST LOCATION DETAIL</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-300 bg-slate-50">
                    <th className="text-left py-3 px-4 font-bold">Location</th>
                    <th className="text-center py-3 px-4 font-bold">Gallons</th>
                    <th className="text-center py-3 px-4 font-bold">Tug Util %</th>
                    <th className="text-center py-3 px-4 font-bold">Barge Util %</th>
                    <th className="text-center py-3 px-4 font-bold">3rd Party %</th>
                    <th className="text-center py-3 px-4 font-bold">Avg Crew</th>
                    <th className="text-center py-3 px-4 font-bold">Fuel Dock Uptime %</th>
                    <th className="text-center py-3 px-4 font-bold">Fuel Dock Gals</th>
                  </tr>
                </thead>
                <tbody>
                   {locations.map(({ name }) => {
                     const stats = locationStats[name];
                     return (
                       <tr key={name} className="border-b border-slate-200 hover:bg-slate-50">
                         <td className="py-3 px-4 font-medium">{name}</td>
                         <td className="text-center py-3 px-4">{stats.totalGallons.toLocaleString()}</td>
                         <td className="text-center py-3 px-4">{stats.isRetailOnly ? 'N/A' : `${stats.tugUtilization}%`}</td>
                         <td className="text-center py-3 px-4">{stats.isRetailOnly ? 'N/A' : `${stats.bargeUtilization}%`}</td>
                         <td className="text-center py-3 px-4">{stats.isRetailOnly ? 'N/A' : `${stats.thirdPartyPercent}%`}</td>
                         <td className="text-center py-3 px-4">{stats.isRetailOnly ? 'N/A' : stats.avgCrewPerDay}</td>
                         <td className="text-center py-3 px-4">{stats.fuelDockUptime > 0 ? `${stats.fuelDockUptime}%` : 'N/A'}</td>
                         <td className="text-center py-3 px-4">{stats.fuelDockGallons > 0 ? stats.fuelDockGallons.toLocaleString() : 'N/A'}</td>
                       </tr>
                     );
                   })}
                 </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Vessels Down Section */}
        {(vesselsDownRegulatory.length > 0 || vesselsDownMechanical.length > 0) && (
          <Card className="shadow-md border-orange-300 bg-orange-50">
            <CardHeader className="border-b border-orange-200">
              <CardTitle className="text-xl font-bold text-orange-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Vessels Currently Down
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {vesselsDownRegulatory.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-orange-800 mb-3">Regulatory Issues:</h4>
                    <div className="space-y-2">
                      {vesselsDownRegulatory.map(task => (
                        <div key={task.id} className="p-3 bg-white rounded border border-orange-200 text-sm">
                          <div className="font-medium">{task.vessel_name}</div>
                          <div className="text-slate-600">{task.task_name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {vesselsDownMechanical.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-orange-800 mb-3">Mechanical Issues:</h4>
                    <div className="space-y-2">
                      {vesselsDownMechanical.map(task => (
                        <div key={task.id} className="p-3 bg-white rounded border border-orange-200 text-sm">
                          <div className="font-medium">{task.vessel_name}</div>
                          <div className="text-slate-600">{task.task_name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}