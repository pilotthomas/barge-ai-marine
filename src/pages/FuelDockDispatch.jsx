import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MilitaryTimeInput from "@/components/ui/MilitaryTimeInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Clock, AlertCircle, Warehouse, Edit2, Trash2, ChevronDown, Plus, Search, MapPin, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { sendDirectDispatchNotification, warnIfNotificationFailed } from "@/lib/orderNotifications";

export default function FuelDockDispatch() {
  const [showForm, setShowForm] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [recentDeliveriesOpen, setRecentDeliveriesOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const formRef = React.useRef(null);

  // The page scrolls inside the layout container (not the window), so bring the form into view explicitly.
  React.useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showForm, editingDelivery]);

  React.useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);
      if (user.default_market) {
        setSelectedMarket(user.default_market);
      }
    }).catch(() => {});
  }, []);
  const [formData, setFormData] = useState({
    event_type: 'delivery',
    market: '',
    fuel_dock_location: '',
    vessel_name: '',
    customer: '',
    cargo_type: '',
    gallons_delivered: '',
    delivery_date: '',
    requested_delivery_time: '',
    status: 'scheduled',
    storage_tank_id: '',
    sage_order_number: '',
    entered_in_sage: false,
    paperwork_sent_to_billing: false,
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: deliveries = [] } = useQuery({
    queryKey: ['fuel-dock-deliveries'],
    queryFn: () => base44.entities.FuelDockDelivery.list('-delivery_date'),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const { data: storageTanks = [] } = useQuery({
    queryKey: ['storage-tanks'],
    queryFn: () => base44.entities.StorageTank.list(),
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => base44.entities.SalesOrder.list('-submitted_date'),
  });

  const pendingFuelDockOrders = salesOrders.filter(
    order => order.method_of_delivery === 'X-Pipe' && order.status === 'pending' &&
    (selectedMarket === 'all' || order.market === selectedMarket)
  );

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FuelDockDelivery.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['fuel-dock-deliveries'] });
      // New customer deliveries notify the configured order-alert recipients.
      if (created && (created.event_type || 'delivery') === 'delivery') {
        sendDirectDispatchNotification({ type: 'X-Pipe', dispatch: created }).then(warnIfNotificationFailed);
      }
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, previousDelivery }) => {
      // Check if status is changing to completed and we have a storage tank linked
      const isCompletingDelivery = previousDelivery.status !== 'completed' && data.status === 'completed';
      const hasStorageTank = data.storage_tank_id || previousDelivery.storage_tank_id;
      const hasGallons = data.gallons_delivered || previousDelivery.gallons_delivered;
      
      // Update the delivery
      const updatedDelivery = await base44.entities.FuelDockDelivery.update(id, data);
      
      // If completing and linked to storage tank, create transaction
      if (isCompletingDelivery && hasStorageTank && hasGallons) {
        const tankId = data.storage_tank_id || previousDelivery.storage_tank_id;
        const gallons = data.gallons_delivered || previousDelivery.gallons_delivered;
        
        // Fetch the tank to get current level
        const tank = storageTanks.find(t => t.id === tankId);
        if (tank) {
          const previousGallons = tank.current_gallons || 0;
          const newGallons = previousGallons - gallons;
          
          // Create transaction
          await base44.entities.StorageTankTransaction.create({
            tank_id: tankId,
            facility_name: tank.facility_name,
            tank_number: tank.tank_number,
            transaction_type: 'truck_out',
            transaction_date: data.delivery_date || previousDelivery.delivery_date,
            gallons: gallons,
            product_type: tank.product_type,
            customer: data.customer || previousDelivery.customer || data.vessel_name || previousDelivery.vessel_name,
            previous_gallons: previousGallons,
            new_gallons: newGallons,
            notes: `Fuel Dock Delivery: ${data.vessel_name || previousDelivery.vessel_name}`
          });
          
          // Update tank level
          await base44.entities.StorageTank.update(tankId, {
            current_gallons: newGallons,
            last_updated: new Date().toISOString()
          });
        }
      }
      
      return updatedDelivery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-dock-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['storage-tanks'] });
      queryClient.invalidateQueries({ queryKey: ['storage-tank-transactions'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FuelDockDelivery.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-dock-deliveries'] });
    },
  });

  const dispatchOrderMutation = useMutation({
    mutationFn: async ({ order, deliveryData }) => {
      const totalGallons = order.product_lines?.reduce((sum, line) => 
        sum + (parseFloat(line.requested_gallons) || 0), 0
      ) || 0;
      const primaryProduct = order.product_lines?.[0]?.product_type || '';
      
      const delivery = await base44.entities.FuelDockDelivery.create({
        ...deliveryData,
        market: order.market,
        vessel_name: order.vessel_name,
        customer: order.customer_name,
        cargo_type: primaryProduct,
        gallons_delivered: totalGallons,
        delivery_date: order.requested_date,
        requested_delivery_time: order.requested_time,
        notes: `From Sales Order - Destination: ${order.destination}. ${order.notes || ''}${order.product_lines?.length > 1 ? ' Multiple products: ' + order.product_lines.map(l => `${l.product_type} (${l.requested_gallons} gal)`).join(', ') : ''}`
      });
      
      await base44.entities.SalesOrder.update(order.id, {
        status: 'dispatched',
        fuel_dock_delivery_id: delivery.id,
        dispatched_date: new Date().toISOString()
      });

      return delivery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-dock-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
  });

  const resetForm = () => {
    setFormData({
      event_type: 'delivery',
      market: '',
      fuel_dock_location: '',
      vessel_name: '',
      customer: '',
      cargo_type: '',
      gallons_delivered: '',
      delivery_date: '',
      requested_delivery_time: '',
      status: 'scheduled',
      storage_tank_id: '',
      sage_order_number: '',
      entered_in_sage: false,
      paperwork_sent_to_billing: false,
      notes: ''
    });
    setEditingDelivery(null);
    setShowForm(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      gallons_delivered: formData.gallons_delivered ? parseFloat(formData.gallons_delivered) : null
    };
    if (editingDelivery) {
      updateMutation.mutate({ id: editingDelivery.id, data: submitData, previousDelivery: editingDelivery });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (delivery) => {
    setEditingDelivery(delivery);
    setFormData(delivery);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this delivery?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDispatchOrder = (order, deliveryData) => {
    dispatchOrderMutation.mutate({ order, deliveryData });
  };

  const filteredDeliveries = deliveries.filter(d => {
    const matchesSearch = searchTerm === '' || 
      d.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.vessel_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.cargo_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.fuel_dock_location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMarket = selectedMarket === 'all' || d.market === selectedMarket;
    
    return matchesSearch && matchesMarket;
  });

  const activeDeliveries = filteredDeliveries.filter(d => d.status === 'scheduled' || d.status === 'in_progress');

  const calculateTotalGallons = (productLines) => {
    if (!productLines || !Array.isArray(productLines)) return 0;
    return productLines.reduce((sum, line) => sum + (line.requested_gallons || 0), 0);
  };

  const getFuelDockLocation = (market) => {
    const locations = {
      'Seattle': 'Seattle Pier 15',
      'Long Beach': 'LA Berth 258',
      'Oakland': 'P66 Richmond Dock'
    };
    return locations[market] || '';
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Fuel Dock Dispatch
            </h1>
            <p className="text-slate-600">Schedule and manage pipeline deliveries</p>
          </div>
          <Button
            onClick={() => {
              if (showForm && !editingDelivery) {
                resetForm();
                return;
              }
              resetForm();
              setShowForm(true);
            }}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 shadow-lg"
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
                placeholder="Search deliveries by customer, vessel, location, product..."
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
                  <SelectItem value="Seattle">Seattle</SelectItem>
                  <SelectItem value="Long Beach">Long Beach</SelectItem>
                  <SelectItem value="Oakland">Oakland</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Pending Orders Queue */}
        {pendingFuelDockOrders.length > 0 && !showForm && (
          <Card className="shadow-lg border-2 border-emerald-300 bg-emerald-50">
            <CardHeader className="border-b border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">
                      Orders Awaiting Dispatch ({pendingFuelDockOrders.length})
                    </CardTitle>
                    <p className="text-sm text-slate-600">Sales orders ready for scheduling</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4">
                {pendingFuelDockOrders.map((order) => {
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
                                {format(parseISO(order.requested_date), 'MMM d, yyyy')}
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-slate-600">
                              <span className="font-medium">Submitted by:</span> {order.submitted_by_name} on{' '}
                              {format(parseISO(order.submitted_date), 'MMM d, yyyy')}
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
                              <Label>Fuel Dock Location</Label>
                              <Input
                                value={formData.fuel_dock_location || getFuelDockLocation(order.market)}
                                onChange={(e) => setFormData({ ...formData, fuel_dock_location: e.target.value })}
                                placeholder="e.g., Seattle Pier 15"
                                required
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
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
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

        {/* Active Deliveries */}
        {activeDeliveries.length > 0 && !showForm && (
          <Card className="shadow-lg border-2 border-blue-300 bg-blue-50">
            <CardHeader className="border-b border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">
                    Active Deliveries ({activeDeliveries.length})
                  </CardTitle>
                  <p className="text-sm text-slate-600">Scheduled and in progress</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4">
                {activeDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="p-4 bg-white rounded-lg border-2 border-blue-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-bold text-xl text-slate-900">{delivery.vessel_name}</h3>
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            {delivery.status}
                          </Badge>
                          {delivery.gallons_delivered && (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Gallons Recorded
                            </Badge>
                          )}
                        </div>
                        <div className="grid md:grid-cols-3 gap-2 text-sm text-slate-600 mb-3">
                          <div><span className="font-medium">Location:</span> {delivery.fuel_dock_location}</div>
                          <div><span className="font-medium">Product:</span> {delivery.cargo_type || 'TBD'}</div>
                          <div><span className="font-medium">Date:</span> {format(parseISO(delivery.delivery_date), 'MMM d, yyyy')}</div>
                          {delivery.customer && (
                            <div><span className="font-medium">Customer:</span> {delivery.customer}</div>
                          )}
                          {delivery.requested_delivery_time && (
                            <div><span className="font-medium">Requested Time:</span> {delivery.requested_delivery_time}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-900">
                            {delivery.gallons_delivered ? delivery.gallons_delivered.toLocaleString() : 'TBD'}
                          </p>
                          <p className="text-xs text-slate-500 uppercase">Gallons</p>
                        </div>
                        <Button
                          onClick={() => handleEdit(delivery)}
                          className="bg-gradient-to-r from-blue-600 to-blue-700"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDelete(delivery.id)}
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

        {/* Form */}
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
                    {editingDelivery ? 'Edit Delivery' : 'New Delivery'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Event Type Selector */}
                    <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                      <label className="text-base font-semibold mb-3 block">Event Type</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div
                          onClick={() => setFormData({...formData, event_type: 'delivery'})}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            formData.event_type === 'delivery'
                              ? 'border-blue-600 bg-blue-100'
                              : 'border-slate-300 bg-white hover:border-blue-400'
                          }`}
                        >
                          <div className="font-bold text-slate-900">Delivery Event</div>
                          <div className="text-xs text-slate-600 mt-1">Counts towards inventory & analytics</div>
                        </div>
                        <div
                          onClick={() => setFormData({...formData, event_type: formData.event_type !== 'delivery' ? formData.event_type : 'inspection'})}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            formData.event_type !== 'delivery'
                              ? 'border-orange-600 bg-orange-100'
                              : 'border-slate-300 bg-white hover:border-orange-400'
                          }`}
                        >
                          <div className="font-bold text-slate-900">Non-Delivery Event</div>
                          <div className="text-xs text-slate-600 mt-1">Calendar blocking only (inspection, maintenance, etc.)</div>
                        </div>
                      </div>
                      {formData.event_type !== 'delivery' && (
                        <div className="mt-3">
                          <label className="text-sm font-medium mb-1 block">Event Sub-Type</label>
                          <Select
                            value={formData.event_type}
                            onValueChange={(value) => setFormData({...formData, event_type: value})}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="inspection">Inspection</SelectItem>
                              <SelectItem value="compliance">Compliance</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                              <SelectItem value="crane_work">Crane Work</SelectItem>
                              <SelectItem value="other_non_delivery">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {formData.event_type !== 'delivery' && (
                      <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                        <p className="text-sm text-orange-800">
                          <strong>Non-Delivery Event:</strong> This event will appear on the calendar but will NOT count towards inventory tracking or delivery analytics.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Market</Label>
                        <Select
                          value={formData.market}
                          onValueChange={(value) => setFormData({ ...formData, market: value, fuel_dock_location: getFuelDockLocation(value) })}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select market" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Seattle">Seattle</SelectItem>
                            <SelectItem value="Long Beach">Long Beach</SelectItem>
                            <SelectItem value="Oakland">Oakland</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Fuel Dock Location</Label>
                        <Input
                          value={formData.fuel_dock_location}
                          onChange={(e) => setFormData({ ...formData, fuel_dock_location: e.target.value })}
                          placeholder="e.g., Seattle Pier 15"
                          required
                        />
                      </div>

                      <div>
                        <Label>Vessel Name</Label>
                        <Input
                          value={formData.vessel_name}
                          onChange={(e) => setFormData({ ...formData, vessel_name: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <Label>Customer</Label>
                        <Input
                          value={formData.customer}
                          onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label>Product</Label>
                        <Select
                          value={formData.cargo_type}
                          onValueChange={(value) => setFormData({ ...formData, cargo_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.filter(p => p.is_active && (p.delivery_method === 'Marine' || p.delivery_method === 'Both')).map((product) => (
                              <SelectItem key={product.id} value={product.name}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Delivery Date</Label>
                        <Input
                          type="date"
                          value={formData.delivery_date}
                          onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <Label>Requested Time</Label>
                        <MilitaryTimeInput
                          value={formData.requested_delivery_time}
                          onChange={(v) => setFormData({ ...formData, requested_delivery_time: v })}
                        />
                      </div>

                      <div>
                        <Label>Gallons</Label>
                        <Input
                          type="number"
                          value={formData.gallons_delivered}
                          onChange={(e) => setFormData({ ...formData, gallons_delivered: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label>SAGE Order Number</Label>
                        <Input
                          value={formData.sage_order_number}
                          onChange={(e) => setFormData({ ...formData, sage_order_number: e.target.value })}
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
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <Label>Storage Tank (Optional)</Label>
                      <Select
                        value={formData.storage_tank_id}
                        onValueChange={(value) => setFormData({ ...formData, storage_tank_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select tank (auto-deduct on completion)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>None</SelectItem>
                          {storageTanks.map((tank) => (
                            <SelectItem key={tank.id} value={tank.id}>
                              {tank.facility_name} - {tank.tank_number} ({tank.product_type}) - {(tank.current_gallons || 0).toLocaleString()} gal
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 mt-1">
                        When status is changed to "Completed", gallons will be automatically deducted from the selected tank
                      </p>
                    </div>

                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-between pt-4">
                      <div>
                        {editingDelivery && (
                          <Button 
                            type="button" 
                            variant="destructive"
                            onClick={() => {
                              setShowForm(false);
                              handleDelete(editingDelivery.id);
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
                          {editingDelivery ? "Update" : "Create"} Delivery
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Deliveries List */}
        {!showForm && (
          <Collapsible 
            open={recentDeliveriesOpen} 
            onOpenChange={setRecentDeliveriesOpen}
            className="space-y-2"
          >
            <Card className="shadow-md border-slate-200">
              <CollapsibleTrigger asChild>
                <CardHeader className="border-b border-slate-100 pb-4 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Warehouse className="w-5 h-5 text-cyan-600" />
                      Recent Deliveries ({filteredDeliveries.length})
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="gap-2">
                      {recentDeliveriesOpen ? 'Collapse' : 'Expand'}
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${recentDeliveriesOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {filteredDeliveries.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No deliveries match the current filters</p>
                      </div>
                    ) : (
                      filteredDeliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          onClick={() => handleEdit(delivery)}
                          className="p-4 hover:bg-slate-50 cursor-pointer transition-colors duration-200"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Warehouse className="w-5 h-5 text-cyan-600" />
                                <h4 className="font-bold text-lg text-slate-900">{delivery.vessel_name}</h4>
                                <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200 border text-xs">
                                  {delivery.status}
                                </Badge>
                              </div>
                              <div className="space-y-1 ml-8 text-sm text-slate-600">
                                <div className="text-slate-500 uppercase">{delivery.fuel_dock_location}</div>
                                {delivery.cargo_type && (
                                  <div>Product: {delivery.cargo_type}</div>
                                )}
                                {delivery.customer && (
                                  <div>Customer: {delivery.customer}</div>
                                )}
                                {delivery.delivery_date && (
                                  <div className="font-bold">
                                    {format(parseISO(delivery.delivery_date), 'MMM d, yyyy')}
                                  </div>
                                )}
                                {delivery.sage_order_number && (
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-purple-700">SAGE #:</span>
                                    <span className="font-mono text-purple-900">{delivery.sage_order_number}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {delivery.gallons_delivered && (
                              <div className="text-right">
                                <p className="text-2xl font-bold text-slate-900">
                                  {delivery.gallons_delivered.toLocaleString()}
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
      </div>
    </div>
  );
}