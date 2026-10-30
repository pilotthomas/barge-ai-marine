import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Clock, ChevronDown, ChevronUp, AlertTriangle, Copy } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, parseISO } from "date-fns";
import TruckProductBadge from "../components/trucking/TruckProductBadge";
import TruckProductLinesEditor from "../components/trucking/TruckProductLinesEditor";
import TruckProductLinesSummary from "../components/trucking/TruckProductLinesSummary";
import TruckCloseOutDialog from "../components/trucking/TruckCloseOutDialog";
import { cleanProductLines, sumGallons, linesFromSalesOrder } from "../components/trucking/productLines";
import { CheckCircle } from "lucide-react";
import { sendDirectDispatchNotification, warnIfNotificationFailed } from "@/lib/orderNotifications";
import { TRUCK_EVENT_TYPES, eventTypeMeta, eventTypeOf, isCustomerDelivery } from "../components/trucking/truckEventTypes";

export default function TruckDispatch() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingDispatch, setEditingDispatch] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayView, setShowDayView] = useState(false);
  const [dayViewDate, setDayViewDate] = useState(null);
  const [marketFilter, setMarketFilter] = useState("all");
  const [truckTypeFilter, setTruckTypeFilter] = useState("all");
  const [expandedDispatches, setExpandedDispatches] = useState({});
  const [closeOutDispatch, setCloseOutDispatch] = useState(null);
  // True while the form was pre-filled from a Sales Order (that order already emailed CA.Orders).
  const fromSalesOrderRef = React.useRef(false);

  React.useEffect(() => {
    base44.auth.me().then(user => {
      if (user.default_market) {
        setMarketFilter(user.default_market);
      }
    }).catch(() => {});
  }, []);
  const [formData, setFormData] = useState({
    market: "Richmond CA",
    dispatch_date: "",
    product: "",
    brand: "",
    customer_name: "",
    truck_id: "",
    truck_number: "",
    driver_name: "",
    truck_type: "Stakebed",
    so_number: "",
    bol_number: "",
    gallons: "",
    delivery_type: "PACKAGE",
    status: "scheduled",
    notes: "",
    product_lines: [],
    event_type: "delivery"
  });

  const queryClient = useQueryClient();

  const { data: dispatches = [] } = useQuery({
    queryKey: ['truckDispatches'],
    queryFn: () => base44.entities.TruckDispatch.list(),
  });

  const { data: trucks = [] } = useQuery({
    queryKey: ['trucks'],
    queryFn: () => base44.entities.Truck.list(),
  });

  const { data: crewMembers = [] } = useQuery({
    queryKey: ['crewMembers'],
    queryFn: () => base44.entities.CrewMember.list(),
  });

  const drivers = crewMembers.filter(c => (c.positions?.length ? c.positions.includes('driver') : c.position === 'driver') && c.is_active);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => base44.entities.SalesOrder.list(),
  });

  const pendingTruckOrders = salesOrders.filter(
    order => order.method_of_delivery === 'Truck' && order.status === 'pending' &&
    (marketFilter === 'all' || order.market === marketFilter)
  );

  const filteredDispatches = dispatches.filter(dispatch => 
    (marketFilter === 'all' || dispatch.market === marketFilter) &&
    (truckTypeFilter === 'all' || dispatch.truck_type === truckTypeFilter)
  );

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TruckDispatch.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['truckDispatches'] });
      setShowForm(false);
      resetForm();
      // Truck orders entered directly on the Trucking Calendar notify CA.Orders.
      const fromOrder = fromSalesOrderRef.current;
      fromSalesOrderRef.current = false;
      if (created && !fromOrder && isCustomerDelivery(created)) sendDirectDispatchNotification({ type: 'Truck', dispatch: created }).then(warnIfNotificationFailed);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TruckDispatch.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truckDispatches'] });
      setShowForm(false);
      resetForm();
      // Keep day view open if it was open before editing
      if (dayViewDate) {
        setShowDayView(true);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TruckDispatch.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truckDispatches'] });
    },
  });

  const closeOutMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TruckDispatch.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truckDispatches'] });
      setCloseOutDispatch(null);
    },
  });

  const resetForm = () => {
    setFormData({
      market: "Richmond CA",
      dispatch_date: "",
      product: "",
      brand: "",
      customer_name: "",
      truck_id: "",
      truck_number: "",
      driver_name: "",
      truck_type: "BULK",
      so_number: "",
      bol_number: "",
      gallons: "",
      delivery_type: "Package",
      status: "scheduled",
      notes: "",
      product_lines: [],
      event_type: "delivery"
    });
    setEditingDispatch(null);
    setSelectedDay(null);
  };

  const resetFormAndSource = () => {
    fromSalesOrderRef.current = false;
    resetForm();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const product_lines = cleanProductLines(formData.product_lines);
    const lineGallons = sumGallons(product_lines, 'ordered_qty');
    const submitData = {
      ...formData,
      product_lines,
      gallons: formData.gallons ? parseFloat(formData.gallons) : lineGallons
    };
    if (editingDispatch) {
      updateMutation.mutate({ id: editingDispatch.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (dispatch) => {
    setEditingDispatch(dispatch);
    setFormData({ ...dispatch, product_lines: dispatch.product_lines || [], event_type: eventTypeOf(dispatch) });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this dispatch?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDuplicate = (dispatch) => {
    const { id, created_date, updated_date, created_by, ...rest } = dispatch;
    setFormData({
      ...rest,
      dispatch_date: format(new Date(), 'yyyy-MM-dd'),
      so_number: '',
      bol_number: '',
      status: 'scheduled',
      closed_out: false,
      closed_out_date: null,
      closed_out_by_name: null,
      product_lines: (rest.product_lines || []).map(l => ({ ...l, delivered_qty: null })),
    });
    setEditingDispatch(null);
    fromSalesOrderRef.current = false;
    setShowDayView(false);
    setShowForm(true);
  };

  const handleAddDispatch = (date) => {
    fromSalesOrderRef.current = false;
    setSelectedDay(date);
    setFormData({ ...formData, dispatch_date: format(date, 'yyyy-MM-dd') });
    setShowForm(true);
  };

  // Generate calendar days for the month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    calendarDays.push(day);
    day = addDays(day, 1);
  }

  const getDispatchesForDay = (date) => {
    return filteredDispatches.filter(d => isSameDay(parseISO(d.dispatch_date), date));
  };

  const handleDayClick = (date, dayDispatches) => {
    if (dayDispatches.length > 0) {
      setDayViewDate(date);
      setShowDayView(true);
    }
  };

  const handleDispatchFromOrder = (order) => {
    const totalGallons = order.product_lines?.reduce((sum, line) => 
      sum + (parseFloat(line.requested_gallons) || 0), 0
    ) || 0;
    const primaryProduct = order.product_lines?.[0]?.product_type || '';
    
    setFormData({
      market: order.market,
      dispatch_date: order.requested_date,
      product: primaryProduct,
      customer_name: order.customer_name,
      truck_id: "",
      truck_number: "",
      driver_name: "",
      truck_type: "Stakebed",
      so_number: "",
      bol_number: "",
      gallons: totalGallons,
      delivery_type: "Package",
      status: "scheduled",
      product_lines: linesFromSalesOrder(order),
      notes: `From Sales Order - Vessel: ${order.vessel_name}. ${order.notes || ''}`
    });
    fromSalesOrderRef.current = true;
    setShowForm(true);
  };

  const toggleDispatchExpanded = (dispatchId) => {
    setExpandedDispatches(prev => ({
      ...prev,
      [dispatchId]: !prev[dispatchId]
    }));
  };

  const getProductColorClass = (product, brand) => {
    const lowerProduct = product?.toLowerCase() || '';
    const lowerBrand = brand?.toLowerCase() || '';
    
    if (lowerBrand === 'castrol') return { bg: 'bg-emerald-700 border-emerald-800', text: 'text-white', subtext: 'text-emerald-100' };
    if (lowerBrand === 'lukoil') return { bg: 'bg-red-100 border-red-300', text: 'text-gray-900', subtext: 'text-gray-600' };
    if (lowerBrand === 'chevron') return { bg: 'bg-cyan-200 border-cyan-300', text: 'text-gray-900', subtext: 'text-gray-600' };
    if (lowerBrand === 'shell') return { bg: 'bg-yellow-100 border-yellow-300', text: 'text-gray-900', subtext: 'text-gray-600' };
    if (lowerBrand.includes('total')) return { bg: 'bg-purple-200 border-purple-300', text: 'text-gray-900', subtext: 'text-gray-600' };
    if (lowerProduct.includes('blend')) return { bg: 'bg-black border-black', text: 'text-white', subtext: 'text-gray-300' };
    if (lowerProduct.includes('inventory')) return { bg: 'bg-blue-300 border-blue-500', text: 'text-gray-900', subtext: 'text-gray-700' };
    if (lowerProduct.includes('non delivery') || lowerProduct.includes('non-delivery')) return { bg: 'bg-red-300 border-red-500', text: 'text-gray-900', subtext: 'text-gray-700' };
    if (lowerProduct.includes('renewable')) return { bg: 'bg-green-100 border-green-300', text: 'text-gray-900', subtext: 'text-gray-600' };
    if (lowerProduct.includes('def')) return { bg: 'bg-orange-200 border-orange-400', text: 'text-gray-900', subtext: 'text-gray-600' };
    if (lowerProduct.includes('carb')) return { bg: 'bg-orange-100 border-orange-300', text: 'text-gray-900', subtext: 'text-gray-600' };
    if (lowerProduct.includes('gasoline')) return { bg: 'bg-white border-gray-400', text: 'text-gray-900', subtext: 'text-gray-600' };
    if (lowerProduct.includes('uls') || lowerProduct.includes('diesel')) return { bg: 'bg-blue-100 border-blue-300', text: 'text-gray-900', subtext: 'text-gray-600' };
    return { bg: 'bg-gray-100 border-gray-300', text: 'text-gray-900', subtext: 'text-gray-600' };
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-[98%] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Truck Dispatch</h1>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                resetFormAndSource();
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Delivery
            </Button>
            <Select value={truckTypeFilter} onValueChange={setTruckTypeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Truck Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Truck Types</SelectItem>
                <SelectItem value="Stakebed">Stakebed</SelectItem>
                <SelectItem value="Tankwagon">Tankwagon</SelectItem>
                <SelectItem value="Tractor">Tractor</SelectItem>
                <SelectItem value="Truck & Trailer">Truck & Trailer</SelectItem>
                <SelectItem value="Box Truck">Box Truck</SelectItem>
                <SelectItem value="Small Fleet">Small Fleet</SelectItem>
              </SelectContent>
            </Select>
            <Select value={marketFilter} onValueChange={setMarketFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                <SelectItem value="Richmond CA">Richmond CA</SelectItem>
                <SelectItem value="Rancho Dominguez">Rancho Dominguez</SelectItem>
                <SelectItem value="Seattle">Seattle</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-lg font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button onClick={() => setCurrentMonth(new Date())}>
              Today
            </Button>
          </div>
        </div>



        {/* Color Key */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">Product Color Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Lubricant Brands</p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-emerald-700 border-2 border-emerald-800"></div>
                  <span className="text-xs text-gray-700">Castrol</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-cyan-200 border-2 border-cyan-300"></div>
                  <span className="text-xs text-gray-700">Chevron</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-red-100 border-2 border-red-300"></div>
                  <span className="text-xs text-gray-700">Lukoil</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-yellow-100 border-2 border-yellow-300"></div>
                  <span className="text-xs text-gray-700">Shell</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-purple-200 border-2 border-purple-300"></div>
                  <span className="text-xs text-gray-700">Total</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-black border-2 border-black"></div>
                  <span className="text-xs text-gray-700">PTL Blending</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Products</p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-orange-100 border-2 border-orange-300"></div>
                  <span className="text-xs text-gray-700">ULS Diesel</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-white border-2 border-gray-400"></div>
                  <span className="text-xs text-gray-700">Gasoline</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-green-100 border-2 border-green-300"></div>
                  <span className="text-xs text-gray-700">Renewable Diesel</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-orange-200 border-2 border-orange-400"></div>
                  <span className="text-xs text-gray-700">DEF</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Other</p>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-300 border-2 border-blue-500"></div>
                  <span className="text-xs text-gray-700">Inventory Pickup</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-red-300 border-2 border-red-500"></div>
                  <span className="text-xs text-gray-700">Non Delivery Event</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center font-semibold text-gray-700 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, index) => {
            const dayDispatches = getDispatchesForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            
            return (
              <Card 
                key={index} 
                className={`min-h-[140px] ${
                  !isCurrentMonth ? 'bg-gray-100 opacity-50' : 'bg-white'
                } ${isToday ? 'border-2 border-blue-500' : 'border border-gray-200'} ${
                  dayDispatches.length > 0 ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                }`}
                onClick={() => handleDayClick(day, dayDispatches)}
              >
                <CardHeader className="pb-2 pt-2 px-2">
                  <div className="flex items-center justify-between">
                    <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                      {format(day, 'd')}
                    </div>
                    {dayDispatches.length > 0 && (
                      <div className="text-[10px] font-semibold text-blue-600">
                        {dayDispatches.filter(isCustomerDelivery).reduce((sum, d) => sum + (d.gallons || 0), 0).toLocaleString()} gal
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-2 space-y-1">
                  {dayDispatches.map((dispatch) => {
                    const isExpanded = expandedDispatches[dispatch.id];
                    const colors = getProductColorClass(dispatch.product, dispatch.brand);
                    
                    return (
                      <div
                        key={dispatch.id}
                        className={`rounded border ${colors.bg} transition-all`}
                      >
                        <div 
                          className="p-2 cursor-pointer hover:opacity-80"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDispatchExpanded(dispatch.id);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className={`flex-1 flex items-baseline gap-2 text-xs font-semibold ${colors.text}`}>
                              <span>{dispatch.customer_name}</span>
                              {dispatch.gallons && (
                                <span className={`text-[10px] font-normal ${colors.subtext}`}>
                                  - {dispatch.gallons.toLocaleString()} gal
                                </span>
                              )}
                            </div>
                            {isExpanded ? (
                              <ChevronUp className={`w-3 h-3 ${colors.subtext} flex-shrink-0`} />
                            ) : (
                              <ChevronDown className={`w-3 h-3 ${colors.subtext} flex-shrink-0`} />
                            )}
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className={`px-2 pb-2 space-y-1 text-xs border-t border-gray-300`}>
                            <div className="pt-1">
                              <TruckProductBadge productName={dispatch.product} brand={dispatch.brand} className="w-full text-center" />
                            </div>
                            <div className={`${colors.subtext} text-[10px]`}>
                              <span className="font-medium">Market:</span> {dispatch.market}
                            </div>
                            <div className={`${colors.subtext} text-[10px]`}>
                              <span className="font-medium">Driver:</span> {dispatch.driver_name || 'TBD'}
                            </div>
                            <div className={`${colors.subtext} text-[10px]`}>
                              <span className="font-medium">Truck:</span> {dispatch.truck_number || 'TBD'}
                            </div>
                            {dispatch.gallons && (
                              <div className={`font-semibold ${colors.text} text-[11px]`}>
                                {dispatch.gallons.toLocaleString()} gal
                              </div>
                            )}
                            {dispatch.so_number && (
                              <div className={`${colors.subtext} text-[10px]`}>
                                <span className="font-medium">SO#:</span> {dispatch.so_number}
                              </div>
                            )}
                            {dispatch.bol_number && (
                              <div className={`${colors.subtext} text-[10px]`}>
                                <span className="font-medium">BOL#:</span> {dispatch.bol_number}
                              </div>
                            )}
                            <div className="pt-1 mt-1 border-t border-gray-300">
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`w-full h-6 text-[10px] ${colors.text}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(dispatch);
                                }}
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {dayDispatches.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-gray-200">
                      <div className="text-[10px] text-center text-blue-600 font-medium">
                        Click to view all ({dayDispatches.length})
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Daily View Dialog */}
        <Dialog open={showDayView} onOpenChange={setShowDayView}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Dispatches for {dayViewDate && format(dayViewDate, 'EEEE, MMMM d, yyyy')}
              </DialogTitle>
            </DialogHeader>
            {dayViewDate && (
              <div className="space-y-4">
                {/* Closeout Reminder */}
                <Card className="border-2 border-orange-300 bg-orange-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-orange-900 mb-1">Reminder: Close Out Deliveries</h3>
                        <p className="text-sm text-orange-800">
                          After delivery completion, make sure to update each dispatch with:
                        </p>
                        <ul className="text-sm text-orange-800 mt-2 space-y-1 list-disc list-inside">
                          <li><strong>SAGE Order Number</strong></li>
                          <li><strong>BOL Number</strong></li>
                          <li><strong>Actual Quantity Delivered (per product)</strong></li>
                        </ul>
                        <p className="text-xs text-orange-700 mt-2">
                          Click "Close Out" on each dispatch below to enter closeout details.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {getDispatchesForDay(dayViewDate).map((dispatch) => {
                  const needsCloseout = dispatch.status === 'scheduled' || dispatch.status === 'in_transit';
                  const missingFields = [];
                  if (!dispatch.so_number) missingFields.push('SAGE Order #');
                  if (!dispatch.bol_number) missingFields.push('BOL #');
                  if (!dispatch.gallons) missingFields.push('Gallons');
                  if (!dispatch.closed_out && dispatch.status !== 'delivered' && dispatch.status !== 'cancelled') missingFields.push('Delivered quantities');
                  
                  // Determine card color based on status
                  let cardStyle = 'border-gray-300';
                  if (dispatch.status === 'delivered') {
                    cardStyle = 'border-2 border-green-400 bg-green-50';
                  } else if (dispatch.status === 'scheduled') {
                    cardStyle = 'border-2 border-blue-400 bg-blue-50';
                  } else if (dispatch.status === 'in_transit') {
                    cardStyle = 'border-2 border-orange-400 bg-orange-50';
                  } else if (dispatch.status === 'cancelled') {
                    cardStyle = 'border-2 border-gray-400 bg-gray-100';
                  }
                  
                  return (
                    <Card 
                      key={dispatch.id} 
                      className={cardStyle}
                    >
                      <CardContent className="p-4">
                        {needsCloseout && missingFields.length > 0 && (
                          <div className="mb-3 p-2 bg-yellow-100 border border-yellow-300 rounded">
                            <p className="text-xs font-semibold text-yellow-900">
                              ⚠️ Missing: {missingFields.join(', ')}
                            </p>
                          </div>
                        )}
                        <div className="mb-3">
                          <p className="text-sm text-gray-500 mb-2">Product</p>
                          {!isCustomerDelivery(dispatch) && (
                            <span className={`inline-block mb-2 mr-2 px-2 py-0.5 rounded text-xs font-semibold border ${eventTypeMeta(dispatch).badge}`}>{eventTypeMeta(dispatch).short}</span>
                          )}
                          <TruckProductBadge productName={dispatch.product} brand={dispatch.brand} />
                          <TruckProductLinesSummary lines={dispatch.product_lines} className="mt-2" />
                          {dispatch.closed_out && (
                            <p className="text-xs text-emerald-700 mt-1">Closed out{dispatch.closed_out_by_name ? ` by ${dispatch.closed_out_by_name}` : ''}{dispatch.closed_out_date ? ` on ${format(parseISO(dispatch.closed_out_date), 'MMM d, yyyy HH:mm')}` : ''}</p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                            <p className="text-sm text-gray-500">Customer</p>
                            <p className="font-semibold text-gray-900">{dispatch.customer_name}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Market</p>
                            <p className="font-semibold text-gray-900">{dispatch.market}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Driver</p>
                            <p className="font-semibold text-gray-900">{dispatch.driver_name || 'TBD'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Truck</p>
                            <p className="font-semibold text-gray-900">{dispatch.truck_number || 'TBD'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Gallons</p>
                            <p className={`font-semibold ${!dispatch.gallons ? 'text-red-600' : 'text-gray-900'}`}>
                              {dispatch.gallons?.toLocaleString() || '⚠️ MISSING'} {dispatch.gallons ? 'gal' : ''}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 capitalize">{dispatch.status}</p>
                              {missingFields.length > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                                  Not Closed Out
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">SO Number</p>
                            <p className={`font-semibold ${!dispatch.so_number ? 'text-red-600' : 'text-gray-900'}`}>
                              {dispatch.so_number || '⚠️ MISSING'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">BOL Number</p>
                            <p className={`font-semibold ${!dispatch.bol_number ? 'text-red-600' : 'text-gray-900'}`}>
                              {dispatch.bol_number || '⚠️ MISSING'}
                            </p>
                          </div>
                          {dispatch.notes && (
                            <div className="col-span-2">
                              <p className="text-sm text-gray-500">Notes</p>
                              <p className="text-gray-900">{dispatch.notes}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                          {dispatch.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => setCloseOutDispatch(dispatch)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              {dispatch.closed_out ? 'Edit Close Out' : 'Close Out'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDuplicate(dispatch)}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Duplicate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleEdit(dispatch);
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setShowDayView(false);
                              handleDelete(dispatch.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showForm} onOpenChange={(open) => {
          setShowForm(open);
          if (!open) resetFormAndSource();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingDispatch ? "Edit Dispatch" : "New Dispatch"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Event Type</Label>
                  <Select
                    value={formData.event_type || 'delivery'}
                    onValueChange={(value) => setFormData({ ...formData, event_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRUCK_EVENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">Only customer deliveries count toward sales volume and send an order notification.</p>
                </div>

                <div>
                  <Label>Market</Label>
                  <Select
                    value={formData.market}
                    onValueChange={(value) => setFormData({ ...formData, market: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Richmond CA">Richmond CA</SelectItem>
                      <SelectItem value="Rancho Dominguez">Rancho Dominguez</SelectItem>
                      <SelectItem value="Seattle">Seattle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Dispatch Date</Label>
                  <Input
                    type="date"
                    value={formData.dispatch_date}
                    onChange={(e) => setFormData({ ...formData, dispatch_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Product</Label>
                  <Select
                    value={formData.product}
                    onValueChange={(value) => setFormData({ ...formData, product: value, brand: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.filter(p => p.is_active && (p.delivery_method === 'Trucking' || p.delivery_method === 'Both')).map((product) => (
                        <SelectItem key={product.id} value={product.name}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.product && formData.product.toLowerCase().includes('lubricant') && (
                  <div>
                    <Label>Brand</Label>
                    <Select
                      value={formData.brand || ''}
                      onValueChange={(value) => setFormData({ ...formData, brand: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select brand" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Castrol">Castrol</SelectItem>
                        <SelectItem value="Chevron">Chevron</SelectItem>
                        <SelectItem value="Shell">Shell</SelectItem>
                        <SelectItem value="Total Lubmarine">Total Lubmarine</SelectItem>
                        <SelectItem value="Lukoil">Lukoil</SelectItem>
                        <SelectItem value="PTL Wholesale">PTL Wholesale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className={formData.product && formData.product.toLowerCase().includes('lubricant') ? '' : 'col-span-2'}>
                  <Label>Customer Name</Label>
                  <Input
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>Truck</Label>
                  <Select
                    value={formData.truck_id}
                    onValueChange={(value) => {
                      const truck = trucks.find(t => t.id === value);
                      setFormData({ 
                        ...formData, 
                        truck_id: value,
                        truck_number: truck?.truck_number || '',
                        truck_type: truck?.truck_type || formData.truck_type
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select truck" />
                    </SelectTrigger>
                    <SelectContent>
                      {trucks.filter(t => t.market === formData.market && t.status !== 'retired').map((truck) => (
                        <SelectItem key={truck.id} value={truck.id}>
                          {truck.truck_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Driver</Label>
                  <Select
                    value={formData.driver_name}
                    onValueChange={(value) => setFormData({ ...formData, driver_name: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.filter(d => d.market === formData.market).map((driver) => (
                        <SelectItem key={driver.id} value={driver.full_name}>
                          {driver.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Truck Type</Label>
                  <Select
                    value={formData.truck_type}
                    onValueChange={(value) => setFormData({ ...formData, truck_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Stakebed">Stakebed</SelectItem>
                      <SelectItem value="Tankwagon">Tankwagon</SelectItem>
                      <SelectItem value="Tractor">Tractor</SelectItem>
                      <SelectItem value="Truck & Trailer">Truck & Trailer</SelectItem>
                      <SelectItem value="Box Truck">Box Truck</SelectItem>
                      <SelectItem value="Small Fleet">Small Fleet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Delivery Type</Label>
                  <Select
                    value={formData.delivery_type}
                    onValueChange={(value) => setFormData({ ...formData, delivery_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bulk">Bulk</SelectItem>
                      <SelectItem value="Package">Package</SelectItem>
                      <SelectItem value="Load Barge">Load Barge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>SO Number</Label>
                  <Input
                    value={formData.so_number}
                    onChange={(e) => setFormData({ ...formData, so_number: e.target.value })}
                  />
                </div>

                <div>
                  <Label>BOL Number</Label>
                  <Input
                    value={formData.bol_number}
                    onChange={(e) => setFormData({ ...formData, bol_number: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Gallons</Label>
                  <Input
                    type="number"
                    value={formData.gallons}
                    onChange={(e) => setFormData({ ...formData, gallons: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <TruckProductLinesEditor
                lines={formData.product_lines}
                onChange={(product_lines) => setFormData({ ...formData, product_lines })}
                showDelivered={!!editingDispatch}
              />

              <div>
                <Label>Notes</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-between pt-4">
                <div>
                  {editingDispatch && (
                    <Button 
                      type="button" 
                      variant="destructive"
                      onClick={() => {
                        setShowForm(false);
                        handleDelete(editingDispatch.id);
                        if (dayViewDate) {
                          setShowDayView(true);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => {
                    setShowForm(false);
                    resetFormAndSource();
                  }}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingDispatch ? "Update" : "Create"} Dispatch
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <TruckCloseOutDialog
          dispatch={closeOutDispatch}
          open={!!closeOutDispatch}
          onOpenChange={(open) => { if (!open) setCloseOutDispatch(null); }}
          onSave={(data) => closeOutMutation.mutate({ id: closeOutDispatch.id, data })}
          isSaving={closeOutMutation.isPending}
        />
      </div>
    </div>
  );
}