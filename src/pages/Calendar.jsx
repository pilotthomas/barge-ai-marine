import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Ship, MapPin, Anchor, Users, Waves, Calendar as CalendarIcon, Droplet, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  parseISO,
  addDays,
  startOfDay,
  isWithinInterval
} from "date-fns";

const statusColors = {
  pending: "bg-red-100 text-red-800 border-red-200",
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200",
};

const calendarItemColors = {
  pending: "bg-red-100 text-red-800",
  scheduled: "bg-blue-100 text-blue-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-100 text-slate-800",
};

const loadingEventColors = {
  scheduled: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-orange-100 text-orange-800 border-orange-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200"
};

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedMarket, setSelectedMarket] = useState("all");
  const [selectedDay, setSelectedDay] = useState(null);
  const [weekStartDate, setWeekStartDate] = useState(startOfWeek(new Date()));

  React.useEffect(() => {
    base44.auth.me().then(user => {
      if (user.default_market) {
        setSelectedMarket(user.default_market);
      }
    }).catch(() => {});
  }, []);

  const { data: deliveries = [] } = useQuery({
    queryKey: ['dispatches'],
    queryFn: () => base44.entities.Dispatch.list('-created_date'),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: loadingEvents = [] } = useQuery({
    queryKey: ['loading-events'],
    queryFn: () => base44.entities.LoadingEvent.list('-scheduled_date'),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  const { data: salesOrders = [] } = useQuery({ // Added salesOrders query
    queryKey: ['sales-orders'],
    queryFn: () => base44.entities.SalesOrder.list('-submitted_date'),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: tugs = [] } = useQuery({
    queryKey: ['tugs'],
    queryFn: () => base44.entities.Tug.list(),
  });

  // Only Barge-method orders belong on the Barge Calendar; Dock (X-Pipe) and Truck
  // orders have their own calendars.
  const pendingSalesOrders = salesOrders.filter(o =>
    o.status === 'pending' &&
    o.method_of_delivery === 'Barge' &&
    (selectedMarket === 'all' || o.market === selectedMarket)
  );

  // Filter deliveries by market, excluding cancelled items
  const filteredDeliveries = (selectedMarket === "all"
    ? deliveries
    : deliveries.filter(d => d.market === selectedMarket)
  ).filter(d => d.status !== 'cancelled');

  // Filter loading events by market (through barge), excluding cancelled items
  const filteredLoadingEvents = (selectedMarket === "all"
    ? loadingEvents
    : loadingEvents.filter(e => {
        const barge = barges.find(b => b.id === e.barge_id);
        return barge?.market === selectedMarket;
      })
  ).filter(e => e.status !== 'cancelled');

  // Get calendar days for month view
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get 7 days for week view
  const weekDays = eachDayOfInterval({
    start: startOfDay(weekStartDate),
    end: addDays(startOfDay(weekStartDate), 6)
  });

  // Get deliveries for a specific day
  const getDeliveriesForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return filteredDeliveries.filter(delivery => {
      // Compare date strings directly to avoid timezone issues
      if (!delivery.start_date) return false;
      try {
        return delivery.start_date.startsWith(dayStr);
      } catch (e) {
        console.error('Error checking delivery date:', delivery.start_date, e);
        return false;
      }
    });
  };

  // Get pending sales orders for a specific day
  const getPendingOrdersForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return pendingSalesOrders.filter(order => {
      if (!order.requested_date) return false;
      try {
        return order.requested_date.startsWith(dayStr);
      } catch (e) {
        console.error('Error checking order date:', order.requested_date, e);
        return false;
      }
    });
  };

  // Get loading events for a specific day
  const getLoadingEventsForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return filteredLoadingEvents.filter(event => {
      // Compare date strings directly to avoid timezone issues
      if (!event.scheduled_date) return false;
      try {
        return event.scheduled_date.startsWith(dayStr);
      } catch (e) {
        console.error('Error checking event date:', event.scheduled_date, e);
        return false;
      }
    });
  };

  // Get deliveries for week view organized by barge
  const getWeekDeliveriesByBarge = () => {
    const weekEnd = addDays(startOfDay(weekStartDate), 6);
    const weekDeliveries = filteredDeliveries.filter(d => {
      if (!d.start_date) return false;
      try {
        // Extract just the date part and compare as strings to avoid timezone issues
        const deliveryDateStr = d.start_date.substring(0, 10); // Get YYYY-MM-DD part
        const weekStartStr = format(weekStartDate, 'yyyy-MM-dd');
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
        return deliveryDateStr >= weekStartStr && deliveryDateStr <= weekEndStr;
      } catch (e) {
        console.error('Error filtering delivery for week view:', d.start_date, e);
        return false;
      }
    });

    // Group by barge
    const byBarge = {};
    weekDeliveries.forEach(delivery => {
      const bargeKey = delivery.barge_name || 'Unassigned';
      if (!byBarge[bargeKey]) {
        byBarge[bargeKey] = {};
      }

      // Group deliveries by date within each barge
      if (delivery.start_date) {
        try {
          const dateKey = delivery.start_date.substring(0, 10); // Get YYYY-MM-DD directly
          if (!byBarge[bargeKey][dateKey]) {
            byBarge[bargeKey][dateKey] = [];
          }
          byBarge[bargeKey][dateKey].push(delivery);
          // Sort deliveries for each day by requested_delivery_time
          byBarge[bargeKey][dateKey].sort((a, b) => {
            const timeA = a.requested_delivery_time || '00:00';
            const timeB = b.requested_delivery_time || '00:00';
            return timeA.localeCompare(timeB);
          });
        } catch (e) {
          console.error('Error grouping delivery by barge:', delivery.start_date, e);
        }
      }
    });

    return byBarge;
  };

  // Get loading events for week view organized by barge
  const getWeekLoadingEventsByBarge = () => {
    const weekEnd = addDays(startOfDay(weekStartDate), 6);
    const weekLoadingEvents = filteredLoadingEvents.filter(e => {
      if (!e.scheduled_date) return false;
      try {
        // Extract just the date part and compare as strings to avoid timezone issues
        const eventDateStr = e.scheduled_date.substring(0, 10); // Get YYYY-MM-DD part
        const weekStartStr = format(weekStartDate, 'yyyy-MM-dd');
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
        return eventDateStr >= weekStartStr && eventDateStr <= weekEndStr;
      } catch (e) {
        console.error('Error filtering loading event for week view:', e.scheduled_date, e);
        return false;
      }
    });

    // Group by barge
    const byBarge = {};
    weekLoadingEvents.forEach(event => {
      const bargeKey = event.barge_name || 'Unassigned';
      if (!byBarge[bargeKey]) {
        byBarge[bargeKey] = {};
      }

      if (event.scheduled_date) {
        try {
          const dateKey = event.scheduled_date.substring(0, 10); // Get YYYY-MM-DD directly
          if (!byBarge[bargeKey][dateKey]) {
            byBarge[bargeKey][dateKey] = [];
          }
          byBarge[bargeKey][dateKey].push(event);
        } catch (e) {
          console.error('Error grouping loading event by barge:', event.scheduled_date, e);
        }
      }
    });

    return byBarge;
  };

  const getCrewList = (dispatch) => {
    const crew = [];
    if (dispatch.captain) crew.push(dispatch.captain);
    if (dispatch.deckhand) crew.push(dispatch.deckhand);
    if (dispatch.tankerman) crew.push(dispatch.tankerman);
    if (dispatch.crew_members?.length) crew.push(...dispatch.crew_members);
    return crew;
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handlePreviousWeek = () => {
    setWeekStartDate(addDays(weekStartDate, -7));
  };

  const handleNextWeek = () => {
    setWeekStartDate(addDays(weekStartDate, 7));
  };

  const handleToday = () => {
    setWeekStartDate(startOfWeek(new Date()));
  };

  const handleExportWeekView = () => {
    // Create a simple alert instructing the user to use browser print
    alert('To export this week view:\n\n1. Press Ctrl+P (Windows) or Cmd+P (Mac)\n2. Select "Save as PDF" or "Microsoft Print to PDF" as the printer\n3. Click Save\n\nTip: You can also take a screenshot using:\n- Windows: Win+Shift+S\n- Mac: Cmd+Shift+4');
  };

  const dayDeliveries = selectedDay ? getDeliveriesForDay(selectedDay) : [];
  const dayLoadingEvents = selectedDay ? getLoadingEventsForDay(selectedDay) : [];
  const dayPendingOrders = selectedDay ? getPendingOrdersForDay(selectedDay) : [];
  const weekDeliveriesByBarge = getWeekDeliveriesByBarge();
  const weekLoadingEventsByBarge = getWeekLoadingEventsByBarge();

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
              Barge Calendar
            </h1>
            <p className="text-sm md:text-base text-slate-600">View scheduled deliveries and loading events by date and market</p>
          </div>
          <Select value={selectedMarket} onValueChange={setSelectedMarket}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Select market" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              <SelectItem value="Long Beach">Long Beach</SelectItem>
              <SelectItem value="Oakland">Oakland</SelectItem>
              <SelectItem value="Portland">Portland</SelectItem>
              <SelectItem value="Seattle">Seattle</SelectItem>
              <SelectItem value="Wood River">Wood River (MS River)</SelectItem>
              <SelectItem value="St. Louis">St. Louis (MS River)</SelectItem>
              <SelectItem value="Wycliffe">Wycliffe (MS River)</SelectItem>
              <SelectItem value="Memphis">Memphis (MS River)</SelectItem>
              <SelectItem value="Baton Rouge">Baton Rouge (MS River)</SelectItem>
              <SelectItem value="Mobile">Mobile (Gulf Coast)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="week" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="month">Month View</TabsTrigger>
            <TabsTrigger value="week">Week View</TabsTrigger>
          </TabsList>

          <TabsContent value="month" className="space-y-6">
            {/* Color Legend */}
            <Card className="shadow-md border-slate-200">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm font-semibold text-slate-700">Calendar Key:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-amber-100 border border-amber-200"></div>
                    <span className="text-sm text-slate-600">Loading (Scheduled)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-orange-100 border border-orange-200"></div>
                    <span className="text-sm text-slate-600">Loading (Completed)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-100 border border-red-200"></div>
                    <span className="text-sm text-slate-600">Pending Order</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-100 border border-blue-200"></div>
                    <span className="text-sm text-slate-600">Scheduled Delivery</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200"></div>
                    <span className="text-sm text-slate-600">Delivered</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2">
                  <span className="text-sm font-semibold text-slate-700">Other:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-violet-100 border border-violet-300"></div>
                    <span className="text-sm text-slate-600">Non-Delivery Event (inspection, maintenance, crane work, etc.)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    {format(currentMonth, 'MMMM yyyy')}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleNextMonth}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-semibold text-sm text-slate-600 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, index) => {
                    const dayDeliveries = getDeliveriesForDay(day);
                    const dayLoadingEvents = getLoadingEventsForDay(day);
                    const dayPendingOrders = getPendingOrdersForDay(day);
                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                    const isTodayDate = isToday(day);
                    const isSelected = selectedDay && isSameDay(day, selectedDay);

                    const dayTotalGallons = dayDeliveries.reduce((sum, d) => sum + (d.gallons_delivered || 0), 0);

                    const allDayItems = [
                      ...dayDeliveries.map(d => ({ type: 'delivery', item: d, time: d.requested_delivery_time })),
                      ...dayLoadingEvents.map(e => ({ type: 'loading', item: e, time: e.scheduled_time })),
                      ...dayPendingOrders.map(o => ({ type: 'pending_order', item: o, time: o.requested_time })),
                    ].sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));

                    return (
                      <div
                        key={index}
                        onClick={() => setSelectedDay(day)}
                        className={`
                          min-h-24 p-2 border rounded-lg cursor-pointer transition-all duration-200
                          ${isCurrentMonth ? 'bg-white' : 'bg-slate-50'}
                          ${isTodayDate ? 'border-blue-500 border-2' : 'border-slate-200'}
                          ${isSelected ? 'ring-2 ring-orange-500' : ''}
                          ${(allDayItems.length > 0) ? 'hover:shadow-md' : 'hover:bg-slate-50'}
                        `}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className={`text-sm font-medium ${
                            isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
                          }`}>
                            {format(day, 'd')}
                          </div>
                          {dayTotalGallons > 0 && (
                            <div className="text-[10px] font-semibold text-blue-600">
                              {dayTotalGallons.toLocaleString()} gal
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          {allDayItems.slice(0, 3).map((item, itemIdx) => {
                            if (item.type === 'delivery') {
                              const isNonDelivery = item.item.event_type && item.item.event_type !== 'delivery';
                              return (
                                <div
                                  key={item.item.id}
                                  className={`text-xs p-1 rounded truncate ${isNonDelivery ? 'bg-violet-100 text-violet-800' : calendarItemColors[item.item.status]}`}
                                >
                                  <Anchor className="w-3 h-3 inline mr-1" />
                                  {item.item.requested_delivery_time && (
                                    <span className="font-semibold">{item.item.requested_delivery_time} </span>
                                  )}
                                  {item.item.vessel_name}
                                </div>
                              );
                            } else if (item.type === 'loading') {
                              const bgColor = item.item.status === 'completed' 
                                ? 'bg-orange-100 text-orange-800' 
                                : 'bg-amber-100 text-amber-800';
                              return (
                                <div
                                  key={item.item.id}
                                  className={`text-xs p-1 rounded truncate ${bgColor}`}
                                >
                                  <Droplet className="w-3 h-3 inline mr-1" />
                                  {item.item.scheduled_time && (
                                    <span className="font-semibold">{item.item.scheduled_time} </span>
                                  )}
                                  Load {item.item.barge_name}
                                </div>
                              );
                            } else if (item.type === 'pending_order') {
                              return (
                                <div
                                  key={item.item.id}
                                  className="text-xs p-1 rounded truncate bg-red-100 text-red-800"
                                >
                                  <CalendarIcon className="w-3 h-3 inline mr-1" />
                                  {item.item.requested_time && (
                                    <span className="font-semibold">{item.item.requested_time} </span>
                                  )}
                                  {item.item.vessel_name || item.item.customer}
                                </div>
                              );
                            }
                            return null;
                          })}
                          {(allDayItems.length > 3) && (
                            <div className="text-xs text-slate-500 font-medium">
                              +{allDayItems.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Day Details */}
            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-xl font-bold text-slate-900">
                  {selectedDay ? format(selectedDay, 'MMMM d, yyyy') : 'Select a date'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {selectedDay && dayDeliveries.length === 0 && dayLoadingEvents.length === 0 && dayPendingOrders.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <Ship className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No activities scheduled</p>
                  </div>
                )}
                {selectedDay && (dayDeliveries.length > 0 || dayLoadingEvents.length > 0 || dayPendingOrders.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Pending Orders */}
                    {dayPendingOrders.map((order) => (
                      <div
                        key={order.id}
                        className="p-3 border-2 border-red-200 bg-red-50 rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-red-600" />
                            <span className="font-bold text-slate-900">
                              Pending Order: {order.vessel_name || order.customer}
                            </span>
                          </div>
                          <Badge className={`${statusColors.pending} border text-xs`}>
                            Pending
                          </Badge>
                        </div>
                        {order.requested_time && (
                          <div className="text-sm font-semibold text-red-700 mb-2">
                            Requested Time: {order.requested_time}
                          </div>
                        )}
                        <div className="space-y-1 text-sm text-slate-600">
                          {order.market && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3 h-3" />
                              <span>{order.market}</span>
                            </div>
                          )}
                          {order.product_type && (
                            <div className="text-slate-700">Product: {order.product_type}</div>
                          )}
                          {order.gallons && (
                            <div className="font-semibold text-slate-900 mt-1">
                              {order.gallons.toLocaleString()} gallons
                            </div>
                          )}
                          {order.notes && (
                            <div className="text-xs text-slate-500 mt-1">Notes: {order.notes}</div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Loading Events */}
                    {dayLoadingEvents.map((event) => (
                      <div
                        key={event.id}
                        className="p-3 border-2 border-amber-200 bg-amber-50 rounded-lg"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Droplet className="w-4 h-4 text-amber-600" />
                            <span className="font-bold text-slate-900">
                              Loading: {event.barge_name}
                            </span>
                          </div>
                          <Badge className={`${loadingEventColors[event.status]} border text-xs`}>
                            {event.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        {event.scheduled_time && (
                          <div className="text-sm font-semibold text-amber-700 mb-2">
                            Time: {event.scheduled_time}
                          </div>
                        )}
                        <div className="space-y-1 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            <span>{event.terminal_location}</span>
                          </div>
                          {event.product_type && (
                            <div className="text-slate-700">Product: {event.product_type}</div>
                          )}
                          {event.gallons_to_load && (
                            <div className="font-semibold text-slate-900 mt-1">
                              {event.gallons_to_load.toLocaleString()} gallons
                            </div>
                          )}
                          {event.is_truck_loading && (
                            <Badge className="bg-blue-100 text-blue-800 text-xs mt-1">
                              Truck Loading
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Deliveries */}
                    {dayDeliveries.map((delivery) => {
                      const crewList = getCrewList(delivery);
                      return (
                        <div
                          key={delivery.id}
                          className="p-3 border border-slate-200 rounded-lg hover:shadow-md transition-shadow duration-200"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Anchor className="w-4 h-4 text-blue-600" />
                              <span className="font-bold text-slate-900">
                                {delivery.vessel_name}
                              </span>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              <Badge className={`${statusColors[delivery.status]} border text-xs`}>
                                {delivery.status.replace('_', ' ')}
                              </Badge>
                              {delivery.is_outside_tow && (
                                <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200 text-xs flex items-center gap-1">
                                  <Waves className="w-3 h-3" />
                                  Outside
                                </Badge>
                              )}
                            </div>
                          </div>
                          {delivery.requested_delivery_time && (
                            <div className="text-sm font-semibold text-blue-600 mb-2">
                              Requested Time: {delivery.requested_delivery_time}
                            </div>
                          )}
                          {delivery.cargo_type && (
                            <div className="text-sm mb-2">
                              <span className="font-medium text-slate-700">Product: </span>
                              <span className="text-slate-900 font-semibold">{delivery.cargo_type}</span>
                            </div>
                          )}
                          <div className="space-y-1 text-sm text-slate-600">
                            <div className="text-slate-500 uppercase text-xs">{delivery.barge_name}</div>
                            {delivery.market && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3 h-3" />
                                <span>{delivery.market}</span>
                              </div>
                            )}
                            {delivery.tug_name && (
                              <div className="flex items-center gap-2">
                                <Ship className="w-3 h-3" />
                                <span>
                                  Tug: {delivery.tug_name}
                                  {delivery.is_third_party_towing && (
                                    <span className="ml-1 text-purple-600 font-medium">(3rd Party)</span>
                                  )}
                                </span>
                              </div>
                            )}
                            <div>→ {delivery.destination}</div>
                            {crewList.length > 0 && (
                              <div className="flex items-start gap-2 pt-1">
                                <Users className="w-3 h-3 mt-0.5" />
                                <div>
                                  <span className="font-medium text-slate-700">Crew: </span>
                                  <span className="text-slate-600">{crewList.join(', ')}</span>
                                </div>
                              </div>
                            )}
                            {delivery.gallons_delivered && (
                              <div className="font-semibold text-slate-900 mt-2">
                                {delivery.gallons_delivered.toLocaleString()} gallons
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="week" className="space-y-6">
            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    Week of {format(weekStartDate, 'MMM d')} - {format(addDays(weekStartDate, 6), 'MMM d, yyyy')}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportWeekView}>
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleToday}>
                      Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={handlePreviousWeek}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleNextWeek}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 overflow-x-auto">
                {Object.keys(weekDeliveriesByBarge).length === 0 && Object.keys(weekLoadingEventsByBarge).length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No activities scheduled this week</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Combine all unique barges from both deliveries and loading events */}
                    {[...new Set([...Object.keys(weekDeliveriesByBarge), ...Object.keys(weekLoadingEventsByBarge)])].map(bargeName => {
                      const dateGroups = weekDeliveriesByBarge[bargeName] || {};
                      const loadingDateGroups = weekLoadingEventsByBarge[bargeName] || {};
                      
                      return (
                        <div key={bargeName} className="border-2 border-slate-300 rounded-lg overflow-hidden">
                          {/* Barge Header */}
                          <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-4 py-3">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                              <Ship className="w-5 h-5" />
                              {bargeName}
                            </h3>
                          </div>

                          {/* Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-slate-100">
                                  <th className="border border-slate-300 px-3 py-2 text-left text-sm font-bold text-slate-700 w-32 bg-slate-50">
                                    DATE
                                  </th>
                                  {weekDays.map((day, dayIndex) => (
                                    <th
                                      key={format(day, 'yyyy-MM-dd')}
                                      className={`border border-slate-300 px-3 py-2 text-center text-sm font-bold ${
                                        isToday(day)
                                          ? 'bg-blue-100 text-blue-900'
                                          : dayIndex % 2 === 0
                                          ? 'bg-slate-100 text-slate-700'
                                          : 'bg-white text-slate-700'
                                      }`}
                                    >
                                      <div>{format(day, 'MM/dd/yyyy')}</div>
                                      <div className="text-xs font-semibold">{format(day, 'EEEE')}</div>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {/* Loading Events Row */}
                                <tr className="bg-amber-50">
                                  <td className="border border-slate-300 px-3 py-2 bg-amber-100 text-xs font-bold text-amber-900">
                                    LOADING EVENTS
                                  </td>
                                  {weekDays.map((day, dayIndex) => {
                                   const dateKey = format(day, 'yyyy-MM-dd');
                                   const loadingEvents = loadingDateGroups[dateKey] || [];

                                   // Check if any loading event has Seana C assigned
                                   const barge = barges.find(b => b.name === bargeName);
                                   const hasSeanaC = barge?.market === 'Oakland' && loadingEvents.some(event => {
                                     return event.tug_name === 'Seana C';
                                   });

                                   return (
                                     <td
                                       key={format(day, 'yyyy-MM-dd')}
                                       className={`px-3 py-2 text-xs ${
                                         isToday(day)
                                           ? 'bg-amber-100'
                                           : 'bg-amber-50'
                                       }`}
                                       style={{
                                         border: hasSeanaC ? '3px solid #dc2626' : '1px solid #cbd5e1',
                                         position: 'relative'
                                       }}
                                     >
                                        {loadingEvents.map((event, idx) => (
                                          <div key={idx} className="mb-1">
                                            <div className="font-semibold text-red-800">
                                              <Droplet className="w-3 h-3 inline mr-1" />
                                              {event.scheduled_time && `${event.scheduled_time} - `}
                                              {event.terminal_location}
                                            </div>
                                            {event.gallons_to_load && (
                                              <div className="text-red-700">
                                                {event.gallons_to_load.toLocaleString()} gal
                                              </div>
                                            )}
                                            {event.product_type && (
                                              <div className="text-red-700 text-xs">{event.product_type}</div>
                                            )}
                                          </div>
                                        ))}
                                      </td>
                                    );
                                  })}
                                </tr>

                                {/* Find max deliveries per day to determine rows needed */}
                                {(() => {
                                  const maxDeliveries = Math.max(
                                    ...weekDays.map(day => {
                                      const dateKey = format(day, 'yyyy-MM-dd');
                                      return dateGroups[dateKey]?.length || 0;
                                    }),
                                    1
                                  );

                                  return Array.from({ length: maxDeliveries }).map((_, runIndex) => (
                                    <React.Fragment key={runIndex}>
                                      {/* Vessel Name Row */}
                                      <tr>
                                        <td className="border border-slate-300 px-3 py-2 bg-slate-50 text-xs font-bold text-slate-700">
                                          VESSEL NAME - {runIndex + 1}{runIndex === 0 ? 'ST' : runIndex === 1 ? 'ND' : runIndex === 2 ? 'RD' : 'TH'} RUN
                                        </td>
                                        {weekDays.map((day, dayIndex) => {
                                          const dateKey = format(day, 'yyyy-MM-dd');
                                          const delivery = dateGroups[dateKey]?.[runIndex];
                                          return (
                                            <td
                                              key={format(day, 'yyyy-MM-dd')}
                                              className={`border border-slate-300 px-3 py-2 text-sm font-bold ${
                                                isToday(day)
                                                  ? 'bg-blue-50'
                                                  : dayIndex % 2 === 0
                                                  ? 'bg-slate-50'
                                                  : 'bg-white'
                                              }`}
                                            >
                                              {delivery?.vessel_name || ''}
                                            </td>
                                          );
                                        })}
                                      </tr>

                                      {/* Sage Order Number Row */}
                                      <tr>
                                        <td className="border border-slate-300 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                                          SAGE ORDER #
                                        </td>
                                        {weekDays.map((day, dayIndex) => {
                                          const dateKey = format(day, 'yyyy-MM-dd');
                                          const delivery = dateGroups[dateKey]?.[runIndex];
                                          return (
                                            <td
                                              key={format(day, 'yyyy-MM-dd')}
                                              className={`border border-slate-300 px-3 py-2 text-xs font-semibold ${
                                                isToday(day)
                                                  ? 'bg-blue-50'
                                                  : dayIndex % 2 === 0
                                                  ? 'bg-slate-50'
                                                  : 'bg-white'
                                              }`}
                                            >
                                              {delivery?.sage_order_number || ''}
                                            </td>
                                          );
                                        })}
                                      </tr>

                                      {/* Product Row */}
                                      <tr>
                                        <td className="border border-slate-300 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                                          PRODUCT
                                        </td>
                                        {weekDays.map((day, dayIndex) => {
                                          const dateKey = format(day, 'yyyy-MM-dd');
                                          const delivery = dateGroups[dateKey]?.[runIndex];
                                          return (
                                            <td
                                              key={format(day, 'yyyy-MM-dd')}
                                              className={`border border-slate-300 px-3 py-2 text-xs ${
                                                isToday(day)
                                                  ? 'bg-blue-50'
                                                  : dayIndex % 2 === 0
                                                  ? 'bg-slate-50'
                                                  : 'bg-white'
                                              }`}
                                            >
                                              {delivery?.cargo_type || ''}
                                            </td>
                                          );
                                        })}
                                      </tr>

                                      {/* Gallons Row */}
                                      <tr>
                                        <td className="border border-slate-300 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                                          GALLONS
                                        </td>
                                        {weekDays.map((day, dayIndex) => {
                                          const dateKey = format(day, 'yyyy-MM-dd');
                                          const delivery = dateGroups[dateKey]?.[runIndex];
                                          return (
                                            <td
                                              key={format(day, 'yyyy-MM-dd')}
                                              className={`border border-slate-300 px-3 py-2 text-xs ${
                                                isToday(day)
                                                  ? 'bg-blue-50'
                                                  : dayIndex % 2 === 0
                                                  ? 'bg-slate-50'
                                                  : 'bg-white'
                                              }`}
                                            >
                                              {delivery?.gallons_delivered ? delivery.gallons_delivered.toLocaleString() : ''}
                                            </td>
                                          );
                                        })}
                                      </tr>

                                      {/* Customer Row */}
                                      <tr>
                                        <td className="border border-slate-300 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                                          CUSTOMER
                                        </td>
                                        {weekDays.map((day, dayIndex) => {
                                          const dateKey = format(day, 'yyyy-MM-dd');
                                          const delivery = dateGroups[dateKey]?.[runIndex];
                                          return (
                                            <td
                                              key={format(day, 'yyyy-MM-dd')}
                                              className={`border border-slate-300 px-3 py-2 text-xs ${
                                                isToday(day)
                                                  ? 'bg-blue-50'
                                                  : dayIndex % 2 === 0
                                                  ? 'bg-slate-50'
                                                  : 'bg-white'
                                              }`}
                                            >
                                              {delivery?.customer || ''}
                                            </td>
                                          );
                                        })}
                                      </tr>

                                      {/* Agent Row */}
                                      <tr>
                                        <td className="border border-slate-300 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                                          AGENT
                                        </td>
                                        {weekDays.map((day, dayIndex) => {
                                          const dateKey = format(day, 'yyyy-MM-dd');
                                          const delivery = dateGroups[dateKey]?.[runIndex];
                                          return (
                                            <td
                                              key={format(day, 'yyyy-MM-dd')}
                                              className={`border border-slate-300 px-3 py-2 text-xs ${
                                                isToday(day)
                                                  ? 'bg-blue-50'
                                                  : dayIndex % 2 === 0
                                                  ? 'bg-slate-50'
                                                  : 'bg-white'
                                              }`}
                                            >
                                              {delivery?.agent_name || ''}
                                              {delivery?.agent_contact_name && (
                                                <div className="text-slate-600 mt-0.5">{delivery.agent_contact_name}</div>
                                              )}
                                              {delivery?.agent_phone && (
                                                <div className="text-slate-600">{delivery.agent_phone}</div>
                                              )}
                                            </td>
                                          );
                                        })}
                                      </tr>

                                      {/* Notes Row */}
                                      <tr>
                                        <td className="border border-slate-300 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                                          NOTES
                                        </td>
                                        {weekDays.map((day, dayIndex) => {
                                          const dateKey = format(day, 'yyyy-MM-dd');
                                          const delivery = dateGroups[dateKey]?.[runIndex];
                                          const hasNotes = delivery?.notes || delivery?.is_outside_tow;
                                          const baseColor = isToday(day)
                                            ? 'bg-blue-50'
                                            : dayIndex % 2 === 0
                                            ? 'bg-slate-50'
                                            : 'bg-white';
                                          return (
                                            <td
                                              key={format(day, 'yyyy-MM-dd')}
                                              className={`border border-slate-300 px-3 py-2 text-xs ${
                                                hasNotes ? 'bg-yellow-50 text-yellow-900 font-semibold' : baseColor
                                              }`}
                                            >
                                              {delivery?.notes || ''}
                                              {delivery?.is_outside_tow && (
                                                <span className="text-cyan-700 font-bold block">OUTSIDE TOW</span>
                                              )}
                                            </td>
                                          );
                                        })}
                                      </tr>

                                      {/* Crew Row */}
                                      <tr>
                                        <td className="border border-slate-300 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                                          CREW
                                        </td>
                                        {weekDays.map((day, dayIndex) => {
                                          const dateKey = format(day, 'yyyy-MM-dd');
                                          const delivery = dateGroups[dateKey]?.[runIndex];
                                          const crewList = delivery ? getCrewList(delivery) : [];
                                          return (
                                            <td
                                              key={format(day, 'yyyy-MM-dd')}
                                              className={`border border-slate-300 px-3 py-2 text-xs ${
                                                isToday(day)
                                                  ? 'bg-blue-50'
                                                  : dayIndex % 2 === 0
                                                  ? 'bg-slate-50'
                                                  : 'bg-white'
                                              }`}
                                            >
                                              {crewList.join(', ')}
                                            </td>
                                          );
                                        })}
                                      </tr>

                                      {/* Location Row */}
                                      <tr>
                                        <td className="border border-slate-300 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                                          LOCATION
                                        </td>
                                        {weekDays.map((day, dayIndex) => {
                                          const dateKey = format(day, 'yyyy-MM-dd');
                                          const delivery = dateGroups[dateKey]?.[runIndex];
                                          return (
                                            <td
                                              key={format(day, 'yyyy-MM-dd')}
                                              className={`border border-slate-300 px-3 py-2 text-xs ${
                                                isToday(day)
                                                  ? 'bg-blue-50'
                                                  : dayIndex % 2 === 0
                                                  ? 'bg-slate-50'
                                                  : 'bg-white'
                                              }`}
                                            >
                                              {delivery?.destination || ''}
                                            </td>
                                          );
                                        })}
                                      </tr>

                                      {/* Requested Time Row */}
                                      <tr>
                                        <td className="border border-slate-300 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                                          REQUESTED TIME
                                        </td>
                                        {weekDays.map((day, dayIndex) => {
                                          const dateKey = format(day, 'yyyy-MM-dd');
                                          const delivery = dateGroups[dateKey]?.[runIndex];
                                          return (
                                            <td
                                              key={format(day, 'yyyy-MM-dd')}
                                              className={`border border-slate-300 px-3 py-2 text-xs font-semibold ${
                                                isToday(day)
                                                  ? 'bg-blue-50'
                                                  : dayIndex % 2 === 0
                                                  ? 'bg-slate-50'
                                                  : 'bg-white'
                                              }`}
                                            >
                                              {delivery?.requested_delivery_time || ''}
                                            </td>
                                          );
                                        })}
                                      </tr>

                                      {/* Separator between runs */}
                                      {runIndex < maxDeliveries - 1 && (
                                        <tr>
                                          <td colSpan={8} className="h-1 bg-slate-300"></td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  ));
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}