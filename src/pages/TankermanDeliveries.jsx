import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Ship, Clock, CheckCircle2, AlertCircle, Calendar, Edit2, Trash2, MapPin } from "lucide-react";
import { format, parseISO, isToday, isThisWeek } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

      export default function TankermanDeliveries() {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [selectedBarge, setSelectedBarge] = useState('all');
  const [formData, setFormData] = useState({
    time_alongside: '',
    time_transfer_commenced: '',
    time_transfer_completed: '',
    time_departed: '',
    gallons_delivered: '',
    notes: '',
    status: '',
    paperwork_sent_to_billing: false,
    sage_order_number: '',
    entered_in_sage: false
  });

  const queryClient = useQueryClient();

  // Generate 24-hour time options with 30-minute increments
  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeOptions.push(timeString);
    }
  }

        useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: allDeliveries = [] } = useQuery({
    queryKey: ['dispatches'],
    queryFn: () => base44.entities.Dispatch.list('-start_date'),
  });

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Dispatch.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      setSelectedDelivery(null);
      setFormData({
        time_alongside: '',
        time_transfer_commenced: '',
        time_transfer_completed: '',
        time_departed: '',
        gallons_delivered: '',
        notes: '',
        status: '',
        paperwork_sent_to_billing: false,
        sage_order_number: '',
        entered_in_sage: false
      });
    },
  });

  // Filter deliveries by user's market
  const myDeliveries = allDeliveries.filter(d => {
    if (!currentUser) return false;
    if (!currentUser.market) return true; // Show all if user has no market assigned
    return d.market === currentUser.market;
  });

  // Filter for active deliveries (today or this week, not delivered yet)
  const activeDeliveries = myDeliveries.filter(d => {
    if (d.status === 'delivered' || d.status === 'cancelled') return false;
    if (!d.start_date) return false;
    try {
      const deliveryDate = parseISO(d.start_date);
      return isToday(deliveryDate) || isThisWeek(deliveryDate);
    } catch (e) {
      return false;
    }
  });

  // Deliveries awaiting closeout (scheduled but need final info)
  const awaitingCloseout = myDeliveries.filter(d => {
    if (d.status !== 'scheduled') return false;
    if (!d.start_date) return false;
    if (d.event_type && d.event_type !== 'delivery') return false;
    
    // Apply market filter
    if (selectedMarket !== 'all' && d.market !== selectedMarket) return false;
    
    // Apply barge filter
    if (selectedBarge !== 'all' && d.barge_id !== selectedBarge) return false;
    
    return true;
  });

  // Recent completed deliveries (for reference)
  const completedDeliveries = myDeliveries
    .filter(d => d.status === 'delivered')
    .slice(0, 10);

  const handleUpdateClick = (delivery) => {
    setSelectedDelivery(delivery);
    setFormData({
      time_alongside: delivery.time_alongside || '',
      time_transfer_commenced: delivery.time_transfer_commenced || '',
      time_transfer_completed: delivery.time_transfer_completed || '',
      time_departed: delivery.time_departed || '',
      gallons_delivered: delivery.gallons_delivered || '',
      notes: delivery.notes || '',
      status: delivery.status || 'scheduled',
      paperwork_sent_to_billing: delivery.paperwork_sent_to_billing || false,
      sage_order_number: delivery.sage_order_number || '',
      entered_in_sage: delivery.entered_in_sage || false
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const updateData = {
      time_alongside: formData.time_alongside || null,
      time_transfer_commenced: formData.time_transfer_commenced || null,
      time_transfer_completed: formData.time_transfer_completed || null,
      time_departed: formData.time_departed || null,
      gallons_delivered: formData.gallons_delivered ? parseFloat(formData.gallons_delivered) : null,
      notes: formData.notes || selectedDelivery.notes,
      status: formData.status || selectedDelivery.status,
      paperwork_sent_to_billing: formData.paperwork_sent_to_billing,
      sage_order_number: formData.sage_order_number || null,
      entered_in_sage: formData.entered_in_sage
    };

    // Set end_date if time_departed is provided
    if (formData.time_departed) {
      updateData.end_date = selectedDelivery.start_date;
    }

    updateMutation.mutate({ id: selectedDelivery.id, data: updateData });
  };

  if (!currentUser) {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Ship className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              My Deliveries
            </h1>
            <p className="text-slate-600">Update delivery details and gallons delivered</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
            <Ship className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">{currentUser.full_name}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <Select value={selectedMarket} onValueChange={(value) => {
            setSelectedMarket(value);
            setSelectedBarge('all');
          }}>
            <SelectTrigger className="w-full md:w-64">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-slate-400" />
                <SelectValue placeholder="All Markets" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              <SelectItem value="Long Beach">Long Beach</SelectItem>
              <SelectItem value="Oakland">Oakland</SelectItem>
              <SelectItem value="Portland">Portland</SelectItem>
              <SelectItem value="Seattle">Seattle</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedBarge} onValueChange={setSelectedBarge}>
            <SelectTrigger className="w-full md:w-64">
              <div className="flex items-center gap-2">
                <Ship className="w-5 h-5 text-slate-400" />
                <SelectValue placeholder="All Barges" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Barges</SelectItem>
              {barges
                .filter(b => selectedMarket === 'all' || b.market === selectedMarket)
                .map(barge => (
                  <SelectItem key={barge.id} value={barge.id}>
                    {barge.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Deliveries Awaiting Closeout */}
        {(
          <Card className="shadow-lg border-2 border-amber-300 bg-amber-50">
            <CardHeader className="border-b border-amber-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-md">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">
                    Deliveries Awaiting Closeout ({awaitingCloseout.length})
                  </CardTitle>
                  <p className="text-sm text-slate-600">Update final gallons and mark as delivered</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {awaitingCloseout.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No deliveries awaiting closeout</p>
                </div>
              ) : (
              <div className="grid gap-4">
                {awaitingCloseout.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="p-4 bg-white rounded-lg border-2 border-amber-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-bold text-xl text-slate-900">{delivery.vessel_name}</h3>
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            {delivery.status}
                          </Badge>
                          {delivery.gallons_delivered && (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {delivery.gallons_delivered.toLocaleString()} gal
                            </Badge>
                          )}
                        </div>
                        <div className="grid md:grid-cols-2 gap-2 text-sm text-slate-600 mb-3">
                          <div><span className="font-medium">Barge:</span> {delivery.barge_name}</div>
                          <div><span className="font-medium">Destination:</span> {delivery.destination}</div>
                          <div><span className="font-medium">Product:</span> {delivery.cargo_type || 'TBD'}</div>
                          <div><span className="font-medium">Date:</span> {format(parseISO(delivery.start_date), 'MMM d, yyyy')}</div>
                          {delivery.customer && (
                            <div><span className="font-medium">Customer:</span> {delivery.customer}</div>
                          )}
                          {delivery.captain && (
                            <div><span className="font-medium">Captain:</span> {delivery.captain}</div>
                          )}
                        </div>
                        
                        {/* Show timing info if entered */}
                        {(delivery.time_alongside || delivery.time_transfer_commenced || delivery.time_transfer_completed || delivery.time_departed) && (
                          <div className="p-3 bg-blue-50 rounded border border-blue-200 text-sm mb-3">
                            <div className="font-semibold text-blue-800 mb-2">Demurrage Timing:</div>
                            <div className="grid md:grid-cols-2 gap-2 text-slate-700">
                              {delivery.time_alongside && <div>1. Alongside: <span className="font-medium">{delivery.time_alongside}</span></div>}
                              {delivery.time_transfer_commenced && <div>2. Transfer Started: <span className="font-medium">{delivery.time_transfer_commenced}</span></div>}
                              {delivery.time_transfer_completed && <div>3. Transfer Completed: <span className="font-medium">{delivery.time_transfer_completed}</span></div>}
                              {delivery.time_departed && <div>4. Departed: <span className="font-medium">{delivery.time_departed}</span></div>}
                            </div>
                          </div>
                        )}

                        {/* Missing info badges */}
                        <div className="flex flex-wrap gap-2">
                          {!delivery.gallons_delivered && (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                              Missing Final Gallons
                            </Badge>
                          )}
                          {!delivery.time_departed && (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                              Missing Departure Time
                            </Badge>
                          )}
                          {!delivery.paperwork_sent_to_billing && (
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              Paperwork Not Sent
                            </Badge>
                          )}
                          {!delivery.entered_in_sage && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                              Not in Sage
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleUpdateClick(delivery)}
                        className="bg-gradient-to-r from-amber-600 to-amber-700"
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Close Out
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        )}

        

        {/* Update Dialog */}
        <Dialog open={!!selectedDelivery} onOpenChange={(open) => !open && setSelectedDelivery(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Update Delivery Details</DialogTitle>
            </DialogHeader>
            {selectedDelivery && (
              <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                {/* Delivery Info Summary */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-lg text-slate-900 mb-2">{selectedDelivery.vessel_name}</div>
                  <div className="grid md:grid-cols-2 gap-2 text-sm text-slate-600">
                    <div>Barge: {selectedDelivery.barge_name}</div>
                    <div>Destination: {selectedDelivery.destination}</div>
                    <div>Product: {selectedDelivery.cargo_type || 'TBD'}</div>
                    <div>Date: {format(parseISO(selectedDelivery.start_date), 'MMM d, yyyy')}</div>
                  </div>
                </div>

                {/* Timing Fields */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 text-lg">Demurrage Timing Points</h3>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="time_alongside">1. Time Alongside Vessel</Label>
                      <Select
                        value={formData.time_alongside}
                        onValueChange={(value) => setFormData({...formData, time_alongside: value})}
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
                      <Label htmlFor="time_transfer_commenced">2. Cargo Transfer Commenced</Label>
                      <Select
                        value={formData.time_transfer_commenced}
                        onValueChange={(value) => setFormData({...formData, time_transfer_commenced: value})}
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
                      <Label htmlFor="time_transfer_completed">3. Cargo Transfer Completed</Label>
                      <Select
                        value={formData.time_transfer_completed}
                        onValueChange={(value) => setFormData({...formData, time_transfer_completed: value})}
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
                      <Label htmlFor="time_departed">4. Time Departed from Vessel</Label>
                      <Select
                        value={formData.time_departed}
                        onValueChange={(value) => setFormData({...formData, time_departed: value})}
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
                  </div>
                </div>

                {/* Gallons Delivered */}
                <div className="space-y-2">
                  <Label htmlFor="gallons_delivered">Actual Gallons Delivered *</Label>
                  <Input
                    id="gallons_delivered"
                    type="number"
                    value={formData.gallons_delivered}
                    onChange={(e) => setFormData({...formData, gallons_delivered: e.target.value})}
                    placeholder="Enter actual gallons"
                    required
                  />
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({...formData, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Billing & Sage Section */}
                <div className="space-y-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h3 className="font-semibold text-slate-900">Billing & Sage</h3>
                  
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

                  <div className="space-y-2">
                    <Label htmlFor="sage_order_number">Sage Order Number</Label>
                    <Input
                      id="sage_order_number"
                      value={formData.sage_order_number}
                      onChange={(e) => setFormData({...formData, sage_order_number: e.target.value})}
                      placeholder="Enter Sage order #"
                    />
                  </div>

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

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Any additional observations..."
                    rows={3}
                  />
                </div>

                {/* Info Box */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <p className="font-medium mb-1">What happens when you submit:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>Delivery data is updated immediately</li>
                    <li>Inventory tracking is automatically updated</li>
                    <li>Dispatch team can proceed with final close-out</li>
                    <li>Supply reports reflect real-time gallons delivered</li>
                  </ul>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedDelivery(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="bg-gradient-to-r from-blue-600 to-blue-700"
                  >
                    {updateMutation.isPending ? 'Updating...' : 'Save Updates'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}