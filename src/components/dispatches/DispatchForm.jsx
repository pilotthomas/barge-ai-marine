import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, MapPin, Users, Anchor, Waves, History, AlertCircle, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { crewAvailableForMarket } from "@/lib/regions";
import { hasPosition, crewPositions } from "@/lib/crewPositions";
import MilitaryTimeInput from "@/components/ui/MilitaryTimeInput";

// Helper function to capitalize names - handles periods, underscores, and spaces
const capitalizeName = (name) => {
  if (!name) return '';
  // Replace periods and underscores with spaces, then capitalize
  return name
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function DispatchForm({ dispatch, barges, onSave, onCancel, isProcessing }) {
  const [showScheduleHistory, setShowScheduleHistory] = useState(false);

  const [formData, setFormData] = useState(() => {
    if (dispatch) {
      // Existing multi-product dispatch, or seed one line from the legacy single product
      const lines = Array.isArray(dispatch.product_lines) && dispatch.product_lines.length > 0
        ? dispatch.product_lines
        : (dispatch.cargo_type
          ? [{ product_type: dispatch.cargo_type, cargo_brand: dispatch.cargo_brand || '', gallons: dispatch.gallons_delivered ?? '', metric_tons: dispatch.metric_tons_delivered ?? '' }]
          : []);
      return {
        ...dispatch,
        product_lines: lines.map(l => ({
          product_type: l.product_type || '',
          cargo_brand: l.cargo_brand || '',
          gallons: l.gallons ?? '',
          metric_tons: l.metric_tons ?? ''
        }))
      };
    }
    return {
    event_type: 'delivery',
    market: '',
    barge_id: '',
    barge_name: '',
    tug_id: '',
    tug_name: '',
    is_third_party_towing: false,
    is_outside_tow: false,
    is_dockside_delivery: false,
    captain: '',
    deckhand: '',
    tankerman: '',
    crew_members: [],
    vessel_name: '',
    destination: '',
    cargo_type: '',
    cargo_brand: '',
    gallons_delivered: '',
    metric_tons_delivered: '',
    agent_name: '',
    agent_contact_name: '',
    agent_phone: '',
    start_date: '',
    end_date: '',
    time_alongside: '',
    time_transfer_commenced: '',
    time_transfer_completed: '',
    time_departed: '',
    requested_delivery_time: '',
    status: 'scheduled',
    customer: '',
    paperwork_sent_to_billing: false,
    sage_order_number: '',
    sage_delivery_ticket_number: '',
    entered_in_sage: false,
    notes: '',
    product_lines: []
  };
  });

  const [crewInput, setCrewInput] = useState('');

  // Generate 24-hour time options with 30-minute increments
  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeOptions.push(timeString);
    }
  }

  const { data: tugs = [] } = useQuery({
    queryKey: ['tugs'],
    queryFn: () => base44.entities.Tug.list(),
    initialData: [],
  });

  const { data: cargoTypes = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
    initialData: [],
  });

  const { data: scheduleHistory = [] } = useQuery({
    queryKey: ['schedule-changes', dispatch?.id],
    queryFn: () => dispatch?.id ? base44.entities.DeliveryScheduleChange.filter({ dispatch_id: dispatch.id }, '-change_date') : Promise.resolve([]),
    enabled: !!dispatch?.id,
    initialData: [],
  });

  const { data: crewMembers = [] } = useQuery({
    queryKey: ['crew-members'],
    queryFn: () => base44.entities.CrewMember.filter({ is_active: true }),
    initialData: [],
  });

  // Filter only active cargo types
  const activeCargoTypes = cargoTypes.filter(c => c.is_active !== false);

  // Organize and alphabetize cargo types by category
  const fuelProducts = activeCargoTypes
    .filter(c => c.category === 'Fuel' || !c.category || c.category === 'Other')
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const lubeProducts = activeCargoTypes
    .filter(c => c.category === 'Lubes')
    .sort((a, b) => a.name.localeCompare(b.name));

  const isNonDeliveryEvent = formData.event_type !== 'delivery';

  // Multi-product line helpers
  const productLines = Array.isArray(formData.product_lines) ? formData.product_lines : [];
  const totalGallons = productLines.reduce((s, l) => s + (parseFloat(l.gallons) || 0), 0);
  const totalMetricTons = productLines.reduce((s, l) => s + (parseFloat(l.metric_tons) || 0), 0);

  const addProductLine = () => {
    setFormData({ ...formData, product_lines: [...productLines, { product_type: '', cargo_brand: '', gallons: '', metric_tons: '' }] });
  };
  const updateProductLine = (idx, updates) => {
    setFormData({ ...formData, product_lines: productLines.map((l, i) => i === idx ? { ...l, ...updates } : l) });
  };
  const removeProductLine = (idx) => {
    setFormData({ ...formData, product_lines: productLines.filter((_, i) => i !== idx) });
  };

  // Fixed conversion rates: gallons per metric ton
  const getConversionRate = (productType) => {
    const conversions = {
      'Renewable Diesel (RD99)': 339,
      'ULSD Diesel': 316,
      'Marine Gas Oil (MGO)': 302
    };
    if (conversions[productType]) return conversions[productType];
    const product = cargoTypes.find(c => c.name === productType);
    return product?.gallons_per_metric_ton || null;
  };

  // Filter barges by selected market
  const availableBarges = formData.market 
    ? barges.filter(b => b.market === formData.market)
    : [];

  // Filter tugs by selected market
  const availableTugs = formData.market 
    ? tugs.filter(t => t.market === formData.market)
    : [];

  // Filter crew by position and market
  const availableCaptains = formData.market
    ? crewMembers.filter(u => hasPosition(u, 'captain') && crewAvailableForMarket(u.market, formData.market))
    : [];

  const availableDeckhands = formData.market
    ? crewMembers.filter(u => hasPosition(u, 'deckhand') && crewAvailableForMarket(u.market, formData.market))
    : [];

  const availableTankermen = formData.market
    ? crewMembers.filter(u => hasPosition(u, 'tankerman') && crewAvailableForMarket(u.market, formData.market))
    : [];

  // Debug logging for crew filtering
  React.useEffect(() => {
    if (formData.market) {
      console.log('=== CREW FILTERING DEBUG ===');
      console.log('Selected Market:', formData.market);
      console.log('All Crew Members with Position and Market:');
      crewMembers.forEach(u => {
        console.log(`  - ${u.full_name}: position="${u.position}", market="${u.market}"`);
      });
      console.log('Available Captains:', availableCaptains.map(u => u.full_name));
      console.log('Available Deckhands:', availableDeckhands.map(u => u.full_name));
      console.log('Available Tankermen:', availableTankermen.map(u => u.full_name));
    }
  }, [formData.market, crewMembers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Log schedule change if date changed (optional, no dialog)
    if (dispatch && dispatch.start_date && formData.start_date && dispatch.start_date !== formData.start_date) {
      try {
        const user = await base44.auth.me();
        await base44.entities.DeliveryScheduleChange.create({
          dispatch_id: dispatch.id,
          vessel_name: formData.vessel_name,
          barge_name: formData.barge_name,
          customer: formData.customer,
          previous_date: dispatch.start_date,
          new_date: formData.start_date,
          change_reason: formData.notes || 'Date updated',
          changed_by_name: user.full_name,
          changed_by_email: user.email,
          change_date: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to log schedule change:', error);
        // Continue with save even if logging fails
      }
    }
    
    // Product lines drive the totals; legacy single-product fields stay in sync for calendar/inventory views
    const lines = productLines.filter(l => l.product_type);
    const sumGallons = lines.reduce((s, l) => s + (parseFloat(l.gallons) || 0), 0);
    const sumMetricTons = lines.reduce((s, l) => s + (parseFloat(l.metric_tons) || 0), 0);

    const submitData = {
      ...formData,
      product_lines: lines.map(l => ({
        product_type: l.product_type,
        cargo_brand: l.cargo_brand || null,
        gallons: parseFloat(l.gallons) || 0,
        metric_tons: l.metric_tons ? parseFloat(l.metric_tons) : null
      })),
      cargo_type: lines[0]?.product_type || formData.cargo_type || '',
      cargo_brand: lines.find(l => l.cargo_brand)?.cargo_brand || formData.cargo_brand || '',
      gallons_delivered: sumGallons,
      metric_tons_delivered: sumMetricTons || null
    };
    
    onSave(submitData);
  };



  const handleMarketChange = (market) => {
    setFormData({
      ...formData,
      market,
      barge_id: '',
      barge_name: '',
      tug_id: '',
      tug_name: '',
      is_third_party_towing: false
    });
  };

  const handleBargeChange = (bargeId) => {
    const selectedBarge = barges.find(b => b.id === bargeId);
    setFormData({
      ...formData,
      barge_id: bargeId,
      barge_name: selectedBarge?.name || ''
    });
  };

  const handleTugChange = (tugId) => {
    if (tugId === 'alongside_ptl_berth') {
      setFormData({
        ...formData,
        tug_id: tugId,
        tug_name: 'Alongside PTL Berth',
        is_third_party_towing: false
      });
    } else {
      const selectedTug = tugs.find(t => t.id === tugId);
      setFormData({
        ...formData,
        tug_id: tugId,
        tug_name: selectedTug?.name || '',
        is_third_party_towing: selectedTug?.is_third_party || false
      });
    }
  };

  // Handle dockside delivery checkbox change
  const handleDocksideDeliveryChange = (checked) => {
    if (checked) {
      // When dockside delivery is checked, set tug to "Alongside PTL Berth"
      setFormData({
        ...formData,
        is_dockside_delivery: true,
        tug_id: 'alongside_ptl_berth',
        tug_name: 'Alongside PTL Berth',
        is_third_party_towing: false
      });
    } else {
      // When unchecked, just update the flag
      setFormData({
        ...formData,
        is_dockside_delivery: false
      });
    }
  };

  const addCrewMember = () => {
    if (crewInput.trim()) {
      setFormData({
        ...formData,
        crew_members: [...(formData.crew_members || []), crewInput.trim()]
      });
      setCrewInput('');
    }
  };

  const removeCrewMember = (index) => {
    setFormData({
      ...formData,
      crew_members: formData.crew_members.filter((_, i) => i !== index)
    });
  };

  return (
    <>
      {/* Schedule History Dialog */}
      <Dialog open={showScheduleHistory} onOpenChange={setShowScheduleHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              Schedule Change History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-96 overflow-y-auto">
            {scheduleHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No schedule changes recorded</p>
              </div>
            ) : (
              scheduleHistory.map((change, index) => (
                <div key={change.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <Badge className="bg-blue-100 text-blue-800">
                      Change #{scheduleHistory.length - index}
                    </Badge>
                    <span className="text-xs text-slate-500">
                      {format(parseISO(change.change_date), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-2 text-sm">
                    <div>
                      <span className="text-slate-600">From:</span>
                      <div className="font-semibold text-slate-900">
                        {format(parseISO(change.previous_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-600">To:</span>
                      <div className="font-semibold text-slate-900">
                        {format(parseISO(change.new_date), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm mb-2">
                    <span className="font-medium text-slate-700">Reason:</span>
                    <div className="text-slate-900 mt-1">{change.change_reason}</div>
                  </div>
                  <div className="text-xs text-slate-500">
                    Changed by {change.changed_by_name}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Card className="shadow-lg border-slate-200">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-slate-900">
              {dispatch ? 'Edit Delivery' : 'New Delivery'}
            </CardTitle>
            {dispatch && scheduleHistory.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowScheduleHistory(true)}
                className="flex items-center gap-2"
              >
                <History className="w-4 h-4" />
                View Schedule History ({scheduleHistory.length})
              </Button>
            )}
          </div>
        </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Type Selector */}
          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <Label className="text-base font-semibold mb-3 block">Event Type</Label>
            <div className="grid md:grid-cols-2 gap-3">
              <div 
                onClick={() => setFormData({...formData, event_type: 'delivery'})}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.event_type === 'delivery' 
                    ? 'border-blue-600 bg-blue-100' 
                    : 'border-slate-300 bg-white hover:border-blue-400'
                }`}
              >
                <div className="font-bold text-slate-900">Delivery Event</div>
                <div className="text-xs text-slate-600 mt-1">
                  Counts towards inventory & analytics
                </div>
              </div>
              <div 
                onClick={() => setFormData({...formData, event_type: 'inspection'})}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.event_type !== 'delivery' 
                    ? 'border-orange-600 bg-orange-100' 
                    : 'border-slate-300 bg-white hover:border-orange-400'
                }`}
              >
                <div className="font-bold text-slate-900">Non-Delivery Event</div>
                <div className="text-xs text-slate-600 mt-1">
                  Calendar blocking only (inspection, crane, etc.)
                </div>
              </div>
            </div>
            {isNonDeliveryEvent && (
              <div className="mt-3">
                <Label htmlFor="event_subtype" className="text-sm">Event Sub-Type</Label>
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

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="market" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Operating Market *
              </Label>
              <Select
                value={formData.market}
                onValueChange={handleMarketChange}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select market first" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Long Beach">Long Beach</SelectItem>
                  <SelectItem value="Oakland">Oakland</SelectItem>
                  <SelectItem value="Portland">Portland</SelectItem>
                  <SelectItem value="Seattle">Seattle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="barge">Barge *</Label>
              <Select
                value={formData.barge_id}
                onValueChange={handleBargeChange}
                required
                disabled={!formData.market}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.market ? "Select barge" : "Select market first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableBarges.length === 0 && formData.market && (
                    <div className="p-2 text-sm text-slate-500 text-center">
                      No barges in {formData.market}
                    </div>
                  )}
                  {availableBarges.map((barge) => (
                    <SelectItem key={barge.id} value={barge.id}>
                      {barge.name} ({barge.capacity_gallons?.toLocaleString()} gal)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.market && availableBarges.length === 0 && (
                <p className="text-xs text-orange-600">No barges available in this market</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tug" className="flex items-center gap-2">
                <Anchor className="w-4 h-4" />
                Tug
              </Label>
              <Select
                value={formData.tug_id}
                onValueChange={handleTugChange}
                disabled={!formData.market}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.market ? "Select tug (optional)" : "Select market first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alongside_ptl_berth">Alongside PTL Berth</SelectItem>
                  {availableTugs.length === 0 && formData.market && (
                    <div className="p-2 text-sm text-slate-500 text-center">
                      No tugs in {formData.market}
                    </div>
                  )}
                  {availableTugs.map((tug) => (
                    <SelectItem key={tug.id} value={tug.id}>
                      {tug.name} {tug.is_third_party ? '(3rd Party)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.is_third_party_towing && (
                <p className="text-xs text-purple-600 font-medium">Using third-party towing provider</p>
              )}
              {formData.tug_id === 'alongside_ptl_berth' && (
                <p className="text-xs text-blue-600 font-medium">Customer alongside PTL berth - no towing required</p>
              )}
            </div>

            <div className="space-y-2 flex items-end">
              <div className="flex flex-col gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_outside_tow"
                    checked={formData.is_outside_tow}
                    onCheckedChange={(checked) => setFormData({...formData, is_outside_tow: checked})}
                  />
                  <Label htmlFor="is_outside_tow" className="cursor-pointer flex items-center gap-2">
                    <Waves className="w-4 h-4 text-cyan-600" />
                    <span>Outside Tow (Beyond Breakwater)</span>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_dockside_delivery"
                    checked={formData.is_dockside_delivery}
                    onCheckedChange={handleDocksideDeliveryChange}
                  />
                  <Label htmlFor="is_dockside_delivery" className="cursor-pointer flex items-center gap-2">
                    <Anchor className="w-4 h-4 text-purple-600" />
                    <span>Dockside Delivery (Alongside Berth)</span>
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-700" />
              <h3 className="text-lg font-semibold text-slate-900">Crew</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="captain">Captain</Label>
                <Select
                  value={formData.captain || "_none_"}
                  onValueChange={(value) => setFormData({...formData, captain: value === "_none_" ? "" : value})}
                  disabled={!formData.market}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.market ? "Select captain" : "Select market first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_" className="text-slate-500">-- None --</SelectItem>
                    {availableCaptains.length === 0 && formData.market ? (
                      <div className="p-3 text-sm space-y-1">
                        <p className="font-semibold text-slate-900 text-center">No captains in {formData.market}</p>
                        <p className="text-xs text-orange-600 text-center">Check Crew Management</p>
                      </div>
                    ) : (
                      availableCaptains.map((user) => (
                        <SelectItem key={user.id} value={capitalizeName(user.full_name)}>
                          {capitalizeName(user.full_name)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tankerman">Tankerman</Label>
                <Select
                  value={formData.tankerman || "_none_"}
                  onValueChange={(value) => setFormData({...formData, tankerman: value === "_none_" ? "" : value})}
                  disabled={!formData.market}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.market ? "Select tankerman" : "Select market first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_" className="text-slate-500">-- None --</SelectItem>
                    {availableTankermen.length === 0 && formData.market ? (
                      <div className="p-3 text-sm space-y-1">
                        <p className="font-semibold text-slate-900 text-center">No tankermen in {formData.market}</p>
                        <p className="text-xs text-orange-600 text-center">Check Crew Management</p>
                      </div>
                    ) : (
                      availableTankermen.map((user) => (
                        <SelectItem key={user.id} value={capitalizeName(user.full_name)}>
                          {capitalizeName(user.full_name)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deckhand">Deckhand</Label>
                <Select
                  value={formData.deckhand || "_none_"}
                  onValueChange={(value) => setFormData({...formData, deckhand: value === "_none_" ? "" : value})}
                  disabled={!formData.market}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.market ? "Select deckhand" : "Select market first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none_" className="text-slate-500">-- None --</SelectItem>
                    {availableDeckhands.length === 0 && formData.market ? (
                      <div className="p-3 text-sm space-y-1">
                        <p className="font-semibold text-slate-900 text-center">No deckhands in {formData.market}</p>
                        <p className="text-xs text-orange-600 text-center">Check Crew Management</p>
                      </div>
                    ) : (
                      availableDeckhands.map((user) => (
                        <SelectItem key={user.id} value={capitalizeName(user.full_name)}>
                          {capitalizeName(user.full_name)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Additional Crew Members</Label>
              <Select
                value="_select_"
                onValueChange={(value) => {
                  if (value !== "_select_" && !formData.crew_members?.includes(value)) {
                    setFormData({
                      ...formData,
                      crew_members: [...(formData.crew_members || []), value]
                    });
                  }
                }}
                disabled={!formData.market}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Add crew member..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_select_" className="text-slate-500">-- Select to add --</SelectItem>
                  {(() => {
                    const availableCrew = crewMembers
                      .filter(u => crewAvailableForMarket(u.market, formData.market))
                      .filter(u => !formData.crew_members?.includes(capitalizeName(u.full_name)));
                    
                    const positions = ['captain', 'tankerman', 'deckhand'];
                    
                    return positions.map(position => {
                      const crewByPosition = availableCrew
                        .filter(u => crewPositions(u)[0] === position)
                        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
                      
                      if (crewByPosition.length === 0) return null;
                      
                      return (
                        <React.Fragment key={position}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">
                            {position}s
                          </div>
                          {crewByPosition.map((user) => (
                            <SelectItem key={user.id} value={capitalizeName(user.full_name)}>
                              {capitalizeName(user.full_name)}
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.crew_members?.map((member, index) => (
                  <div key={index} className="bg-slate-100 px-3 py-1 rounded-full flex items-center gap-2">
                    <span className="text-sm">{member}</span>
                    <button
                      type="button"
                      onClick={() => removeCrewMember(index)}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="vessel_name">{isNonDeliveryEvent ? 'Event Description *' : 'Vessel Name *'}</Label>
              <Input
                id="vessel_name"
                value={formData.vessel_name}
                onChange={(e) => setFormData({...formData, vessel_name: e.target.value})}
                placeholder={isNonDeliveryEvent ? "e.g., Meter lift via crane" : "Vessel name"}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">{isNonDeliveryEvent ? 'Location *' : 'Destination *'}</Label>
              <Input
                id="destination"
                value={formData.destination}
                onChange={(e) => setFormData({...formData, destination: e.target.value})}
                placeholder={isNonDeliveryEvent ? "e.g., Berth 22" : "Delivery location"}
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
              <Label htmlFor="agent_name">Agent Company</Label>
              <Input
                id="agent_name"
                value={formData.agent_name}
                onChange={(e) => setFormData({...formData, agent_name: e.target.value})}
                placeholder="Agent company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent_contact_name">Agent Contact Name</Label>
              <Input
                id="agent_contact_name"
                value={formData.agent_contact_name}
                onChange={(e) => setFormData({...formData, agent_contact_name: e.target.value})}
                placeholder="Contact person name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent_phone">Agent Phone</Label>
              <Input
                id="agent_phone"
                value={formData.agent_phone}
                onChange={(e) => setFormData({...formData, agent_phone: e.target.value})}
                placeholder="Phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="requested_delivery_time">Requested Delivery Time</Label>
              <Select
                value={formData.requested_delivery_time}
                onValueChange={(value) => setFormData({...formData, requested_delivery_time: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="TBD">Time not confirmed (TBD)</SelectItem>
                  {timeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Demurrage Timing Section */}
          {!isNonDeliveryEvent && (
            <div className="space-y-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <h3 className="text-lg font-semibold text-slate-900">Demurrage Timing Points</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="time_alongside">1. Time Alongside Vessel</Label>
                  <MilitaryTimeInput
                    id="time_alongside"
                    value={formData.time_alongside}
                    onChange={(v) => setFormData({...formData, time_alongside: v})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time_transfer_commenced">2. Cargo Transfer Commenced</Label>
                  <MilitaryTimeInput
                    id="time_transfer_commenced"
                    value={formData.time_transfer_commenced}
                    onChange={(v) => setFormData({...formData, time_transfer_commenced: v})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time_transfer_completed">3. Cargo Transfer Completed</Label>
                  <MilitaryTimeInput
                    id="time_transfer_completed"
                    value={formData.time_transfer_completed}
                    onChange={(v) => setFormData({...formData, time_transfer_completed: v})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time_departed">4. Time Departed from Vessel</Label>
                  <MilitaryTimeInput
                    id="time_departed"
                    value={formData.time_departed}
                    onChange={(v) => setFormData({...formData, time_departed: v})}
                  />
                </div>
              </div>
            </div>
          )}

          {!isNonDeliveryEvent && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Products</Label>
                <Button type="button" variant="outline" size="sm" onClick={addProductLine}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Product
                </Button>
              </div>
              {productLines.length === 0 ? (
                <p className="text-sm text-slate-500">No products added yet. Add one product or several.</p>
              ) : (
                <div className="space-y-3">
                  {productLines.map((line, idx) => {
                    const lineCargo = cargoTypes.find(c => c.name === line.product_type);
                    const isLineLubes = lineCargo?.category === 'Lubes';
                    const conversion = getConversionRate(line.product_type);
                    return (
                      <div key={idx} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                        <div className="grid md:grid-cols-4 gap-3">
                          <div className="space-y-1 md:col-span-2">
                            <Label>Product {idx + 1}</Label>
                            <Select
                              value={line.product_type || undefined}
                              onValueChange={(value) => updateProductLine(idx, { product_type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {fuelProducts.length > 0 && (
                                  <>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">Fuel Products</div>
                                    {fuelProducts.map((cargo) => (
                                      <SelectItem key={cargo.id} value={cargo.name}>{cargo.name}</SelectItem>
                                    ))}
                                  </>
                                )}
                                {lubeProducts.length > 0 && (
                                  <>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase mt-1 border-t">Lubricants</div>
                                    {lubeProducts.map((cargo) => (
                                      <SelectItem key={cargo.id} value={cargo.name}>{cargo.name}</SelectItem>
                                    ))}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label>Gallons</Label>
                            <Input
                              type="number"
                              value={line.gallons}
                              onChange={(e) => {
                                const gallons = e.target.value;
                                const mt = gallons && conversion ? (parseFloat(gallons) / conversion).toFixed(3) : '';
                                updateProductLine(idx, { gallons, metric_tons: mt });
                              }}
                              placeholder="0"
                            />
                            {line.gallons && conversion && (
                              <p className="text-xs text-green-600">= {line.metric_tons} MT</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label>OR Metric Tons</Label>
                            <Input
                              type="number"
                              step="0.001"
                              value={line.metric_tons}
                              onChange={(e) => {
                                const mt = e.target.value;
                                const gal = mt && conversion ? (parseFloat(mt) * conversion).toFixed(2) : '';
                                updateProductLine(idx, { metric_tons: mt, gallons: gal });
                              }}
                              placeholder="0.000"
                            />
                            {line.metric_tons && conversion && (
                              <p className="text-xs text-green-600 font-medium">= {Number(line.gallons).toLocaleString()} gal</p>
                            )}
                          </div>
                        </div>
                        {isLineLubes && (
                          <div className="space-y-1 max-w-xs">
                            <Label>Brand</Label>
                            <Select
                              value={line.cargo_brand || "_none_"}
                              onValueChange={(value) => updateProductLine(idx, { cargo_brand: value === "_none_" ? "" : value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select brand" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none_">-- None --</SelectItem>
                                <SelectItem value="Shell">Shell</SelectItem>
                                <SelectItem value="Mobil">Mobil</SelectItem>
                                <SelectItem value="Total Lubmarine">Total Lubmarine</SelectItem>
                                <SelectItem value="Castrol">Castrol</SelectItem>
                                <SelectItem value="Chevron">Chevron</SelectItem>
                                <SelectItem value="Lukoil">Lukoil</SelectItem>
                                <SelectItem value="SeaLube">SeaLube</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {line.product_type && !conversion && (
                          <p className="text-xs text-orange-600">No conversion factor set for this product</p>
                        )}
                        <div className="flex justify-end">
                          <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => removeProductLine(idx)}>
                            <X className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {totalGallons > 0 && (
                    <p className="text-sm font-semibold text-slate-700">
                      Total: {totalGallons.toLocaleString()} gallons{totalMetricTons ? ` (${totalMetricTons.toFixed(3)} MT)` : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
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
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isNonDeliveryEvent && (
            <>
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

              <Separator className="my-4" />

              {formData.is_dockside_delivery && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800">
                    <strong>Dockside Delivery:</strong> Barge will be positioned alongside berth for direct pumping to vessel. 
                    Example: Seattle Pier 15 - vessel pulls alongside and product is pumped directly from barge tanks.
                  </p>
                </div>
              )}

              {/* Sage ERP Fields */}
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
            </>
          )}

          {isNonDeliveryEvent && (
            <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Non-Delivery Event:</strong> This event will appear on the calendar to block barge availability, but will NOT count towards inventory tracking or delivery analytics.
              </p>
            </div>
          )}

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

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isProcessing}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <Save className="w-4 h-4 mr-2" />
              {isProcessing ? 'Saving...' : 'Save Delivery'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
    </>
  );
}