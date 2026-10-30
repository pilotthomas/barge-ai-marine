import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Droplet, MapPin, Ship, Calendar, Edit2, Save, X, CheckCircle, Clock, AlertCircle, CalendarDays, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import FuelDockTankLevels from "@/components/tanks/FuelDockTankLevels";
import { tankLabel } from "@/components/tanks/tankUtils";

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200"
};

export default function FuelDockDeliveries() {
  const [showForm, setShowForm] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dispatchingOrder, setDispatchingOrder] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then(user => {
      if (user.default_market) {
        setSelectedMarket(user.default_market);
      }
    }).catch(() => {});
  }, []);
  const [formData, setFormData] = useState({
    market: '',
    fuel_dock_location: '',
    vessel_name: '',
    customer: '',
    cargo_type: '',
    gallons_delivered: '',
    delivery_date: '',
    requested_delivery_time: '',
    status: 'scheduled',
    paperwork_sent_to_billing: false,
    sage_order_number: '',
    entered_in_sage: false,
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: deliveries = [] } = useQuery({
    queryKey: ['fuel-dock-deliveries'],
    queryFn: () => base44.entities.FuelDockDelivery.list('-delivery_date'),
  });

  const { data: cargoTypes = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => base44.entities.SalesOrder.list('-submitted_date'),
  });

  const { data: storageTanks = [] } = useQuery({
    queryKey: ['storage-tanks'],
    queryFn: () => base44.entities.StorageTank.list(),
  });

  const supplyTanks = storageTanks.filter(t => t.is_fuel_dock_connected && (!formData.market || t.market === formData.market));

  const handleSupplyTankChange = (value) => {
    const tank = storageTanks.find(t => t.id === value);
    setFormData({
      ...formData,
      storage_tank_id: tank ? tank.id : '',
      storage_tank_name: tank ? tank.tank_number : '',
      cargo_type: formData.cargo_type || tank?.product_type || '',
      fuel_dock_location: formData.fuel_dock_location || tank?.fuel_dock_location || '',
    });
  };

  const pendingFuelDockOrders = salesOrders.filter(
    order => order.method_of_delivery === 'X-Pipe' && order.status === 'pending' &&
    (selectedMarket === 'all' || order.market === selectedMarket)
  );

  const activeCargoTypes = cargoTypes.filter(c => c.is_active !== false);

  const filteredDeliveries = selectedMarket === 'all' 
    ? deliveries 
    : deliveries.filter(d => d.market === selectedMarket);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.FuelDockDelivery.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-dock-deliveries'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FuelDockDelivery.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-dock-deliveries'] });
      resetForm();
    },
  });

  const dispatchOrderMutation = useMutation({
    mutationFn: async ({ order, deliveryData }) => {
      const delivery = await base44.entities.FuelDockDelivery.create(deliveryData);
      
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
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FuelDockDelivery.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel-dock-deliveries'] });
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      market: '',
      fuel_dock_location: '',
      vessel_name: '',
      customer: '',
      cargo_type: '',
      gallons_delivered: '',
      delivery_date: '',
      requested_delivery_time: '',
      status: 'scheduled',
      paperwork_sent_to_billing: false,
      sage_order_number: '',
      entered_in_sage: false,
      notes: ''
    });
    setShowForm(false);
    setEditingDelivery(null);
    setDispatchingOrder(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      gallons_delivered: formData.gallons_delivered ? parseFloat(formData.gallons_delivered) : 0
    };
    
    if (editingDelivery) {
      updateMutation.mutate({ id: editingDelivery.id, data: submitData });
    } else if (dispatchingOrder) {
      dispatchOrderMutation.mutate({ order: dispatchingOrder, deliveryData: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (delivery) => {
    setEditingDelivery(delivery);
    setFormData(delivery);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDispatchFromOrder = (order) => {
    const totalGallons = order.product_lines?.reduce((sum, line) => 
      sum + (parseFloat(line.requested_gallons) || 0), 0
    ) || 0;
    const primaryProduct = order.product_lines?.[0]?.product_type || '';
    
    setDispatchingOrder(order);
    setFormData({
      market: order.market,
      fuel_dock_location: 'P66 Richmond Dock',
      vessel_name: order.vessel_name,
      customer: order.customer_name,
      cargo_type: primaryProduct,
      gallons_delivered: totalGallons,
      delivery_date: order.requested_date,
      requested_delivery_time: order.requested_time || '',
      status: 'scheduled',
      paperwork_sent_to_billing: false,
      sage_order_number: '',
      entered_in_sage: false,
      notes: `From Sales Order - X-Pipe Delivery. ${order.notes || ''}`
    });
    setShowForm(true);
  };

  // Generate 24-hour time options
  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeOptions.push(timeString);
    }
  }

  const handleDelete = (delivery) => {
    if (confirm(`Delete delivery for ${delivery.vessel_name}?`)) {
      deleteMutation.mutate(delivery.id);
    }
  };

  // Calendar helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDeliveriesForDay = (day) => {
    return filteredDeliveries
      .filter(d => isSameDay(parseISO(d.delivery_date), day))
      .sort((a, b) => {
        const aTime = a.requested_delivery_time || '';
        const bTime = b.requested_delivery_time || '';
        return aTime.localeCompare(bTime);
      });
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Fuel Dock Deliveries
            </h1>
            <p className="text-slate-600">Pipeline deliveries from shore storage (Seattle Pier 15, LA Berth 258, P66 Richmond Dock)</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Select value={selectedMarket} onValueChange={setSelectedMarket}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select market" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                <SelectItem value="Long Beach">Long Beach</SelectItem>
                <SelectItem value="Oakland">Oakland</SelectItem>
                <SelectItem value="Portland">Portland</SelectItem>
                <SelectItem value="Seattle">Seattle</SelectItem>
                <SelectItem value="Mobile">Mobile (Gulf Coast)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
              className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Fuel Dock Delivery
            </Button>
          </div>
        </div>



        {/* Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="shadow-lg border-slate-200">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    {editingDelivery ? 'Edit Fuel Dock Delivery' : 'New Fuel Dock Delivery'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="market">Market *</Label>
                        <Select
                          value={formData.market}
                          onValueChange={(value) => setFormData({...formData, market: value})}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select market" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Long Beach">Long Beach</SelectItem>
                            <SelectItem value="Oakland">Oakland</SelectItem>
                            <SelectItem value="Portland">Portland</SelectItem>
                            <SelectItem value="Seattle">Seattle</SelectItem>
                            <SelectItem value="Mobile">Mobile (Gulf Coast)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="fuel_dock_location">Fuel Dock Location *</Label>
                        <Select
                          value={formData.fuel_dock_location}
                          onValueChange={(value) => setFormData({...formData, fuel_dock_location: value})}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select fuel dock" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Seattle Pier 15">Seattle Pier 15</SelectItem>
                            <SelectItem value="LA Berth 258">LA Berth 258</SelectItem>
                            <SelectItem value="P66 Richmond Dock">P66 Richmond Dock</SelectItem>
                            <SelectItem value="Mobile Fuel Dock">Mobile Fuel Dock</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="storage_tank_id">Supply Tank</Label>
                        <Select
                          value={formData.storage_tank_id || 'none'}
                          onValueChange={handleSupplyTankChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select shore tank" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No tank / direct pipeline</SelectItem>
                            {supplyTanks.map((tank) => (
                              <SelectItem key={tank.id} value={tank.id}>
                                {tankLabel(tank)} — {(tank.current_gallons || 0).toLocaleString()} gal on hand
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {formData.market && supplyTanks.length === 0 && (
                          <p className="text-xs text-slate-500">No fuel-dock tanks set up for {formData.market} yet.</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vessel_name">Vessel Name *</Label>
                        <Input
                          id="vessel_name"
                          value={formData.vessel_name}
                          onChange={(e) => setFormData({...formData, vessel_name: e.target.value})}
                          placeholder="Vessel name"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="customer">Customer</Label>
                        <Input
                          id="customer"
                          value={formData.customer}
                          onChange={(e) => setFormData({...formData, customer: e.target.value})}
                          placeholder="Customer name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cargo_type">Product Type</Label>
                        <Select
                          value={formData.cargo_type}
                          onValueChange={(value) => setFormData({...formData, cargo_type: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeCargoTypes.map((cargo) => (
                              <SelectItem key={cargo.id} value={cargo.name}>
                                {cargo.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gallons">Gallons Delivered</Label>
                        <Input
                          id="gallons"
                          type="number"
                          value={formData.gallons_delivered}
                          onChange={(e) => setFormData({...formData, gallons_delivered: e.target.value})}
                          placeholder="0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="delivery_date">Delivery Date *</Label>
                        <Input
                          id="delivery_date"
                          type="date"
                          value={formData.delivery_date}
                          onChange={(e) => setFormData({...formData, delivery_date: e.target.value})}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="requested_delivery_time">Requested Time</Label>
                        <Select
                          value={formData.requested_delivery_time}
                          onValueChange={(value) => setFormData({...formData, requested_delivery_time: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {timeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) => setFormData({...formData, status: value})}
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

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="paperwork_sent_to_billing"
                          checked={formData.paperwork_sent_to_billing}
                          onCheckedChange={(checked) => setFormData({...formData, paperwork_sent_to_billing: checked})}
                        />
                        <Label htmlFor="paperwork_sent_to_billing" className="cursor-pointer text-sm font-medium">
                          Paperwork sent to billing
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <Badge className="bg-purple-600 text-white">Sage ERP</Badge>
                        Order Entry Verification
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="sage_order_number">Sage Order Number</Label>
                          <Input
                            id="sage_order_number"
                            value={formData.sage_order_number}
                            onChange={(e) => setFormData({...formData, sage_order_number: e.target.value})}
                            placeholder="Enter Sage order #"
                          />
                        </div>
                        <div className="flex items-end">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="entered_in_sage"
                              checked={formData.entered_in_sage}
                              onCheckedChange={(checked) => setFormData({...formData, entered_in_sage: checked})}
                            />
                            <Label htmlFor="entered_in_sage" className="cursor-pointer text-sm font-medium">
                              Order entered in Sage
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        placeholder="Additional delivery notes..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-between pt-4">
                      <div>
                        {editingDelivery && (
                          <Button 
                            type="button" 
                            variant="destructive" 
                            onClick={() => handleDelete(editingDelivery)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={resetForm}>
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          className="bg-gradient-to-r from-cyan-600 to-cyan-700"
                          disabled={createMutation.isPending || updateMutation.isPending || dispatchOrderMutation.isPending}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {createMutation.isPending || updateMutation.isPending || dispatchOrderMutation.isPending ? 'Saving...' : (editingDelivery ? 'Update' : 'Save')} Delivery
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending Orders */}
        {pendingFuelDockOrders.length > 0 && (
          <Card className="shadow-lg border-red-200 bg-red-50">
            <CardHeader className="border-b border-red-100">
              <CardTitle className="text-xl font-bold text-red-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Pending Orders ({pendingFuelDockOrders.length})
                <span className="text-sm font-normal text-red-700 ml-2">
                  Total: {pendingFuelDockOrders.reduce((sum, o) => {
                    const orderTotal = o.product_lines?.reduce((lineSum, line) => 
                      lineSum + (parseFloat(line.requested_gallons) || 0), 0
                    ) || 0;
                    return sum + orderTotal;
                  }, 0).toLocaleString()} gal
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pendingFuelDockOrders.map((order) => {
                  const totalGallons = order.product_lines?.reduce((sum, line) => 
                    sum + (parseFloat(line.requested_gallons) || 0), 0
                  ) || 0;
                  return (
                    <div
                      key={order.id}
                      className="p-3 bg-white rounded-lg border-2 border-red-200 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleDispatchFromOrder(order)}
                    >
                      <div className="font-semibold text-slate-900 mb-1">{order.vessel_name}</div>
                      <div className="text-sm text-slate-600">{order.customer_name}</div>
                      <div className="text-sm text-slate-600 mt-1">
                        {format(parseISO(order.requested_date), 'MMM d, yyyy')}
                        {order.requested_time && ` at ${order.requested_time}`}
                      </div>
                      <div className="font-bold text-cyan-700 mt-2">{totalGallons.toLocaleString()} gal</div>
                      <Badge className="bg-red-100 text-red-800 border-red-200 text-xs mt-2">
                        Click to Dispatch
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Product Color Key */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700">Product Color Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
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

        {/* Fuel Dock Tank Levels */}
        <FuelDockTankLevels market={selectedMarket} deliveries={filteredDeliveries} month={currentMonth} />

        {/* Calendar View */}
        <Card className="shadow-lg border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-slate-900">
                  {format(currentMonth, 'MMMM yyyy')}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-semibold text-slate-700 text-sm py-2">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, idx) => {
                  const dayDeliveries = getDeliveriesForDay(day);
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const isToday = isSameDay(day, new Date());
                  const dayTotal = dayDeliveries.reduce((sum, d) => sum + (d.gallons_delivered || 0), 0);
                  
                  return (
                    <div
                      key={idx}
                      className={`min-h-[100px] p-2 border rounded-lg ${
                        isCurrentMonth ? 'bg-white' : 'bg-slate-50'
                      } ${isToday ? 'border-cyan-500 border-2' : 'border-slate-200'}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className={`text-sm font-medium ${
                          isToday ? 'text-cyan-600 font-bold' : isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
                        }`}>
                          {format(day, 'd')}
                        </div>
                        {dayTotal > 0 && (
                          <div className="text-[10px] font-semibold text-cyan-600">
                            {dayTotal.toLocaleString()} gal
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayDeliveries.map((delivery) => (
                          <div
                            key={delivery.id}
                            className={`text-xs p-1.5 rounded cursor-pointer hover:shadow-md transition-shadow ${
                              delivery.status === 'scheduled' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                              delivery.status === 'in_progress' ? 'bg-orange-100 text-orange-900 border border-orange-300' :
                              delivery.status === 'completed' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                              'bg-slate-100 text-slate-900 border border-slate-300'
                            }`}
                            onClick={() => handleEdit(delivery)}
                          >
                            <div className="font-semibold truncate">{delivery.vessel_name}</div>
                            <div className="truncate opacity-90">{delivery.fuel_dock_location}</div>
                            {delivery.storage_tank_name && (
                              <div className="truncate text-[10px] opacity-80">Tank: {delivery.storage_tank_name}</div>
                            )}
                            {delivery.gallons_delivered > 0 && (
                              <div className="font-bold text-[10px]">{delivery.gallons_delivered.toLocaleString()} gal</div>
                            )}
                            {delivery.requested_delivery_time && (
                              <div className="text-xs opacity-75">{delivery.requested_delivery_time}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

        {/* Retail Fuel Dock Daily Totals */}
        <RetailFuelDockSection />
      </div>
    </div>
  );
}

// Retail Fuel Dock Daily Totals Component
function RetailFuelDockSection() {
  const [selectedFacility, setSelectedFacility] = useState('Huntington Beach');
  const [editingEntry, setEditingEntry] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [dailyEntry, setDailyEntry] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    gallons: '',
    status: 'operational',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: retailEntries = [] } = useQuery({
    queryKey: ['retail-fuel-dock-daily'],
    queryFn: () => base44.entities.RetailFuelDockDaily.list('-date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RetailFuelDockDaily.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail-fuel-dock-daily'] });
      setDailyEntry({ date: format(new Date(), 'yyyy-MM-dd'), gallons: '', status: 'operational', notes: '' });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RetailFuelDockDaily.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail-fuel-dock-daily'] });
      setEditingEntry(null);
      setDailyEntry({ date: format(new Date(), 'yyyy-MM-dd'), gallons: '', status: 'operational', notes: '' });
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RetailFuelDockDaily.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail-fuel-dock-daily'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const gallons = dailyEntry.status === 'closed' ? 0 : parseFloat(dailyEntry.gallons || 0);
    if (editingEntry) {
      updateMutation.mutate({
        id: editingEntry.id,
        data: {
          facility: selectedFacility,
          date: dailyEntry.date,
          gallons: gallons,
          status: dailyEntry.status,
          notes: dailyEntry.notes
        }
      });
    } else {
      createMutation.mutate({
        facility: selectedFacility,
        date: dailyEntry.date,
        gallons: gallons,
        status: dailyEntry.status,
        notes: dailyEntry.notes
      });
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setSelectedFacility(entry.facility);
    setDailyEntry({
      date: entry.date,
      gallons: entry.gallons.toString(),
      status: entry.status || 'operational',
      notes: entry.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this entry?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setEditingEntry(null);
    setDailyEntry({ date: format(new Date(), 'yyyy-MM-dd'), gallons: '', status: 'operational', notes: '' });
    setShowForm(false);
  };

  // Calculate totals for each facility
  const calculateTotals = (facility, days) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return retailEntries
      .filter(entry => 
        entry.facility === facility && 
        new Date(entry.date) >= cutoffDate
      )
      .reduce((sum, entry) => sum + (entry.gallons || 0), 0);
  };

  const facilities = ['Huntington Beach', 'San Francisco Pier 45', 'Berth 258 - Long Beach', 'Mobile Fuel Dock'];

  return (
    <Card className="shadow-lg border-slate-200">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Droplet className="w-5 h-5 text-cyan-600" />
          Retail Fuel Dock Daily Totals
        </CardTitle>
        <p className="text-sm text-slate-600 mt-1">Track daily gallons for retail-focused facilities</p>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Stats for Each Facility */}
        <div className="grid md:grid-cols-2 gap-4">
          {facilities.map(facility => {
            const last7 = calculateTotals(facility, 7);
            const last30 = calculateTotals(facility, 30);
            const last90 = calculateTotals(facility, 90);

            return (
              <Card key={facility} className="border-cyan-200 bg-gradient-to-br from-white to-cyan-50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-cyan-600" />
                      {facility}
                    </CardTitle>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedFacility(facility);
                        setEditingEntry(null);
                        setDailyEntry({ date: format(new Date(), 'yyyy-MM-dd'), gallons: '', status: 'operational', notes: '' });
                        setShowForm(true);
                      }}
                      className="bg-gradient-to-r from-cyan-600 to-cyan-700"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Entry
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-cyan-100">
                    <span className="text-sm font-medium text-slate-600">Last 7 Days</span>
                    <span className="text-lg font-bold text-cyan-700">{last7.toLocaleString()} gal</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-cyan-100">
                    <span className="text-sm font-medium text-slate-600">Last 30 Days</span>
                    <span className="text-lg font-bold text-cyan-700">{last30.toLocaleString()} gal</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-cyan-100">
                    <span className="text-sm font-medium text-slate-600">Last 90 Days</span>
                    <span className="text-lg font-bold text-cyan-700">{last90.toLocaleString()} gal</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Entry Form Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingEntry ? 'Edit Entry' : 'Add Daily Total'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="facility">Facility</Label>
                <Select value={selectedFacility} onValueChange={setSelectedFacility}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {facilities.map(facility => (
                      <SelectItem key={facility} value={facility}>{facility}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={dailyEntry.date}
                  onChange={(e) => setDailyEntry({...dailyEntry, date: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={dailyEntry.status} onValueChange={(value) => setDailyEntry({...dailyEntry, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operational">Operational</SelectItem>
                      <SelectItem value="closed">Closed for Operation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {dailyEntry.status === 'operational' && (
                  <div className="space-y-2">
                    <Label htmlFor="gallons">Gallons</Label>
                    <Input
                      id="gallons"
                      type="number"
                      step="0.01"
                      value={dailyEntry.gallons}
                      onChange={(e) => setDailyEntry({...dailyEntry, gallons: e.target.value})}
                      placeholder="0"
                      required
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={dailyEntry.notes}
                  onChange={(e) => setDailyEntry({...dailyEntry, notes: e.target.value})}
                  placeholder="Optional notes"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-gradient-to-r from-cyan-600 to-cyan-700"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingEntry ? 'Update' : 'Add Entry'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Recent Entries */}
        {retailEntries.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900">Recent Entries</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {retailEntries.slice(0, 10).map(entry => (
                <div key={entry.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{entry.facility}</div>
                    <div className="text-sm text-slate-600">{format(parseISO(entry.date), 'MMM d, yyyy')}</div>
                  </div>
                  <div className="text-right mr-3">
                    {entry.status === 'closed' ? (
                      <div className="font-semibold text-orange-700">CLOSED</div>
                    ) : (
                      <div className="font-bold text-cyan-700">{entry.gallons.toLocaleString()} gal</div>
                    )}
                    {entry.notes && <div className="text-xs text-slate-500">{entry.notes}</div>}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(entry)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(entry.id)}
                      disabled={deleteMutation.isPending}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}