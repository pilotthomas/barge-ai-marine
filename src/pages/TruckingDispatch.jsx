import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Clock, AlertCircle, Truck, Edit2, Trash2, ChevronDown, Plus, Search, MapPin, Filter } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import TruckProductBadge from "../components/trucking/TruckProductBadge";
import TruckProductLinesEditor from "../components/trucking/TruckProductLinesEditor";
import TruckProductLinesSummary from "../components/trucking/TruckProductLinesSummary";
import TruckCloseOutDialog from "../components/trucking/TruckCloseOutDialog";
import { cleanProductLines, sumGallons, linesFromSalesOrder } from "../components/trucking/productLines";
import { CheckCircle } from "lucide-react";
import { sendDirectDispatchNotification, warnIfNotificationFailed } from "@/lib/orderNotifications";
import { TRUCK_EVENT_TYPES, eventTypeMeta, eventTypeOf, isCustomerDelivery } from "../components/trucking/truckEventTypes";

export default function TruckingDispatch() {
  const [showForm, setShowForm] = useState(false);
  const [editingDispatch, setEditingDispatch] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [recentDispatchesOpen, setRecentDispatchesOpen] = useState(true);
  const [closeOutDispatch, setCloseOutDispatch] = useState(null);
  const formRef = React.useRef(null);

  // The page scrolls inside the layout container (not the window), so bring the form into view explicitly.
  React.useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showForm, editingDispatch]);

  React.useEffect(() => {
    base44.auth.me().then(user => {
      if (user.default_market) {
        setSelectedMarket(user.default_market);
      }
    }).catch(() => {});
  }, []);
  const [formData, setFormData] = useState({
    market: "Richmond CA",
    dispatch_date: "",
    product: "",
    brand: "",
    customer_name: "",
    vessel_name: "",
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

  const queryClient = useQueryClient();

  const { data: dispatches = [] } = useQuery({
    queryKey: ['truckDispatches'],
    queryFn: () => base44.entities.TruckDispatch.list('-dispatch_date'),
  });

  const { data: trucks = [] } = useQuery({
    queryKey: ['trucks'],
    queryFn: () => base44.entities.Truck.list(),
  });

  const { data: crewMembers = [] } = useQuery({
    queryKey: ['crewMembers'],
    queryFn: () => base44.entities.CrewMember.list(),
  });

  const drivers = crewMembers.filter(c => c.position === 'driver' && c.is_active);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => base44.entities.SalesOrder.list('-submitted_date'),
  });

  const pendingTruckOrders = salesOrders.filter(
    order => order.method_of_delivery === 'Truck' && order.status === 'pending' &&
    (selectedMarket === 'all' || order.market === selectedMarket)
  );

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TruckDispatch.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['truckDispatches'] });
      resetForm();
      // Customer deliveries entered directly (not from a Sales Order) notify CA.Orders.
      // Internal transfers and non-delivery events do not.
      if (created && isCustomerDelivery(created)) sendDirectDispatchNotification({ type: 'Truck', dispatch: created }).then(warnIfNotificationFailed);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TruckDispatch.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truckDispatches'] });
      resetForm();
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

  const dispatchOrderMutation = useMutation({
    mutationFn: async ({ order, dispatchData }) => {
      const totalGallons = order.product_lines?.reduce((sum, line) => 
        sum + (parseFloat(line.requested_gallons) || 0), 0
      ) || 0;
      const primaryProduct = order.product_lines?.[0]?.product_type || '';
      
      const dispatch = await base44.entities.TruckDispatch.create({
        ...dispatchData,
        market: order.market,
        dispatch_date: order.requested_date,
        product: primaryProduct,
        customer_name: order.customer_name,
        vessel_name: order.vessel_name,
        gallons: totalGallons,
        product_lines: linesFromSalesOrder(order),
        notes: `From Sales Order - Destination: ${order.destination}. ${order.notes || ''}${order.product_lines?.length > 1 ? ' Multiple products: ' + order.product_lines.map(l => `${l.product_type} (${l.requested_gallons} gal)`).join(', ') : ''}`
      });
      
      await base44.entities.SalesOrder.update(order.id, {
        status: 'dispatched',
        truck_dispatch_id: dispatch.id,
        dispatched_date: new Date().toISOString()
      });

      return dispatch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['truckDispatches'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
  });

  const resetForm = () => {
    setFormData({
      market: "Richmond CA",
      dispatch_date: "",
      product: "",
      brand: "",
      customer_name: "",
      vessel_name: "",
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
    setShowForm(false);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this dispatch?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDispatchOrder = (order, dispatchData) => {
    dispatchOrderMutation.mutate({ order, dispatchData });
  };

  const filteredDispatches = dispatches.filter(d => {
    const matchesSearch = searchTerm === '' || 
      d.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.truck_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.product?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMarket = selectedMarket === 'all' || d.market === selectedMarket;
    
    return matchesSearch && matchesMarket;
  });

  const activeDispatches = filteredDispatches.filter(d => d.status === 'scheduled' || d.status === 'in_transit');

  const calculateTotalGallons = (productLines) => {
    if (!productLines || !Array.isArray(productLines)) return 0;
    return productLines.reduce((sum, line) => sum + (line.requested_gallons || 0), 0);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Trucking Dispatch
            </h1>
            <p className="text-slate-600">Schedule and manage truck deliveries</p>
          </div>
          <Button
            onClick={() => {
              if (showForm && !editingDispatch) {
                resetForm();
                return;
              }
              resetForm();
              setShowForm(true);
            }}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Delivery
          </Button>
        </div>

        {/* Search and Filters */}
        {!showForm && (
          <div className="flex flex-col gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search deliveries by customer, driver, truck, product..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 py-6 text-lg border-slate-200"
              />
            </div>
            
            <div className="flex flex-col md:flex-row gap-4">
              <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                <SelectTrigger className="w-full md:w-64 py-6">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-slate-400" />
                    <SelectValue placeholder="All Markets" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Markets</SelectItem>
                  <SelectItem value="Richmond CA">Richmond CA</SelectItem>
                  <SelectItem value="Rancho Dominguez">Rancho Dominguez</SelectItem>
                  <SelectItem value="Seattle">Seattle</SelectItem>
                  <SelectItem value="Mobile">Mobile (Gulf Coast)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Pending Orders Queue */}
        {pendingTruckOrders.length > 0 && !showForm && (
          <Card className="shadow-lg border-2 border-emerald-300 bg-emerald-50">
            <CardHeader className="border-b border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">
                      Orders Awaiting Dispatch ({pendingTruckOrders.length})
                    </CardTitle>
                    <p className="text-sm text-slate-600">Sales orders ready for scheduling</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4">
                {pendingTruckOrders.map((order) => {
                  const totalGallons = calculateTotalGallons(order.product_lines);
                  
                  return (
                    <Dialog key={order.id}>
                      <div className="p-4 bg-white rounded-lg border-2 border-emerald-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              <h3 className="font-bold text-lg text-slate-900">{order.customer_name}</h3>
                              {order.priority === 'urgent' && (
                                <Badge className="bg-red-100 text-red-800 border-red-200">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  URGENT
                                </Badge>
                              )}
                              {order.requested_time && (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-mono">
                                  {order.requested_time}
                                </Badge>
                              )}
                            </div>
                            <div className="grid md:grid-cols-3 gap-3 text-sm text-slate-600">
                              <div><span className="font-medium">Vessel:</span> {order.vessel_name}</div>
                              <div><span className="font-medium">Destination:</span> {order.destination}</div>
                              <div><span className="font-medium">Market:</span> {order.market}</div>
                              {order.product_lines && order.product_lines.length > 0 && (
                                <div>
                                  <span className="font-medium">Products:</span>{' '}
                                  {order.product_lines.map(line => line.product_type).filter(Boolean).join(', ')}
                                </div>
                              )}
                              {totalGallons > 0 && (
                                <div><span className="font-medium">Gallons:</span> {totalGallons.toLocaleString()}</div>
                              )}
                              <div>
                                <span className="font-medium">Requested:</span>{' '}
                                {order.requested_date ? format(parseISO(order.requested_date), 'MMM d, yyyy') : 'TBD'}
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-slate-600">
                              <span className="font-medium">Submitted by:</span> {order.submitted_by_name} on{' '}
                              {order.submitted_date ? format(parseISO(order.submitted_date), 'MMM d, yyyy') : '—'}
                            </div>
                            {order.notes && (
                              <div className="mt-2 pt-2 border-t border-slate-100 text-sm text-slate-700">
                                <span className="font-medium">Notes:</span> {order.notes}
                              </div>
                            )}
                          </div>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              Dispatch Order
                            </Button>
                          </DialogTrigger>
                        </div>
                      </div>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-2xl">Dispatch Order: {order.customer_name}</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          handleDispatchOrder(order, formData);
                        }} className="space-y-4 mt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Truck</Label>
                              <Select
                                value={formData.truck_id}
                                onValueChange={(value) => {
                                  const truck = trucks.find(t => t.id === value);
                                  setFormData({ 
                                    ...formData, 
                                    truck_id: value,
                                    truck_number: truck?.truck_number || ''
                                  });
                                }}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select truck" />
                                </SelectTrigger>
                                <SelectContent>
                                  {trucks.filter(t => t.market === order.market && t.status !== 'retired').map((truck) => (
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
                                  {drivers.filter(d => d.market === order.market).map((driver) => (
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
                                  <SelectItem value="BULK">BULK</SelectItem>
                                  <SelectItem value="PTL BLENDING">PTL BLENDING</SelectItem>
                                  <SelectItem value="PICKUP">PICKUP</SelectItem>
                                  <SelectItem value="BOX TRAILER">BOX TRAILER</SelectItem>
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
                          </div>

                          <div className="flex justify-end gap-3">
                            <Button type="button" variant="outline" onClick={() => resetForm()}>
                              Cancel
                            </Button>
                            <Button 
                              type="submit"
                              disabled={dispatchOrderMutation.isPending}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              {dispatchOrderMutation.isPending ? 'Dispatching...' : 'Dispatch Order'}
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Dispatches */}
        {activeDispatches.length > 0 && !showForm && (
          <Card className="shadow-lg border-2 border-blue-300 bg-blue-50">
            <CardHeader className="border-b border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">
                    Active Deliveries ({activeDispatches.length})
                  </CardTitle>
                  <p className="text-sm text-slate-600">Scheduled and in progress</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4">
                {activeDispatches.map((dispatch) => (
                  <div
                    key={dispatch.id}
                    className="p-4 bg-white rounded-lg border-2 border-blue-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-bold text-xl text-slate-900">{dispatch.customer_name}</h3>
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            {dispatch.status}
                          </Badge>
                          {!isCustomerDelivery(dispatch) && (
                            <Badge className={`${eventTypeMeta(dispatch).badge} border`}>{eventTypeMeta(dispatch).short}</Badge>
                          )}
                          {dispatch.product && (
                            <TruckProductBadge productName={dispatch.product} brand={dispatch.brand} />
                          )}
                        </div>
                        <div className="grid md:grid-cols-3 gap-2 text-sm text-slate-600 mb-3">
                          <div><span className="font-medium">Market:</span> {dispatch.market}</div>
                          {dispatch.vessel_name && (
                            <div><span className="font-medium">Vessel:</span> {dispatch.vessel_name}</div>
                          )}
                          <div><span className="font-medium">Driver:</span> {dispatch.driver_name || 'TBD'}</div>
                          <div><span className="font-medium">Truck:</span> {dispatch.truck_number || 'TBD'}</div>
                          <div><span className="font-medium">Date:</span> {dispatch.dispatch_date ? format(parseISO(dispatch.dispatch_date), 'MMM d, yyyy') : 'TBD'}</div>
                          {dispatch.so_number && (
                            <div><span className="font-medium">SO#:</span> {dispatch.so_number}</div>
                          )}
                          {dispatch.bol_number && (
                            <div><span className="font-medium">BOL#:</span> {dispatch.bol_number}</div>
                          )}
                        </div>
                        <TruckProductLinesSummary lines={dispatch.product_lines} className="max-w-xl" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-900">
                            {dispatch.gallons ? dispatch.gallons.toLocaleString() : 'TBD'}
                          </p>
                          <p className="text-xs text-slate-500 uppercase">Gallons</p>
                        </div>
                        <Button
                          onClick={() => setCloseOutDispatch(dispatch)}
                          className="bg-gradient-to-r from-emerald-600 to-emerald-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Close Out
                        </Button>
                        <Button
                          onClick={() => handleEdit(dispatch)}
                          className="bg-gradient-to-r from-blue-600 to-blue-700"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(dispatch.id)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form Dialog */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              ref={formRef}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="shadow-lg border-slate-200">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    {editingDispatch ? 'Edit Dispatch' : 'New Dispatch'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
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
                        <p className="text-xs text-slate-500 mt-1">Only customer deliveries count toward sales volume and send an order notification.</p>
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
                            <SelectItem value="Mobile">Mobile (Gulf Coast)</SelectItem>
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
                              <SelectItem value="Lenol">Lenol</SelectItem>
                              <SelectItem value="PTL Wholesale">PTL Wholesale</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div>
                        <Label>Customer Name</Label>
                        <Input
                          value={formData.customer_name}
                          onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <Label>Vessel Name</Label>
                        <Input
                          value={formData.vessel_name}
                          onChange={(e) => setFormData({ ...formData, vessel_name: e.target.value })}
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
                              truck_number: truck?.truck_number || ''
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
                            <SelectItem value="BULK">BULK</SelectItem>
                            <SelectItem value="PTL BLENDING">PTL BLENDING</SelectItem>
                            <SelectItem value="PICKUP">PICKUP</SelectItem>
                            <SelectItem value="BOX TRAILER">BOX TRAILER</SelectItem>
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
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={resetForm}>
                          Cancel
                        </Button>
                        <Button type="submit">
                          {editingDispatch ? "Update" : "Create"} Dispatch
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Dispatches List */}
        {!showForm && (
          <Collapsible 
            open={recentDispatchesOpen} 
            onOpenChange={setRecentDispatchesOpen}
            className="space-y-2"
          >
            <Card className="shadow-md border-slate-200">
              <CollapsibleTrigger asChild>
                <CardHeader className="border-b border-slate-100 pb-4 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-blue-600" />
                      Recent Dispatches ({filteredDispatches.length})
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="gap-2">
                      {recentDispatchesOpen ? 'Collapse' : 'Expand'}
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${recentDispatchesOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {filteredDispatches.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No dispatches match the current filters</p>
                      </div>
                    ) : (
                      filteredDispatches.map((dispatch) => (
                        <div
                          key={dispatch.id}
                          onClick={() => handleEdit(dispatch)}
                          className="p-4 hover:bg-slate-50 cursor-pointer transition-colors duration-200"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Truck className="w-5 h-5 text-blue-600" />
                                <h4 className="font-bold text-lg text-slate-900">{dispatch.customer_name}</h4>
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200 border text-xs">
                                  {dispatch.status}
                                </Badge>
                                {!isCustomerDelivery(dispatch) && (
                                  <Badge className={`${eventTypeMeta(dispatch).badge} border text-xs`}>{eventTypeMeta(dispatch).short}</Badge>
                                )}
                                {dispatch.closed_out && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 border text-xs">Closed out</Badge>
                                )}
                                {dispatch.product && (
                                  <TruckProductBadge productName={dispatch.product} brand={dispatch.brand} />
                                )}
                              </div>
                              <div className="space-y-1 ml-8 text-sm text-slate-600">
                                <div className="text-slate-500 uppercase">{dispatch.market}</div>
                                {dispatch.vessel_name && (
                                  <div>Vessel: {dispatch.vessel_name}</div>
                                )}
                                {dispatch.truck_number && (
                                  <div className="flex items-center gap-2">
                                    <Truck className="w-4 h-4" />
                                    <span>Truck: {dispatch.truck_number}</span>
                                  </div>
                                )}
                                {dispatch.driver_name && (
                                  <div>Driver: {dispatch.driver_name}</div>
                                )}
                                {dispatch.dispatch_date && (
                                  <div className="font-bold">
                                    {format(parseISO(dispatch.dispatch_date), 'MMM d, yyyy')}
                                  </div>
                                )}
                                {dispatch.so_number && (
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-purple-700">SO #:</span>
                                    <span className="font-mono text-purple-900">{dispatch.so_number}</span>
                                  </div>
                                )}
                                <TruckProductLinesSummary lines={dispatch.product_lines} className="max-w-xl pt-1" />
                              </div>
                            </div>
                            {dispatch.gallons && (
                              <div className="text-right">
                                <p className="text-2xl font-bold text-slate-900">
                                  {dispatch.gallons.toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500 uppercase">Gallons</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

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