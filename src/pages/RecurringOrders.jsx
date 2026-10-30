import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, RefreshCw, Copy, Ship, Truck, Warehouse } from "lucide-react";
import { format, addDays, addWeeks, addMonths } from "date-fns";

const defaultForm = {
  name: "",
  delivery_type: "Truck",
  market: "Richmond CA",
  customer_name: "",
  vessel_name: "",
  destination: "",
  product: "",
  brand: "",
  gallons: "",
  frequency: "weekly",
  notes: "",
  is_active: true,
};

const frequencyLabels = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Bi-Weekly",
  monthly: "Monthly",
};

const deliveryIcons = {
  Barge: Ship,
  Truck: Truck,
  "X-Pipe": Warehouse,
};

export default function RecurringOrders() {
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [filterType, setFilterType] = useState("all");
  const [generateDialogOrder, setGenerateDialogOrder] = useState(null);
  const [generateDate, setGenerateDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const queryClient = useQueryClient();

  const { data: recurringOrders = [] } = useQuery({
    queryKey: ["recurringOrders"],
    queryFn: () => base44.entities.RecurringOrder.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const { data: trucks = [] } = useQuery({
    queryKey: ["trucks"],
    queryFn: () => base44.entities.Truck.list(),
  });

  const { data: crewMembers = [] } = useQuery({
    queryKey: ["crewMembers"],
    queryFn: () => base44.entities.CrewMember.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RecurringOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringOrders"] });
      setShowForm(false);
      setFormData(defaultForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RecurringOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringOrders"] });
      setShowForm(false);
      setEditingOrder(null);
      setFormData(defaultForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RecurringOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringOrders"] });
    },
  });

  // Create a one-time dispatch from recurring order
  const generateDispatchMutation = useMutation({
    mutationFn: async ({ order, date }) => {
      if (order.delivery_type === "Truck") {
        return base44.entities.TruckDispatch.create({
          market: order.market,
          dispatch_date: date,
          product: order.product,
          brand: order.brand,
          customer_name: order.customer_name,
          truck_type: "Stakebed",
          gallons: order.gallons,
          delivery_type: "Package",
          status: "scheduled",
          notes: `[Recurring: ${order.name}] ${order.notes || ""}`,
        });
      } else if (order.delivery_type === "Barge") {
        return base44.entities.Dispatch.create({
          market: order.market,
          vessel_name: order.vessel_name || order.customer_name,
          destination: order.destination,
          cargo_type: order.product,
          start_date: date,
          status: "scheduled",
          event_type: "delivery",
          customer: order.customer_name,
          notes: `[Recurring: ${order.name}] ${order.notes || ""}`,
        });
      } else {
        return base44.entities.FuelDockDelivery.create({
          market: order.market,
          fuel_dock_location: order.destination,
          vessel_name: order.vessel_name || order.customer_name,
          customer: order.customer_name,
          cargo_type: order.product,
          gallons_delivered: order.gallons,
          delivery_date: date,
          status: "scheduled",
          notes: `[Recurring: ${order.name}] ${order.notes || ""}`,
        });
      }
    },
    onSuccess: () => {
      setGenerateDialogOrder(null);
      alert("Dispatch created successfully!");
    },
  });

  const handleEdit = (order) => {
    setEditingOrder(order);
    setFormData(order);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = { ...formData, gallons: formData.gallons ? parseFloat(formData.gallons) : null };
    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const filtered = recurringOrders.filter(
    (o) => filterType === "all" || o.delivery_type === filterType
  );

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Recurring Orders</h1>
            <p className="text-gray-500 text-sm mt-1">Manage template orders and generate dispatches with one click</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Barge">Barge</SelectItem>
                <SelectItem value="Truck">Truck</SelectItem>
                <SelectItem value="X-Pipe">X-Pipe</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => { setEditingOrder(null); setFormData(defaultForm); setShowForm(true); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Recurring Order
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <RefreshCw className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No recurring orders yet</p>
              <p className="text-gray-400 text-sm mt-1">Create template orders for customers you deliver to regularly</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((order) => {
              const Icon = deliveryIcons[order.delivery_type] || Truck;
              return (
                <Card key={order.id} className={`border ${!order.is_active ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Icon className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold">{order.name}</CardTitle>
                          <p className="text-xs text-gray-500">{order.customer_name}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs">{order.delivery_type}</Badge>
                        {!order.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div><span className="text-gray-500">Market:</span> <span className="font-medium">{order.market}</span></div>
                      <div><span className="text-gray-500">Frequency:</span> <span className="font-medium">{frequencyLabels[order.frequency]}</span></div>
                      {order.product && <div><span className="text-gray-500">Product:</span> <span className="font-medium">{order.product}</span></div>}
                      {order.gallons && <div><span className="text-gray-500">Gallons:</span> <span className="font-medium">{order.gallons?.toLocaleString()}</span></div>}
                      {order.destination && <div className="col-span-2"><span className="text-gray-500">Destination:</span> <span className="font-medium">{order.destination}</span></div>}
                    </div>
                    {order.notes && <p className="text-xs text-gray-500 italic border-t pt-2">{order.notes}</p>}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-xs"
                        onClick={() => { setGenerateDialogOrder(order); setGenerateDate(format(new Date(), "yyyy-MM-dd")); }}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Generate Dispatch
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(order)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        if (confirm("Delete this recurring order?")) deleteMutation.mutate(order.id);
                      }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Generate Dispatch Dialog */}
        <Dialog open={!!generateDialogOrder} onOpenChange={() => setGenerateDialogOrder(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Generate Dispatch from "{generateDialogOrder?.name}"</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-gray-600">This will create a new {generateDialogOrder?.delivery_type} dispatch for <strong>{generateDialogOrder?.customer_name}</strong>.</p>
              <div>
                <Label>Dispatch Date</Label>
                <Input
                  type="date"
                  value={generateDate}
                  onChange={(e) => setGenerateDate(e.target.value)}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setGenerateDialogOrder(null)}>Cancel</Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  disabled={generateDispatchMutation.isPending}
                  onClick={() => generateDispatchMutation.mutate({ order: generateDialogOrder, date: generateDate })}
                >
                  {generateDispatchMutation.isPending ? "Creating..." : "Create Dispatch"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Form Dialog */}
        <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditingOrder(null); setFormData(defaultForm); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingOrder ? "Edit Recurring Order" : "New Recurring Order"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Order Name / Description</Label>
                  <Input
                    placeholder="e.g. Foss Maritime - Weekly Castrol Delivery"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Delivery Type</Label>
                  <Select value={formData.delivery_type} onValueChange={(v) => setFormData({ ...formData, delivery_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Barge">Barge</SelectItem>
                      <SelectItem value="Truck">Truck</SelectItem>
                      <SelectItem value="X-Pipe">X-Pipe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Market</Label>
                  <Select value={formData.market} onValueChange={(v) => setFormData({ ...formData, market: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Long Beach">Long Beach</SelectItem>
                      <SelectItem value="Oakland">Oakland</SelectItem>
                      <SelectItem value="Portland">Portland</SelectItem>
                      <SelectItem value="Seattle">Seattle</SelectItem>
                      <SelectItem value="Richmond CA">Richmond CA</SelectItem>
                      <SelectItem value="Rancho Dominguez">Rancho Dominguez</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Customer Name</Label>
                  <Input value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} required />
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(formData.delivery_type === "Barge" || formData.delivery_type === "X-Pipe") && (
                  <div>
                    <Label>Vessel Name</Label>
                    <Input value={formData.vessel_name} onChange={(e) => setFormData({ ...formData, vessel_name: e.target.value })} />
                  </div>
                )}
                <div>
                  <Label>Destination / Location</Label>
                  <Input value={formData.destination} onChange={(e) => setFormData({ ...formData, destination: e.target.value })} />
                </div>
                <div>
                  <Label>Product</Label>
                  <Select value={formData.product} onValueChange={(v) => setFormData({ ...formData, product: v, brand: '' })}>
                    <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>
                      {products.filter(p => p.is_active).map((p) => (
                        <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.product?.toLowerCase().includes('lubricant') && (
                  <div>
                    <Label>Brand</Label>
                    <Select value={formData.brand || ''} onValueChange={(v) => setFormData({ ...formData, brand: v })}>
                      <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
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
                  <Label>Default Gallons</Label>
                  <Input type="number" value={formData.gallons} onChange={(e) => setFormData({ ...formData, gallons: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingOrder(null); setFormData(defaultForm); }}>Cancel</Button>
                <Button type="submit">{editingOrder ? "Update" : "Create"} Recurring Order</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}