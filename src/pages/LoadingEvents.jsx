import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, AlertTriangle, CheckCircle, Clock, Ship, Droplet, Calendar as CalendarIcon, MapPin, Save, X, Edit2, Users, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { crewAvailableForMarket } from "@/lib/regions";
import { Separator } from "@/components/ui/separator";
import { format, parseISO, differenceInDays } from "date-fns";

// Safe date parsing helper
const safeParseDate = (dateString) => {
  if (!dateString) return null;
  try {
    const parsed = parseISO(dateString);
    // Check for invalid date (e.g., "Invalid Date")
    if (isNaN(parsed.getTime())) return null;
    return parsed;
  } catch (e) {
    console.error('Error parsing date:', dateString, e);
    return null;
  }
};

// Safe date formatting helper
const safeFormatDate = (dateString, formatStr = 'MMM d, yyyy') => {
  const date = safeParseDate(dateString);
  if (!date) return '';
  try {
    return format(date, formatStr);
  } catch (e) {
    console.error('Error formatting date:', dateString, e);
    return dateString || ''; // Fallback to original string if formatting fails
  }
};

// Safe month formatting helper
const safeFormatMonth = (monthString) => {
  if (!monthString) return '';
  try {
    // monthString should be YYYY-MM format
    const date = parseISO(`${monthString}-01`);
    if (isNaN(date.getTime())) return monthString;
    return format(date, 'MMMM yyyy');
  } catch (e) {
    console.error('Error formatting month:', monthString, e);
    return monthString;
  }
};

// Safe difference in days calculation
const safeDifferenceInDays = (date1String, date2String) => {
  const date1 = safeParseDate(date1String);
  const date2 = safeParseDate(date2String);
  if (!date1 || !date2) return 0; // Return 0 or handle error appropriately if dates are invalid
  try {
    return differenceInDays(date1, date2);
  } catch (e) {
    console.error('Error calculating difference in days:', e);
    return 0;
  }
};

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

const statusColors = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200"
};

