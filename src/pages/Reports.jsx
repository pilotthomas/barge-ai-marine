import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { differenceInDays, format, parseISO, isWithinInterval, startOfYear, eachDayOfInterval } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Droplets, Ship, Calendar, TrendingUp, Anchor, X, Package, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const COLORS = ['#0A2540', '#FF6B35', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6'];

// Safe date parsing helpers
const safeParseDate = (dateString) => {
  if (!dateString) return null;
  try {
    const parsed = parseISO(dateString);
    if (isNaN(parsed.getTime())) return null;
    return parsed;
  } catch (e) {
    console.error('Error parsing date:', dateString, e);
    return null;
  }
};

const safeFormatDate = (dateString, formatStr = 'MMM d, yyyy') => {
  const date = safeParseDate(dateString);
  if (!date) return '';
  try {
    return format(date, formatStr);
  } catch (e) {
    console.error('Error formatting date:', dateString, e);
    return dateString || '';
  }
};

const safeDifferenceInDays = (date1String, date2String) => {
  const date1 = safeParseDate(date1String);
  const date2 = safeParseDate(date2String);
  if (!date1 || !date2) return 0;
  try {
    return differenceInDays(date1, date2);
  } catch (e) {
    console.error('Error calculating difference in days:', e);
    return 0;
  }
};

export default function Reports() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [marketFilter, setMarketFilter] = useState('all');

  const queryClient = useQueryClient();

  const { data: dispatches = [] } = useQuery({
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

  const { data: cargoTypes = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: maintenanceTasks = [] } = useQuery({
    queryKey: ['maintenance-tasks'],
    queryFn: () => base44.entities.MaintenanceTask.list('-created_date'),
  });

  // Calculate vessel downtime statistics
  const drydockTasks = maintenanceTasks.filter(t => t.task_type === 'Drydock Schedule');
  
  const completedDrydocks = drydockTasks.filter(t => 
    t.status === 'completed' && 
    t.drydock_out_of_water_date && 
    t.drydock_back_in_water_date
  );

  const currentlyDown = drydockTasks.filter(t => {
    if (t.status === 'completed') return false;
    if (!t.drydock_out_of_water_date || !t.drydock_back_in_water_date) return false;

    const today = new Date();
    const start = safeParseDate(t.drydock_out_of_water_date);
    const end = safeParseDate(t.drydock_back_in_water_date);
    
    if (!start || !end) return false;
    return isWithinInterval(today, { start: start, end: end });
  });

  // Calculate average days down
  const totalDowntimeDays = completedDrydocks.reduce((sum, task) => {
    if (task.drydock_back_in_water_date && task.drydock_out_of_water_date) {
      const days = safeDifferenceInDays(task.drydock_back_in_water_date, task.drydock_out_of_water_date);
      return sum + days;
    }
    return sum;
  }, 0);

  const avgDaysDown = completedDrydocks.length > 0 
    ? Math.round(totalDowntimeDays / completedDrydocks.length) 
    : 0;

  // Group historical drydocks by vessel
  const historicalByVessel = {};
  completedDrydocks.forEach(task => {
    if (!task.vessel_name || !task.drydock_out_of_water_date || !task.drydock_back_in_water_date) {
      return;
    }
    
    if (!historicalByVessel[task.vessel_name]) {
      historicalByVessel[task.vessel_name] = [];
    }
    
    const daysDown = safeDifferenceInDays(task.drydock_back_in_water_date, task.drydock_out_of_water_date);
    
    historicalByVessel[task.vessel_name].push({
      ...task,
      daysDown
    });
  });

  // Filter dispatches by date range and market
  const filterByDateRange = (dispatch) => {
    if (!startDate && !endDate) return true;
    if (!dispatch.start_date) return false;
    
    try {
      const dispatchDateStr = dispatch.start_date.substring(0, 10);
      
      if (startDate && endDate) {
        return dispatchDateStr >= startDate && dispatchDateStr <= endDate;
      } else if (startDate) {
        return dispatchDateStr >= startDate;
      } else if (endDate) {
        return dispatchDateStr <= endDate;
      }
    } catch (e) {
      console.error('Error parsing dispatch date in filterByDateRange:', dispatch.start_date, e);
      return false;
    }
    
    return true;
  };

  const filterByMarket = (dispatch) => {
    if (marketFilter === 'all') return true;
    return dispatch.market === marketFilter;
  };

  const filteredDispatches = dispatches.filter(d => filterByDateRange(d) && filterByMarket(d));

  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const setQuickDateRange = (range) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    
    switch(range) {
      case 'q1':
        setStartDate(`${currentYear}-01-01`);
        setEndDate(`${currentYear}-03-31`);
        break;
      case 'q2':
        setStartDate(`${currentYear}-04-01`);
        setEndDate(`${currentYear}-06-30`);
        break;
      case 'q3':
        setStartDate(`${currentYear}-07-01`);
        setEndDate(`${currentYear}-09-30`);
        break;
      case 'q4':
        setStartDate(`${currentYear}-10-01`);
        setEndDate(`${currentYear}-12-31`);
        break;
      case 'ytd':
        setStartDate(`${currentYear}-01-01`);
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'last30':
        const last30 = new Date(today);
        last30.setDate(today.getDate() - 30);
        setStartDate(format(last30, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'last90':
        const last90 = new Date(today);
        last90.setDate(today.getDate() - 90);
        setStartDate(format(last90, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      default:
        // Optional: handle default case or do nothing
        break;
    }
  };

  // Gallons by Barge - show individual barges for specific market, grouped for rollup
  const gallonsByBarge = {};
  filteredDispatches.forEach(d => {
    if (d.status === 'delivered' && d.gallons_delivered) {
      const barge = barges.find(b => b.id === d.barge_id);
      let key;
      if (marketFilter === 'all') {
        // Rollup view - group by market
        const market = barge?.market || 'Unknown';
        key = `${market} Barges`;
      } else {
        // Specific market - show individual barges
        key = barge?.name || 'Unknown Barge';
      }
      gallonsByBarge[key] = (gallonsByBarge[key] || 0) + d.gallons_delivered;
    }
  });

  const bargeData = Object.entries(gallonsByBarge).map(([name, gallons]) => ({
    name,
    gallons
  })).sort((a, b) => b.gallons - a.gallons);

  // Utilization by Barge - show individual barges for specific market, grouped for rollup
  const utilizationByBarge = {};
  filteredDispatches.forEach(d => {
    if (d.start_date && d.end_date) {
      const days = differenceInDays(new Date(d.end_date), new Date(d.start_date)) + 1;
      const barge = barges.find(b => b.id === d.barge_id);
      let key;
      if (marketFilter === 'all') {
        // Rollup view - group by market
        const market = barge?.market || 'Unknown';
        key = `${market} Barges`;
      } else {
        // Specific market - show individual barges
        key = barge?.name || 'Unknown Barge';
      }
      utilizationByBarge[key] = (utilizationByBarge[key] || 0) + days;
    } else if (d.status === 'delivered' && d.start_date) {
      const barge = barges.find(b => b.id === d.barge_id);
      let key;
      if (marketFilter === 'all') {
        const market = barge?.market || 'Unknown';
        key = `${market} Barges`;
      } else {
        key = barge?.name || 'Unknown Barge';
      }
      utilizationByBarge[key] = (utilizationByBarge[key] || 0) + 1;
    }
  });

  const utilizationData = Object.entries(utilizationByBarge).map(([name, days]) => ({
    name,
    days
  })).sort((a, b) => b.days - a.days);

  // Utilization by Tug (days)
  const utilizationByTug = {};
  filteredDispatches.forEach(d => {
    if (d.tug_name) {
      if (d.start_date && d.end_date) {
        const days = differenceInDays(new Date(d.end_date), new Date(d.start_date)) + 1;
        utilizationByTug[d.tug_name] = (utilizationByTug[d.tug_name] || 0) + days;
      } else if (d.status === 'delivered' && d.start_date) {
        utilizationByTug[d.tug_name] = (utilizationByTug[d.tug_name] || 0) + 1;
      }
    }
  });

  const tugUtilizationData = Object.entries(utilizationByTug).map(([name, days]) => ({
    name,
    days
  }));

  // Gallons by Brand (Lubricants only)
  const gallonsByBrand = {};
  const deliveriesByBrand = {};
  filteredDispatches.forEach(d => {
    if (d.status === 'delivered' && d.cargo_brand && d.cargo_brand !== 'N/A') {
      gallonsByBrand[d.cargo_brand] = (gallonsByBrand[d.cargo_brand] || 0) + (d.gallons_delivered || 0);
      deliveriesByBrand[d.cargo_brand] = (deliveriesByBrand[d.cargo_brand] || 0) + 1;
    }
  });

  const brandData = Object.entries(gallonsByBrand).map(([name, gallons]) => ({
    name,
    gallons,
    deliveries: deliveriesByBrand[name]
  }));

  // Calculate average delivery sizes by category
  const fuelDeliveries = filteredDispatches.filter(d => {
    if (d.status !== 'delivered' || !d.cargo_type) return false;
    const cargo = cargoTypes.find(c => c.name === d.cargo_type);
    return cargo?.category === 'Fuel';
  });

  const lubesDeliveries = filteredDispatches.filter(d => {
    if (d.status !== 'delivered' || !d.cargo_type) return false;
    const cargo = cargoTypes.find(c => c.name === d.cargo_type);
    return cargo?.category === 'Lubes';
  });

  const avgFuelDelivery = fuelDeliveries.length > 0
    ? Math.round(fuelDeliveries.reduce((sum, d) => sum + (d.gallons_delivered || 0), 0) / fuelDeliveries.length)
    : 0;

  const avgLubesDelivery = lubesDeliveries.length > 0
    ? Math.round(lubesDeliveries.reduce((sum, d) => sum + (d.gallons_delivered || 0), 0) / lubesDeliveries.length)
    : 0;

  // Calendar utilization - days with deliveries
  const getDaysWithDeliveries = () => {
    if (!startDate || !endDate) return { daysWithDeliveries: 0, totalDays: 0, percentage: 0 };
    
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const allDays = eachDayOfInterval({ start, end });
      
      const daysWithDeliveries = new Set();
      filteredDispatches.forEach(d => {
        if (d.start_date) {
          const deliveryDateStr = d.start_date.substring(0, 10);
          daysWithDeliveries.add(deliveryDateStr);
        }
      });
      
      return {
        daysWithDeliveries: daysWithDeliveries.size,
        totalDays: allDays.length,
        percentage: allDays.length > 0 ? Math.round((daysWithDeliveries.size / allDays.length) * 100) : 0
      };
    } catch (e) {
      console.error('Error calculating calendar utilization:', e);
      return { daysWithDeliveries: 0, totalDays: 0, percentage: 0 };
    }
  };

  const calendarUtilization = getDaysWithDeliveries();

  // Deliveries by Product Type - normalize product names
  const deliveriesByProduct = {};
  filteredDispatches.filter(d => d.status === 'delivered' && d.cargo_type).forEach(d => {
    const cargo = cargoTypes.find(c => c.name === d.cargo_type);
    const category = cargo?.category || 'Other';
    
    // Normalize RD99 naming variations to single entry
    let productName = d.cargo_type;
    if (productName.includes('RD99') || productName.toLowerCase().includes('renewable diesel')) {
      productName = 'Renewable Diesel (RD99)';
    }
    
    deliveriesByProduct[productName] = (deliveriesByProduct[productName] || 0) + (d.gallons_delivered || 0);
  });

  // Separate fuel/other products from lubricants for better visualization
  const fuelProductData = Object.entries(deliveriesByProduct)
    .map(([name, gallons]) => {
      const cargo = cargoTypes.find(c => c.name === name || 
        (name === 'Renewable Diesel (RD99)' && (c.name.includes('RD99') || c.name.toLowerCase().includes('renewable diesel'))));
      return { name, gallons, category: cargo?.category || 'Other' };
    })
    .filter(item => item.category !== 'Lubes')
    .sort((a, b) => b.gallons - a.gallons)
    .slice(0, 8);

  const lubesProductData = Object.entries(deliveriesByProduct)
    .map(([name, gallons]) => {
      const cargo = cargoTypes.find(c => c.name === name);
      return { name, gallons, category: cargo?.category || 'Other' };
    })
    .filter(item => item.category === 'Lubes')
    .sort((a, b) => b.gallons - a.gallons);

  const totalGallons = filteredDispatches
    .filter(d => d.status === 'delivered')
    .reduce((sum, d) => sum + (d.gallons_delivered || 0), 0);

  const totalUtilizationDays = Object.values(utilizationByBarge).reduce((a, b) => a + b, 0);

  // Calculate average crew per day
  const getAverageCrewPerDay = () => {
    if (!startDate || !endDate) return null;
    
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const allDays = eachDayOfInterval({ start, end });
      
      let totalCrewDays = 0;
      
      allDays.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayDeliveries = filteredDispatches.filter(d => {
          if (d.status === 'cancelled') return false;
          if (!d.start_date) return false;
          return d.start_date.substring(0, 10) === dayStr;
        });
        
        const crewSet = new Set();
        dayDeliveries.forEach(d => {
          if (d.captain) crewSet.add(d.captain);
          if (d.deckhand) crewSet.add(d.deckhand);
          if (d.tankerman) crewSet.add(d.tankerman);
          if (d.crew_members && Array.isArray(d.crew_members)) {
            d.crew_members.forEach(c => crewSet.add(c));
          }
        });
        
        totalCrewDays += crewSet.size;
      });
      
      if (allDays.length === 0) return null;

      return {
        avgCrewPerDay: (totalCrewDays / allDays.length).toFixed(1),
        totalDays: allDays.length,
        totalCrewDays
      };
    } catch (e) {
      console.error('Error calculating crew stats:', e);
      return null;
    }
  };

  const crewStats = getAverageCrewPerDay();

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                Analytics & Reports
              </h1>
              <p className="text-slate-600">
                {marketFilter === 'all' ? 'Overall footprint' : marketFilter} performance insights
              </p>
            </div>
            <Select value={marketFilter} onValueChange={setMarketFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets (Rollup)</SelectItem>
                <SelectItem value="Long Beach">Long Beach</SelectItem>
                <SelectItem value="Oakland">Oakland</SelectItem>
                <SelectItem value="Portland">Portland</SelectItem>
                <SelectItem value="Seattle">Seattle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filters */}
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-700">Date Range</Label>
                  {(startDate || endDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearDateFilters}
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date" className="text-xs text-slate-600">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date" className="text-xs text-slate-600">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateRange('q1')}
                    className="text-xs"
                  >
                    Q1
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateRange('q2')}
                    className="text-xs"
                  >
                    Q2
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateRange('q3')}
                    className="text-xs"
                  >
                    Q3
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateRange('q4')}
                    className="text-xs"
                  >
                    Q4
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateRange('ytd')}
                    className="text-xs"
                  >
                    YTD
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateRange('last30')}
                    className="text-xs"
                  >
                    Last 30 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateRange('last90')}
                    className="text-xs"
                  >
                    Last 90 Days
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Gallons</p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {totalGallons.toLocaleString()}
                  </h3>
                </div>
                <Droplets className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Deliveries</p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {filteredDispatches.length}
                  </h3>
                </div>
                <Ship className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Avg Delivery Size - Fuel</p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {avgFuelDelivery.toLocaleString()}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">gallons</p>
                </div>
                <Droplets className="w-8 h-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Avg Delivery Size - Lubes</p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {avgLubesDelivery.toLocaleString()}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">gallons</p>
                </div>
                <Droplets className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Average Crew Per Day Card */}
        {crewStats && (
          <Card className="shadow-md border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                Average Crew Utilization Per Day
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-5xl font-bold text-slate-900 mb-2">
                    {crewStats.avgCrewPerDay}
                  </div>
                  <p className="text-slate-600 text-lg">Average crew members per day</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Total: {crewStats.totalCrewDays} crew-days across {crewStats.totalDays} days
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-teal-600">
                    {
                      (
                        (crewStats.totalCrewDays / crewStats.totalDays) * 100 / 
                        (users.filter(u => ['captain', 'deckhand', 'tankerman'].includes(u.position)).length || 1)
                      ).toFixed(0)
                    }%
                  </div>
                  <p className="text-sm text-slate-600">Crew utilization rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="shadow-md border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900">
                {marketFilter === 'all' ? 'Gallons Delivered by Market' : `Gallons Delivered by Barge - ${marketFilter}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={bargeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip />
                  <Bar dataKey="gallons" fill="#0A2540" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900">
                {marketFilter === 'all' ? 'Utilization Days by Market' : `Utilization Days by Barge - ${marketFilter}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {utilizationData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No utilization data yet</p>
                    <p className="text-sm">Add end dates to deliveries to track utilization</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={utilizationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="days" fill="#FF6B35" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Anchor className="w-5 h-5 text-teal-600" />
                Utilization Days by Tug
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {tugUtilizationData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Anchor className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No tug utilization data yet</p>
                    <p className="text-sm">Assign tugs to deliveries to track utilization</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tugUtilizationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="days" fill="#14B8A6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {brandData.length > 0 && (
            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-xl font-bold text-slate-900">
                  Lubricant Gallons by Brand
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={brandData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 border border-slate-200 rounded shadow-lg">
                              <p className="font-bold text-slate-900">{payload[0].payload.name}</p>
                              <p className="text-sm text-slate-600">
                                {payload[0].value.toLocaleString()} gallons
                              </p>
                              <p className="text-sm text-slate-600">
                                {payload[0].payload.deliveries} deliveries
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="gallons" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {startDate && endDate && (
            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-xl font-bold text-slate-900">
                  Calendar Utilization
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[300px] flex flex-col items-center justify-center">
                  <Calendar className="w-16 h-16 text-blue-600 mb-4" />
                  <div className="text-center">
                    <h3 className="text-5xl font-bold text-slate-900 mb-2">
                      {calendarUtilization.percentage}%
                    </h3>
                    <p className="text-lg text-slate-600 mb-4">Days with Deliveries</p>
                    <p className="text-sm text-slate-500">
                      {calendarUtilization.daysWithDeliveries} of {calendarUtilization.totalDays} days
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-md border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                Volume by Product Type - Fuel & Other
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {fuelProductData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No product data yet</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={fuelProductData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="gallons" fill="#6366F1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {lubesProductData.length > 0 && (
            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  Volume by Product Type - Lubricants
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={lubesProductData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#64748b" />
                    <Tooltip />
                    <Bar dataKey="gallons" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Vessel Downtime Statistics */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Ship className="w-5 h-5 text-red-600" />
                Vessel Downtime Statistics
              </CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    View Historical Data
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl">Historical Drydock Data</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {Object.entries(historicalByVessel).map(([vesselName, tasks]) => (
                      <div key={vesselName} className="border border-slate-200 rounded-lg p-4">
                        <h3 className="font-bold text-lg text-slate-900 mb-3">{vesselName}</h3>
                        <div className="space-y-2">
                          {tasks.map((task, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-200 text-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <Badge className="bg-slate-200 text-slate-800 mb-2">
                                    {task.status_code}
                                  </Badge>
                                  <p className="text-slate-700">
                                    <span className="font-semibold">Location:</span> {task.facility_location || 'N/A'}
                                  </p>
                                  <p className="text-slate-700">
                                    <span className="font-semibold">Out:</span> {safeFormatDate(task.drydock_out_of_water_date) || 'N/A'}
                                  </p>
                                  <p className="text-slate-700">
                                    <span className="font-semibold">Back:</span> {safeFormatDate(task.drydock_back_in_water_date) || 'N/A'}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-red-600">{task.daysDown}</div>
                                  <div className="text-xs text-slate-600">days down</div>
                                </div>
                              </div>
                              {task.notes && (
                                <p className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                                  {task.notes}
                                </p>
                              )}
                              {task.is_afe_item && (
                                <div className="pt-2 border-t border-slate-200 mt-2">
                                  <Badge className="bg-blue-100 text-blue-800">AFE Item</Badge>
                                  {task.budgeted_amount && (
                                    <span className="text-xs text-slate-600 ml-2">
                                      Budget: ${parseFloat(task.budgeted_amount).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-300">
                          <div className="flex justify-between text-sm">
                            <span className="font-semibold text-slate-700">Average Days Down:</span>
                            <span className="font-bold text-red-600">
                              {Math.round(tasks.reduce((sum, t) => sum + t.daysDown, 0) / (tasks.length || 1))} days
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {Object.keys(historicalByVessel).length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <Ship className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No historical drydock data available</p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-slate-900 mb-2">
                  {avgDaysDown}
                </div>
                <p className="text-sm text-slate-600">Average Days Down</p>
                <p className="text-xs text-slate-500 mt-1">Based on {completedDrydocks.length} completed drydocks</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl font-bold text-red-600 mb-2">
                  {currentlyDown.length}
                </div>
                <p className="text-sm text-slate-600">Currently Down</p>
                <p className="text-xs text-slate-500 mt-1">Vessels in drydock now</p>
              </div>
              
              <div className="text-center">
                <div className="text-4xl font-bold text-emerald-600 mb-2">
                  {completedDrydocks.length}
                </div>
                <p className="text-sm text-slate-600">Total Completed</p>
                <p className="text-xs text-slate-500 mt-1">All-time drydock events</p>
              </div>
            </div>

            {currentlyDown.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-3">Currently Down:</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {currentlyDown.map(task => {
                    const daysDown = task.drydock_out_of_water_date ? safeDifferenceInDays(new Date().toISOString(), task.drydock_out_of_water_date) : 0;
                    const daysRemaining = task.drydock_back_in_water_date ? safeDifferenceInDays(task.drydock_back_in_water_date, new Date().toISOString()) : 0;
                    
                    return (
                      <div key={task.id} className="p-3 bg-red-50 rounded border border-red-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-slate-900">{task.vessel_name}</p>
                            <Badge className="bg-slate-200 text-slate-800 text-xs mt-1">
                              {task.status_code}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-red-600">{daysDown}</div>
                            <div className="text-xs text-slate-600">days down</div>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 mt-2">
                          Expected back in {daysRemaining} days
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}