export default function LoadingEvents() {
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [formData, setFormData] = useState({
    barge_id: '',
    barge_name: '',
    tug_id: '',
    tug_name: '',
    scheduled_date: '',
    scheduled_time: '',
    terminal_location: '',
    supplier: '',
    is_truck_loading: false,
    truck_numbers: ['', '', '', '', '', '', '', '', '', ''],
    bol_numbers: ['', '', '', '', '', '', '', '', '', ''],
    truck_gallons: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    captain: '',
    deckhand: '',
    tankerman: '',
    crew_members: [],
    product_type: '',
    gallons_to_load: '',
    sage_order_number: '',
    status: 'scheduled',
    related_delivery_id: '',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: loadingEvents = [] } = useQuery({
    queryKey: ['loading-events'],
    queryFn: () => base44.entities.LoadingEvent.list('-scheduled_date'),
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['dispatches'],
    queryFn: () => base44.entities.Dispatch.list('-start_date'),
  });

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['barge-inventory'],
    queryFn: () => base44.entities.BargeInventory.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const { data: terminals = [] } = useQuery({
    queryKey: ['terminals'],
    queryFn: () => base44.entities.Terminal.list(),
    initialData: [],
  });

  // Get suppliers for selected terminal
  const selectedTerminal = terminals.find(t => t.name === formData.terminal_location);
  const availableSuppliers = selectedTerminal?.suppliers || [];

  const { data: crewMembers = [] } = useQuery({
    queryKey: ['crew-members'],
    queryFn: () => base44.entities.CrewMember.filter({ is_active: true }),
    initialData: [],
  });

  const { data: tugs = [] } = useQuery({
    queryKey: ['tugs'],
    queryFn: () => base44.entities.Tug.list(),
    initialData: [],
  });

  const activeProducts = products.filter(p => p.is_active !== false);
  
  // Organize and alphabetize products by category
  const fuelProducts = activeProducts
    .filter(p => p.category === 'Fuel' || !p.category || p.category === 'Other')
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const lubeProducts = activeProducts
    .filter(p => p.category === 'Lubes')
    .sort((a, b) => a.name.localeCompare(b.name));
  
  // Filter active terminals
  const activeTerminals = terminals.filter(t => t.is_active !== false);

  // Get unique months from loading events
  const availableMonths = [...new Set(loadingEvents.map(e => {
    if (!e.scheduled_date) return null;
    try {
      return e.scheduled_date.substring(0, 7); // Get YYYY-MM directly
    } catch (e) {
      console.error('Error extracting month from loading event:', e.scheduled_date, e);
      return null;
    }
  }).filter(Boolean))].sort().reverse();

  // Filter loading events by market and month
  const filteredLoadingEvents = loadingEvents.filter(e => {
    // Market filter
    const matchesMarket = selectedMarket === 'all' || (() => {
      const barge = barges.find(b => b.id === e.barge_id);
      return barge?.market === selectedMarket;
    })();
    
    // Month filter
    let matchesMonth = selectedMonth === 'all';
    if (!matchesMonth && e.scheduled_date) {
      try {
        matchesMonth = e.scheduled_date.substring(0, 7) === selectedMonth;
      } catch (err) {
        console.error('Error matching month for loading event:', e.scheduled_date, err);
        matchesMonth = false;
      }
    }
    
    return matchesMarket && matchesMonth;
  });

  // Generate 24-hour time options with 30-minute increments
  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeOptions.push(timeString);
    }
  }

  // Filter crew by position and market (based on selected barge's market)
  const getFilteredCrew = () => {
    if (!formData.barge_id) return { captains: [], deckhands: [], tankermen: [], allCrew: [] };
    
    const selectedBarge = barges.find(b => b.id === formData.barge_id);
    const market = selectedBarge?.market;
    
    if (!market) return { captains: [], deckhands: [], tankermen: [], allCrew: [] };
    
    return {
      captains: crewMembers.filter(u => u.position === 'captain' && crewAvailableForMarket(u.market, market)),
      deckhands: crewMembers.filter(u => u.position === 'deckhand' && crewAvailableForMarket(u.market, market)),
      tankermen: crewMembers.filter(u => u.position === 'tankerman' && crewAvailableForMarket(u.market, market)),
      allCrew: crewMembers.filter(u => crewAvailableForMarket(u.market, market))
    };
  };

  const { captains, deckhands, tankermen, allCrew } = getFilteredCrew();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.LoadingEvent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loading-events'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LoadingEvent.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loading-events'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LoadingEvent.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loading-events'] });
    },
  });

  const resetForm = () => {
    setFormData({
      barge_id: '',
      barge_name: '',
      tug_id: '',
      tug_name: '',
      scheduled_date: '',
      scheduled_time: '',
      terminal_location: '',
      is_truck_loading: false,
      truck_numbers: ['', '', '', '', '', '', '', '', '', ''],
      bol_numbers: ['', '', '', '', '', '', '', '', '', ''],
      truck_gallons: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      captain: '',
      deckhand: '',
      tankerman: '',
      crew_members: [],
      product_type: '',
      gallons_to_load: '',
      sage_order_number: '',
      status: 'scheduled',
      related_delivery_id: '',
      notes: ''
    });
    setShowForm(false);
    setEditingEvent(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const finalTruckNumbers = [];
    const finalBolNumbers = [];
    const finalTruckGallons = [];

    // Iterate through the 10 potential truck entries
    for (let i = 0; i < 10; i++) {
      const truckNum = formData.truck_numbers[i]?.trim();
      const bolNum = formData.bol_numbers[i]?.trim();
      const truckGal = parseFloat(formData.truck_gallons[i]); // Will be NaN if not a number

      // Only include this entry if a truck number is provided
      if (truckNum) {
        finalTruckNumbers.push(truckNum);
        finalBolNumbers.push(bolNum || ''); // Store empty string if BOL is not provided
        finalTruckGallons.push(isNaN(truckGal) ? 0 : truckGal); // Store 0 if gallons not provided or invalid
      }
    }

    let finalGallonsToLoad = formData.gallons_to_load;

    // If truck loading is enabled, calculate total gallons from trucks
    if (formData.is_truck_loading) {
      finalGallonsToLoad = finalTruckGallons.reduce((sum, g) => sum + g, 0);
    } else {
      // If truck loading is not enabled, use the manually entered gallons_to_load
      finalGallonsToLoad = parseFloat(formData.gallons_to_load) || 0;
    }

    const cleanedData = {
      ...formData,
      truck_numbers: finalTruckNumbers,
      bol_numbers: finalBolNumbers,
      truck_gallons: finalTruckGallons,
      gallons_to_load: finalGallonsToLoad
    };
    
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: cleanedData });
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    // Ensure we have arrays of 10 elements, padding with empty strings/zeros if necessary
    const truck_numbers = [...(event.truck_numbers || [])];
    const bol_numbers = [...(event.bol_numbers || [])];
    const truck_gallons = [...(event.truck_gallons || [])]; // Include truck_gallons
    while (truck_numbers.length < 10) truck_numbers.push('');
    while (bol_numbers.length < 10) bol_numbers.push('');
    while (truck_gallons.length < 10) truck_gallons.push(0); // Pad with 0 for truck_gallons
    
    setFormData({
      ...event,
      crew_members: event.crew_members || [],
      truck_numbers,
      bol_numbers,
      truck_gallons, // Set truck_gallons in form data
      gallons_to_load: event.gallons_to_load || ''
    });
    setShowForm(true);
    // Scroll to top to show the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBargeSelect = (bargeId) => {
    const selectedBarge = barges.find(b => b.id === bargeId);
    setFormData({
      ...formData,
      barge_id: bargeId,
      barge_name: selectedBarge?.name || '',
      terminal_location: '', // Reset terminal selection when barge changes
      captain: '', // Reset crew when barge changes
      deckhand: '',
      tankerman: ''
    });
  };

  // Get filtered terminals based on selected barge's market
  const getFilteredTerminals = () => {
    if (!formData.barge_id) {
      return activeTerminals; // Show all terminals if no barge selected
    }
    
    const selectedBarge = barges.find(b => b.id === formData.barge_id);
    if (!selectedBarge || !selectedBarge.market) {
      return activeTerminals; // Fallback to all terminals
    }
    
    return activeTerminals.filter(t => t.market === selectedBarge.market);
  };

  const filteredTerminals = getFilteredTerminals();

  const handleTruckNumberChange = (index, value) => {
    const newTruckNumbers = [...formData.truck_numbers];
    newTruckNumbers[index] = value;
    setFormData({...formData, truck_numbers: newTruckNumbers});
  };

  const handleBolNumberChange = (index, value) => {
    const newBolNumbers = [...formData.bol_numbers];
    newBolNumbers[index] = value;
    setFormData({...formData, bol_numbers: newBolNumbers});
  };

  const handleTruckGallonsChange = (index, value) => {
    const newTruckGallons = [...formData.truck_gallons];
    newTruckGallons[index] = parseFloat(value) || 0;
    setFormData({...formData, truck_gallons: newTruckGallons});
  };

  // Calculate truck total gallons
  const calculateTruckTotal = () => {
    return formData.truck_gallons.reduce((sum, g, idx) => {
      // Only sum gallons for trucks that have a truck number entered
      const truckNum = formData.truck_numbers[idx];
      if (truckNum && truckNum.trim() !== '') {
        return sum + (parseFloat(g) || 0);
      }
      return sum;
    }, 0);
  };

  // Calculate current inventory per barge
  const getBargeCurrentInventory = (bargeId) => {
    const bargeTanks = inventory.filter(t => t.barge_id === bargeId);
    return bargeTanks.reduce((sum, tank) => sum + (tank.current_gallons || 0), 0);
  };

  // Get upcoming deliveries per barge - exclude non-delivery events
  const getUpcomingDeliveries = (bargeId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to start of day
    return deliveries.filter(d => {
      if (!d.start_date) return false;
      const deliveryDate = safeParseDate(d.start_date);
      if (!deliveryDate) return false; // Skip if date is invalid

      return d.barge_id === bargeId &&
        (d.status === 'scheduled' || d.status === 'in_transit') &&
        deliveryDate >= today &&
        (!d.event_type || d.event_type === 'delivery'); // Exclude non-delivery events
    }).sort((a, b) => {
      const dateA = safeParseDate(a.start_date);
      const dateB = safeParseDate(b.start_date);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1; // Put null/invalid dates at the end
      if (!dateB) return -1;
      return dateA.getTime() - dateB.getTime();
    });
  };

  // Calculate loading needs - filter by market
  const bargeLoadingNeeds = barges
    .filter(barge => selectedMarket === 'all' || barge.market === selectedMarket)
    .map(barge => {
      const currentInventory = getBargeCurrentInventory(barge.id);
      const upcomingDeliveries = getUpcomingDeliveries(barge.id);
      const nextDelivery = upcomingDeliveries[0];
      
      let needsLoading = false;
      let gallonsNeeded = 0;
      let urgency = 'ok'; // ok, warning, critical
      
      if (nextDelivery && nextDelivery.gallons_delivered) {
        gallonsNeeded = nextDelivery.gallons_delivered - currentInventory;
        needsLoading = gallonsNeeded > 0;
        
        const today = new Date();
        today.setHours(0,0,0,0);
        const daysUntilDelivery = safeDifferenceInDays(nextDelivery.start_date, today.toISOString());
        
        if (needsLoading) {
          if (daysUntilDelivery <= 2) {
            urgency = 'critical';
          } else if (daysUntilDelivery <= 5) {
            urgency = 'warning';
          }
        }
      }
      
      return {
        barge,
        currentInventory,
        upcomingDeliveries,
        nextDelivery,
        needsLoading,
        gallonsNeeded: Math.max(0, gallonsNeeded),
        urgency
      };
    }).filter(b => b.upcomingDeliveries.length > 0);

  // Group loading events by status
  const upcomingLoadingEvents = filteredLoadingEvents.filter(e => 
    e.status === 'scheduled' || e.status === 'in_progress'
  );

  const completedLoadingEvents = filteredLoadingEvents.filter(e =>
    e.status === 'completed'
  );

  const cancelledLoadingEvents = filteredLoadingEvents.filter(e =>
    e.status === 'cancelled'
  );

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Loading Events
            </h1>
            <p className="text-slate-600">Schedule terminal loading for upcoming deliveries</p>
          </div>
          <div className="flex gap-3">
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
              </SelectContent>
            </Select>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {availableMonths.map(month => (
                  <SelectItem key={month} value={month}>
                    {safeFormatMonth(month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Schedule Loading
            </Button>
          </div>
        </div>

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
                    {editingEvent ? 'Edit Loading Event' : 'Schedule Loading Event'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="barge">Barge *</Label>
                        <Select
                          value={formData.barge_id}
                          onValueChange={handleBargeSelect}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select barge" />
                          </SelectTrigger>
                          <SelectContent>
                            {barges.map((barge) => (
                              <SelectItem key={barge.id} value={barge.id}>
                                {barge.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="terminal_location">Terminal Location *</Label>
                        <Select
                          value={formData.terminal_location}
                          onValueChange={(value) => setFormData({...formData, terminal_location: value})}
                          required
                          disabled={!formData.barge_id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={!formData.barge_id ? "Select barge first" : "Select terminal"} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredTerminals.length === 0 ? (
                              <div className="p-2 text-sm text-slate-500 text-center">
                                {formData.barge_id 
                                  ? "No terminals found for this market" 
                                  : "Select a barge first"}
                              </div>
                            ) : (
                              filteredTerminals.map((terminal) => (
                                <SelectItem key={terminal.id} value={terminal.name}>
                                  {terminal.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {!formData.barge_id && (
                          <p className="text-xs text-blue-600">Select a barge to see available terminals</p>
                        )}
                        {formData.barge_id && filteredTerminals.length === 0 && (
                          <p className="text-xs text-orange-600">No terminals configured for this market. Add terminals in Inventory → Terminals</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="date">Scheduled Date *</Label>
                        <Input
                          id="date"
                          type="date"
                          value={formData.scheduled_date}
                          onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="time">Scheduled Time</Label>
                        <Select
                          value={formData.scheduled_time}
                          onValueChange={(value) => setFormData({...formData, scheduled_time: value})}
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
                       <Label htmlFor="supplier">Supplier</Label>
                       <Select
                         value={formData.supplier}
                         onValueChange={(value) => setFormData({...formData, supplier: value})}
                       >
                         <SelectTrigger>
                           <SelectValue placeholder="Select supplier" />
                         </SelectTrigger>
                         <SelectContent>
                           {availableSuppliers.length === 0 ? (
                             <div className="p-2 text-sm text-slate-500">
                               {formData.terminal_location ? 'No suppliers configured for this terminal' : 'Select terminal first'}
                             </div>
                           ) : (
                             availableSuppliers.map((supplier) => (
                               <SelectItem key={supplier} value={supplier}>
                                 {supplier}
                               </SelectItem>
                             ))
                           )}
                         </SelectContent>
                       </Select>
                      </div>

                      <div className="space-y-2">
                       <Label htmlFor="product">Product Type</Label>
                       <Select
                         value={formData.product_type}
                         onValueChange={(value) => setFormData({...formData, product_type: value})}
                       >
                         <SelectTrigger>
                           <SelectValue placeholder="Select product" />
                         </SelectTrigger>
                         <SelectContent>
                           {activeProducts.length === 0 ? (
                             <div className="p-2 text-sm text-slate-500 text-center">
                               No products available
                             </div>
                           ) : (
                             <>
                               {fuelProducts.length > 0 && (
                                 <>
                                   <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">
                                     Fuel Products
                                   </div>
                                   {fuelProducts.map((product) => (
                                     <SelectItem key={product.id} value={product.name}>
                                       {product.name}
                                     </SelectItem>
                                   ))}
                                 </>
                               )}
                               {lubeProducts.length > 0 && (
                                 <>
                                   <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase mt-1 border-t">
                                     Lubricants
                                   </div>
                                   {lubeProducts.map((product) => (
                                     <SelectItem key={product.id} value={product.name}>
                                       {product.name}
                                     </SelectItem>
                                   ))}
                                 </>
                               )}
                             </>
                           )}
                         </SelectContent>
                       </Select>
                      </div>

                      {/* The gallons to load field is now conditional based on is_truck_loading */}
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

                      <div className="space-y-2">
                        <Label htmlFor="tug">Tug</Label>
                        <Select
                          value={formData.tug_id}
                          onValueChange={(value) => {
                            const selectedTug = tugs.find(t => t.id === value);
                            setFormData({
                              ...formData,
                              tug_id: value,
                              tug_name: selectedTug?.name || ''
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select tug (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {tugs
                              .filter(t => {
                                if (!formData.barge_id) return true;
                                const selectedBarge = barges.find(b => b.id === formData.barge_id);
                                return !selectedBarge?.market || t.market === selectedBarge.market;
                              })
                              .map((tug) => (
                                <SelectItem key={tug.id} value={tug.id}>
                                  {tug.name} {tug.is_third_party ? '(3rd Party)' : ''}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator className="my-6" />

                    {/* Crew Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-slate-700" />
                        <h3 className="text-lg font-semibold text-slate-900">Crew</h3>
                      </div>

                      <div className="grid md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="captain">Captain</Label>
                          <Select
                            value={formData.captain}
                            onValueChange={(value) => setFormData({...formData, captain: value})}
                            disabled={!formData.barge_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formData.barge_id ? "Select captain" : "Select barge first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {captains.length === 0 ? (
                                <div className="p-2 text-sm text-slate-500 text-center">
                                  {formData.barge_id ? "No captains in this market" : "Select barge first"}
                                </div>
                              ) : (
                                captains.map((u) => (
                                 <SelectItem key={u.id} value={capitalizeName(u.full_name)}>
                                   {capitalizeName(u.full_name)}
                                 </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="tankerman">Tankerman</Label>
                          <Select
                            value={formData.tankerman}
                            onValueChange={(value) => setFormData({...formData, tankerman: value})}
                            disabled={!formData.barge_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formData.barge_id ? "Select tankerman" : "Select barge first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {tankermen.length === 0 ? (
                                <div className="p-2 text-sm text-slate-500 text-center">
                                  {formData.barge_id ? "No tankermen in this market" : "Select barge first"}
                                </div>
                              ) : (
                                tankermen.map((u) => (
                                 <SelectItem key={u.id} value={capitalizeName(u.full_name)}>
                                   {capitalizeName(u.full_name)}
                                 </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="deckhand">Deckhand</Label>
                          <Select
                            value={formData.deckhand}
                            onValueChange={(value) => setFormData({...formData, deckhand: value})}
                            disabled={!formData.barge_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={formData.barge_id ? "Select deckhand" : "Select barge first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {deckhands.length === 0 ? (
                                <div className="p-2 text-sm text-slate-500 text-center">
                                  {formData.barge_id ? "No deckhands in this market" : "Select barge first"}
                                </div>
                              ) : (
                                deckhands.map((u) => (
                                 <SelectItem key={u.id} value={capitalizeName(u.full_name)}>
                                   {capitalizeName(u.full_name)}
                                 </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Additional Crew Members */}
                      <div className="space-y-2 md:col-span-3">
                        <Label>Additional Crew Members</Label>
                        <div className="space-y-2">
                          {(formData.crew_members || []).map((member, index) => (
                            <div key={index} className="flex gap-2">
                              <Select
                                value={member}
                                onValueChange={(value) => {
                                  const newCrewMembers = [...formData.crew_members];
                                  newCrewMembers[index] = value;
                                  setFormData({...formData, crew_members: newCrewMembers});
                                }}
                                disabled={!formData.barge_id}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder={formData.barge_id ? "Select crew member" : "Select barge first"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {allCrew.length === 0 ? (
                                    <div className="p-2 text-sm text-slate-500 text-center">
                                      {formData.barge_id ? "No crew members in this market" : "Select barge first"}
                                    </div>
                                  ) : (
                                    allCrew.map((u) => (
                                      <SelectItem key={u.id} value={capitalizeName(u.full_name)}>
                                        {capitalizeName(u.full_name)} ({u.position})
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const newCrewMembers = formData.crew_members.filter((_, i) => i !== index);
                                  setFormData({...formData, crew_members: newCrewMembers});
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFormData({...formData, crew_members: [...formData.crew_members, '']});
                            }}
                            disabled={!formData.barge_id}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Crew Member
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Separator className="my-6" />

                    {/* Truck Loading Section */}
                    <div className="border-t border-slate-200 pt-6">
                      <div className="flex items-center space-x-2 mb-4">
                        <input
                          type="checkbox"
                          id="is_truck_loading"
                          checked={formData.is_truck_loading}
                          onChange={(e) => setFormData({
                            ...formData, 
                            is_truck_loading: e.target.checked
                          })}
                          className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                        />
                        <Label htmlFor="is_truck_loading" className="text-base font-semibold cursor-pointer">
                          Loading via PTL Trucks
                        </Label>
                      </div>

                      {formData.is_truck_loading && (
                        <div className="space-y-4 pl-6">
                          <p className="text-sm text-slate-600 mb-4">Enter up to 10 trucks used for this loading event. Empty fields will be ignored.</p>
                          {Array.from({ length: 10 }).map((_, index) => (
                            <div key={index} className="grid md:grid-cols-4 gap-4 p-3 bg-slate-50 rounded-lg">
                              <div className="space-y-2">
                                <Label htmlFor={`truck_${index}`} className="text-xs text-slate-600">
                                  Truck #{index + 1}
                                </Label>
                                <Input
                                  id={`truck_${index}`}
                                  value={formData.truck_numbers[index]}
                                  onChange={(e) => handleTruckNumberChange(index, e.target.value)}
                                  placeholder={`Truck #${index + 1}`}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`bol_${index}`} className="text-xs text-slate-600">
                                  BOL #{index + 1}
                                </Label>
                                <Input
                                  id={`bol_${index}`}
                                  value={formData.bol_numbers[index]}
                                  onChange={(e) => handleBolNumberChange(index, e.target.value)}
                                  placeholder={`BOL for Truck #${index + 1}`}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`gallons_${index}`} className="text-xs text-slate-600">
                                  Gallons
                                </Label>
                                <Input
                                  id={`gallons_${index}`}
                                  type="number"
                                  value={formData.truck_gallons[index] === 0 ? '' : formData.truck_gallons[index]} // Show empty for 0 to make it easier to type
                                  onChange={(e) => handleTruckGallonsChange(index, e.target.value)}
                                  placeholder="0"
                                />
                              </div>

                              <div className="flex items-end">
                                {formData.truck_numbers[index] && formData.truck_gallons[index] > 0 && (
                                  <div className="text-sm font-medium text-emerald-600">
                                    {formData.truck_gallons[index].toLocaleString()} gal
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          
                          {/* Truck Total */}
                          <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-bold text-slate-900">Total Gallons (All Trucks):</span>
                              <span className="text-2xl font-bold text-emerald-600">
                                {calculateTruckTotal().toLocaleString()} gal
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {!formData.is_truck_loading && (
                        <div className="space-y-2 pl-6">
                          <Label htmlFor="gallons_manual">Gallons to Load</Label>
                          <Input
                            id="gallons_manual"
                            type="number"
                            value={formData.gallons_to_load}
                            onChange={(e) => setFormData({...formData, gallons_to_load: parseFloat(e.target.value)})}
                            placeholder="0"
                          />
                        </div>
                      )}
                    </div>

                    {/* SAGE Order Number - Only for Lubricants */}
                    {formData.product_type && formData.product_type.toLowerCase().includes('lubricant') && (
                      <div className="space-y-2">
                        <Label htmlFor="sage_order_number">SAGE Order Number</Label>
                        <Input
                          id="sage_order_number"
                          value={formData.sage_order_number}
                          onChange={(e) => setFormData({...formData, sage_order_number: e.target.value})}
                          placeholder="SAGE sales order number"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        placeholder="Additional notes about this loading event..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        className="bg-gradient-to-r from-purple-600 to-purple-700"
                        disabled={createMutation.isPending || updateMutation.isPending}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingEvent ? 'Update' : 'Schedule')} Loading
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Needs Alert Section */}
        {bargeLoadingNeeds.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Loading Needs Analysis</h2>
            <div className="grid gap-4">
              {bargeLoadingNeeds.map((need) => (
                <Card 
                  key={need.barge.id} 
                  className={`shadow-md border-2 ${
                    need.urgency === 'critical' ? 'border-red-300 bg-red-50' :
                    need.urgency === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                    'border-emerald-300 bg-emerald-50'
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                          need.urgency === 'critical' ? 'bg-gradient-to-br from-red-500 to-red-600' :
                          need.urgency === 'warning' ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' :
                          'bg-gradient-to-br from-emerald-500 to-emerald-600'
                        }`}>
                          <Ship className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">{need.barge.name}</h3>
                          <p className="text-sm text-slate-600">{need.barge.market}</p>
                        </div>
                      </div>
                      {need.urgency === 'critical' && (
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          URGENT
                        </Badge>
                      )}
                      {need.urgency === 'warning' && (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                          <Clock className="w-3 h-3 mr-1" />
                          SOON
                        </Badge>
                      )}
                      {need.urgency === 'ok' && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          OK
                        </Badge>
                      )}
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mb-4">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-600">Current Inventory</p>
                        <p className="text-lg font-bold text-slate-900">
                          {need.currentInventory.toLocaleString()} gal
                        </p>
                      </div>
                      {need.nextDelivery && (
                        <>
                          <div className="space-y-1">
                            <p className="text-xs text-slate-600">Next Delivery Needs</p>
                            <p className="text-lg font-bold text-slate-900">
                              {need.nextDelivery.gallons_delivered?.toLocaleString() || 0} gal
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-slate-600">Gallons to Load</p>
                            <p className={`text-lg font-bold ${
                              need.needsLoading ? 'text-red-600' : 'text-emerald-600'
                            }`}>
                              {need.needsLoading ? need.gallonsNeeded.toLocaleString() : '0'} gal
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {need.nextDelivery && (
                      <div className="p-3 bg-white rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarIcon className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold text-slate-900">Next Delivery:</span>
                          <span className="text-slate-700">
                            {safeFormatDate(need.nextDelivery.start_date, 'MMM d, yyyy')}
                          </span>
                          <Badge variant="outline" className="ml-2">
                            {safeDifferenceInDays(need.nextDelivery.start_date, new Date().toISOString())} days away
                          </Badge>
                        </div>
                        <div className="text-sm text-slate-600 space-y-1">
                          <div>Vessel: {need.nextDelivery.vessel_name}</div>
                          <div>Destination: {need.nextDelivery.destination}</div>
                          {need.nextDelivery.cargo_type && (
                            <div>Product: {need.nextDelivery.cargo_type}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Barge Crew Reminder */}
        <Card className="shadow-md border-2 border-blue-300 bg-blue-50">
          <CardContent className="p-6">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Important Reminder for Barge Crew
            </h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>• <strong>After completing a loading event:</strong> Update the actual gallons loaded on this page</p>
              <p>• <strong>Immediately update your tank chart readings</strong> in Inventory → Tank Levels</p>
              <p>• Accurate tank readings are critical for inventory tracking and upcoming deliveries</p>
              <p>• Questions? Contact dispatch</p>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Loading Events */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Scheduled Loading Events</h2>
          {upcomingLoadingEvents.length === 0 ? (
            <Card className="shadow-md border-slate-200">
              <CardContent className="p-12 text-center">
                <Droplet className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">No Loading Events Scheduled</h3>
                <p className="text-slate-600 mb-6">Schedule loading events to prepare barges for upcoming deliveries</p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="bg-gradient-to-r from-purple-600 to-purple-700"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Schedule First Loading
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {upcomingLoadingEvents.map((event) => (
                <Card key={event.id} className="shadow-md border-slate-200 hover:shadow-lg transition-shadow duration-200">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                          <Droplet className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-slate-900">{event.barge_name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={`${statusColors[event.status]} border text-xs`}>
                              {event.status.replace('_', ' ')}
                            </Badge>
                            {event.is_truck_loading && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                                Truck Loading
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(event)}
                          className="hover:bg-slate-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this loading event?')) {
                              deleteMutation.mutate(event.id);
                            }
                          }}
                          className="hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-700">
                        <CalendarIcon className="w-4 h-4" />
                        <span className="font-medium">
                          {safeFormatDate(event.scheduled_date, 'MMM d, yyyy')}
                        </span>
                        {event.scheduled_time && (
                          <span className="text-slate-600">at {event.scheduled_time}</span>
                        )}
                        </div>
                        <div className="flex items-center gap-2 text-slate-700">
                        <MapPin className="w-4 h-4" />
                        <span>{event.terminal_location}</span>
                        </div>
                        {event.supplier && (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                            {event.supplier}
                          </Badge>
                        </div>
                        )}
                        {event.is_truck_loading && event.truck_numbers && event.truck_numbers.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
                          <p className="text-xs font-semibold text-blue-900 mb-2">
                            Trucks Used ({event.truck_numbers.length})
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {event.truck_numbers.map((truck, idx) => (
                              <div key={idx} className="text-xs text-slate-700">
                                <span className="font-semibold">{truck}</span>
                                {event.bol_numbers && event.bol_numbers[idx] && (
                                  <span className="text-slate-500 ml-1">
                                    ({event.bol_numbers[idx]})
                                  </span>
                                )}
                                {event.truck_gallons && event.truck_gallons[idx] > 0 && (
                                  <span className="text-emerald-600 ml-1">
                                    ({event.truck_gallons[idx].toLocaleString()} gal)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        )}
                        {event.product_type && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <Droplet className="w-4 h-4" />
                          <span>{event.product_type}</span>
                        </div>
                        )}
                        {event.sage_order_number && (
                        <div className="text-sm text-slate-700">
                          <span className="font-medium">SAGE Order #:</span> {event.sage_order_number}
                        </div>
                        )}
                        {event.tug_name && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <Ship className="w-4 h-4" />
                          <span>Tug: {event.tug_name}</span>
                        </div>
                        )}
                        {event.gallons_to_load && (
                        <div className="font-semibold text-slate-900 mt-2">
                          {event.gallons_to_load.toLocaleString()} gallons
                        </div>
                        )}
                        {(event.captain || event.tankerman || event.deckhand || (event.crew_members && event.crew_members.length > 0)) && (
                        <div className="pt-2 border-t border-slate-100 space-y-1 text-slate-700">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span className="font-medium">Crew:</span>
                          </div>
                          {event.captain && <div className="text-sm">Captain: {event.captain}</div>}
                          {event.tankerman && <div className="text-sm">Tankerman: {event.tankerman}</div>}
                          {event.deckhand && <div className="text-sm">Deckhand: {event.deckhand}</div>}
                          {event.crew_members && event.crew_members.length > 0 && (
                            <div className="text-sm">Additional: {event.crew_members.filter(m => m).join(', ')}</div>
                          )}
                        </div>
                        )}
                        {event.notes && (
                        <div className="pt-2 border-t border-slate-100 text-slate-600">
                          {event.notes}
                        </div>
                        )}
                        </div>
                        </CardContent>
                        </Card>
                        ))}
                        </div>
                        )}
                        </div>

                        {/* Completed Loading Events */}
        {completedLoadingEvents.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Completed Loading Events</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {completedLoadingEvents.map((event) => (
                <Card key={event.id} className="shadow-md border-slate-200 hover:shadow-lg transition-shadow duration-200 opacity-75">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-slate-900">{event.barge_name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={`${statusColors[event.status]} border text-xs`}>
                              {event.status.replace('_', ' ')}
                            </Badge>
                            {event.is_truck_loading && (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                                Truck Loading
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(event)}
                          className="hover:bg-slate-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this loading event?')) {
                              deleteMutation.mutate(event.id);
                            }
                          }}
                          className="hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-700">
                        <CalendarIcon className="w-4 h-4" />
                        <span className="font-medium">
                          {safeFormatDate(event.scheduled_date, 'MMM d, yyyy')}
                        </span>
                        {event.scheduled_time && (
                          <span className="text-slate-600">at {event.scheduled_time}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <MapPin className="w-4 h-4" />
                        <span>{event.terminal_location}</span>
                      </div>
                      {event.is_truck_loading && event.truck_numbers && event.truck_numbers.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
                          <p className="text-xs font-semibold text-blue-900 mb-2">
                            Trucks Used ({event.truck_numbers.length})
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {event.truck_numbers.map((truck, idx) => (
                              <div key={idx} className="text-xs text-slate-700">
                                <span className="font-semibold">{truck}</span>
                                {event.bol_numbers && event.bol_numbers[idx] && (
                                  <span className="text-slate-500 ml-1">
                                    ({event.bol_numbers[idx]})
                                  </span>
                                )}
                                {event.truck_gallons && event.truck_gallons[idx] > 0 && (
                                  <span className="text-emerald-600 ml-1">
                                    ({event.truck_gallons[idx].toLocaleString()} gal)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {event.product_type && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <Droplet className="w-4 h-4" />
                          <span>{event.product_type}</span>
                        </div>
                      )}
                      {event.sage_order_number && (
                        <div className="text-sm text-slate-700">
                          <span className="font-medium">SAGE Order #:</span> {event.sage_order_number}
                        </div>
                      )}
                      {event.tug_name && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <Ship className="w-4 h-4" />
                          <span>Tug: {event.tug_name}</span>
                        </div>
                      )}
                      {event.gallons_to_load && (
                        <div className="font-semibold text-slate-900 mt-2">
                          {event.gallons_to_load.toLocaleString()} gallons
                        </div>
                      )}
                      {(event.captain || event.tankerman || event.deckhand || (event.crew_members && event.crew_members.length > 0)) && (
                        <div className="pt-2 border-t border-slate-100 space-y-1 text-slate-700">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span className="font-medium">Crew:</span>
                          </div>
                          {event.captain && <div className="text-sm">Captain: {event.captain}</div>}
                          {event.tankerman && <div className="text-sm">Tankerman: {event.tankerman}</div>}
                          {event.deckhand && <div className="text-sm">Deckhand: {event.deckhand}</div>}
                          {event.crew_members && event.crew_members.length > 0 && (
                            <div className="text-sm">Additional: {event.crew_members.filter(m => m).join(', ')}</div>
                          )}
                        </div>
                      )}
                      {event.notes && (
                        <div className="pt-2 border-t border-slate-100 text-slate-600">
                          {event.notes}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}