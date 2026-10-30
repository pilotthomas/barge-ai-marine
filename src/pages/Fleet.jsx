import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Ship, Edit2, Save, MapPin, Calendar, AlertTriangle, Layers, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { differenceInDays, format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const statusColors = {
  available: "bg-emerald-100 text-emerald-800 border-emerald-200",
  dispatched: "bg-orange-100 text-orange-800 border-orange-200",
  maintenance: "bg-yellow-100 text-yellow-800 border-yellow-200",
  retired: "bg-slate-100 text-slate-800 border-slate-200"
};

const marketColors = {
  "Long Beach": "from-orange-500 to-orange-600",
  "Oakland": "from-emerald-500 to-emerald-600",
  "Portland": "from-purple-500 to-purple-600",
  "Seattle": "from-blue-500 to-blue-600",
  "Wood River": "from-amber-500 to-amber-600",
  "St. Louis": "from-amber-600 to-amber-700",
  "Wickliffe": "from-yellow-600 to-yellow-700",
  "Memphis": "from-rose-500 to-rose-600",
  "Baton Rouge": "from-red-500 to-red-600",
  "Mobile": "from-teal-500 to-teal-600"
};

const complianceFields = [
  { key: 'uscg_2_5_year_drydock', label: 'USCG 2.5 Year Dry Dock Exam' },
  { key: 'uscg_internal_exam', label: 'USCG Internal Exam' },
  { key: 'uscg_5_year_drydock', label: 'USCG 5 Year Dry Dock Exam' },
  { key: 'uscg_cargo_tank_exam', label: 'USCG Cargo Tank Exam' },
  { key: 'abs_2_5_year_drydock', label: 'ABS 2.5 Year Dry Dock Exam' },
  { key: 'sire_expiration', label: 'SIRE Expiration Date' },
  { key: 'abs_load_line', label: 'ABS Load Line' },
  { key: 'abs_class', label: 'ABS Class' },
  { key: 'uscg_coi_expiration', label: 'USCG COI Expiration' },
  { key: 'uscg_cod_expiration', label: 'USCG COD Expiration' },
];

const carbFields = [
  { key: 'carb_tier3_mandate', label: 'CARB Tier 3 Mandate Date' },
  { key: 'carb_tier4_mandate', label: 'CARB Tier 4 Mandate Date' },
];

const tankColorStyles = {
  yellow: "bg-yellow-400 border-yellow-500",
  green: "bg-green-400 border-green-500",
  red: "bg-red-400 border-red-500",
  blue: "bg-blue-400 border-blue-500",
  none: "bg-slate-100 border-slate-300"
};

export default function Fleet() {
  const [showForm, setShowForm] = useState(false);
  const [editingBarge, setEditingBarge] = useState(null);
  const [editingTank, setEditingTank] = useState(null);
  const [tankFormData, setTankFormData] = useState({
    barge_id: '',
    barge_name: '',
    tank_number: '',
    tank_position: 'starboard',
    tank_color: 'none',
    capacity_gallons: '',
    current_gallons: '',
    product_type: '',
    notes: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    designation: '',
    capacity_gallons: '',
    status: 'available',
    market: '',
    type: 'tank',
    year_built: '',
    uscg_2_5_year_drydock: '',
    uscg_internal_exam: '',
    uscg_5_year_drydock: '',
    uscg_cargo_tank_exam: '',
    abs_2_5_year_drydock: '',
    sire_expiration: '',
    abs_load_line: '',
    abs_class: '',
    uscg_coi_expiration: '',
    uscg_cod_expiration: '',
    carb_tier3_mandate: '',
    carb_tier4_mandate: ''
  });

  const queryClient = useQueryClient();

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  const { data: tanks = [] } = useQuery({
    queryKey: ['barge-inventory'],
    queryFn: () => base44.entities.BargeInventory.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const activeProducts = products.filter(p => p.is_active !== false);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Barge.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barges'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, originalBarge }) => {
      await base44.entities.Barge.update(id, data);
      
      // Sync SIRE expiration to scheduled maintenance task
      if (originalBarge && data.sire_expiration !== originalBarge.sire_expiration && data.sire_expiration) {
        const existingTasks = await base44.entities.MaintenanceTask.filter({
          vessel_id: id,
          vessel_type: 'barge',
          task_type: 'SIRE Compliance',
          task_name: 'SIRE annual inspection',
          status: 'scheduled'
        });
        
        if (existingTasks.length > 0) {
          // Update existing task
          await base44.entities.MaintenanceTask.update(existingTasks[0].id, {
            ...existingTasks[0],
            due_date: data.sire_expiration
          });
        } else {
          // Create new scheduled task
          await base44.entities.MaintenanceTask.create({
            vessel_type: 'barge',
            vessel_id: id,
            vessel_name: data.name || originalBarge.name,
            task_type: 'SIRE Compliance',
            task_name: 'SIRE annual inspection',
            due_date: data.sire_expiration,
            status: 'scheduled'
          });
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barges'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      resetForm();
    },
  });

  const createTankMutation = useMutation({
    mutationFn: async (data) => {
      const newTank = await base44.entities.BargeInventory.create({
        ...data,
        last_updated: new Date().toISOString()
      });

      // Create initial history snapshot
      await base44.entities.InventoryHistory.create({
        barge_id: data.barge_id,
        barge_name: data.barge_name,
        tank_number: data.tank_number,
        tank_position: data.tank_position,
        tank_color: data.tank_color || 'none',
        product_type: data.product_type || '',
        previous_gallons: 0,
        new_gallons: data.current_gallons || 0,
        change_gallons: data.current_gallons || 0,
        capacity_gallons: data.capacity_gallons,
        snapshot_date: new Date().toISOString(),
        change_type: 'initial',
        notes: 'Tank created'
      });

      return newTank;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barge-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
      resetTankForm();
    },
  });

  const updateTankMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BargeInventory.update(id, {
      ...data,
      last_updated: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barge-inventory'] });
      resetTankForm();
    },
  });

  const deleteTankMutation = useMutation({
    mutationFn: (id) => base44.entities.BargeInventory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barge-inventory'] });
      resetTankForm();
    },
  });

  const deleteBargeMutation = useMutation({
    mutationFn: (id) => base44.entities.Barge.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barges'] });
    },
  });

  const handleDeleteBarge = (barge) => {
    if (window.confirm(`Are you sure you want to delete barge "${barge.name}"? This cannot be undone.`)) {
      deleteBargeMutation.mutate(barge.id);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      designation: '',
      capacity_gallons: '',
      status: 'available',
      market: '',
      type: 'tank',
      year_built: '',
      uscg_2_5_year_drydock: '',
      uscg_internal_exam: '',
      uscg_5_year_drydock: '',
      uscg_cargo_tank_exam: '',
      abs_2_5_year_drydock: '',
      sire_expiration: '',
      abs_load_line: '',
      abs_class: '',
      uscg_coi_expiration: '',
      uscg_cod_expiration: '',
      carb_tier3_mandate: '',
      carb_tier4_mandate: ''
    });
    setShowForm(false);
    setEditingBarge(null);
  };

  const resetTankForm = () => {
    setTankFormData({
      barge_id: '',
      barge_name: '',
      tank_number: '',
      tank_position: 'starboard',
      tank_color: 'none',
      capacity_gallons: '',
      current_gallons: '',
      product_type: '',
      notes: ''
    });
    setEditingTank(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanData = { ...formData };
    if (cleanData.capacity_gallons === '' || cleanData.capacity_gallons === null) delete cleanData.capacity_gallons;
    if (cleanData.year_built === '' || cleanData.year_built === null) delete cleanData.year_built;
    if (editingBarge) {
      updateMutation.mutate({ id: editingBarge.id, data: cleanData, originalBarge: editingBarge });
    } else {
      createMutation.mutate(cleanData);
    }
  };

  const handleEdit = (barge) => {
    setEditingBarge(barge);
    setFormData(barge);
    setShowForm(true);
  };

  const handleAddTank = () => {
    if (!editingBarge) return;
    
    setTankFormData({
      barge_id: editingBarge.id,
      barge_name: editingBarge.name,
      tank_number: '',
      tank_position: 'starboard',
      tank_color: 'none',
      capacity_gallons: '',
      current_gallons: '',
      product_type: '',
      notes: ''
    });
    setEditingTank(null);
  };

  const handleEditTank = (tank) => {
    setEditingTank(tank);
    setTankFormData(tank);
  };

  const handleTankSubmit = (e) => {
    e.preventDefault();
    
    const submitData = {
      ...tankFormData,
      tank_number: parseFloat(tankFormData.tank_number),
      capacity_gallons: parseFloat(tankFormData.capacity_gallons),
      current_gallons: tankFormData.current_gallons ? parseFloat(tankFormData.current_gallons) : 0
    };
    
    if (editingTank) {
      updateTankMutation.mutate({ id: editingTank.id, data: submitData });
    } else {
      createTankMutation.mutate(submitData);
    }
  };

  const handleDeleteTank = () => {
    if (editingTank && window.confirm(`Are you sure you want to delete tank ${editingTank.tank_number}${editingTank.tank_position === 'port' ? 'Port' : 'Star'} from ${editingTank.barge_name}?`)) {
      deleteTankMutation.mutate(editingTank.id);
    }
  };

  const getTanksForBarge = (bargeId) => {
    return tanks.filter(t => t.barge_id === bargeId);
  };

  const getBargeTankCapacity = (bargeId) => {
    const bargeTanks = getTanksForBarge(bargeId);
    // Only count each unique tank once (by tank_number and tank_position)
    return bargeTanks.reduce((sum, tank) => {
      const isFirstOccurrence = !bargeTanks.slice(0, bargeTanks.indexOf(tank))
        .some(t => t.tank_number === tank.tank_number && t.tank_position === tank.tank_position);
      
      if (isFirstOccurrence) {
        return sum + (tank.capacity_gallons || 0);
      }
      return sum;
    }, 0);
  };

  const getComplianceStatus = (date) => {
    if (!date) return null;
    try {
      const daysUntil = differenceInDays(new Date(date), new Date());
      if (daysUntil < 0) return 'overdue';
      if (daysUntil <= 60) return 'due_soon';
      return 'ok';
    } catch (error) {
      return null;
    }
  };

  const calculateComplianceStatus = (barge) => {
    let critical = 0;
    let warning = 0;
    
    [...complianceFields, ...carbFields].forEach(field => {
      const status = getComplianceStatus(barge[field.key]);
      if (status === 'overdue') critical++;
      if (status === 'due_soon') warning++;
    });
    
    return { critical, warning };
  };

  const isCaliforniaMarket = (market) => {
    return market === 'Long Beach' || market === 'Oakland';
  };

  const isValidDate = (dateString) => {
    if (!dateString) return false;
    try {
      const date = parseISO(dateString);
      return date instanceof Date && !isNaN(date.getTime());
    } catch {
      return false;
    }
  };

  const formatDate = (dateString) => {
    if (!isValidDate(dateString)) return '';
    return format(parseISO(dateString), 'MMM d, yyyy');
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
              Barge Management
            </h1>
            <p className="text-sm md:text-base text-slate-600">Manage your barge fleet, capacity, and compliance</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Barge
          </Button>
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
                    {editingBarge ? 'Edit Barge' : 'Add New Barge'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <Tabs defaultValue="details" className="w-full">
                    <TabsList className="grid w-full max-w-2xl grid-cols-2 mb-6">
                      <TabsTrigger value="details">Vessel Details</TabsTrigger>
                      <TabsTrigger value="tanks">Tanks</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="space-y-6">
                      <form onSubmit={handleSubmit}>
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="name">Barge Name *</Label>
                            <Input
                              id="name"
                              value={formData.name}
                              onChange={(e) => setFormData({...formData, name: e.target.value})}
                              placeholder="e.g., Delta Queen"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="market">Operating Market</Label>
                            <Select
                              value={formData.market}
                              onValueChange={(value) => setFormData({...formData, market: value})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select market" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Long Beach">Long Beach</SelectItem>
                                <SelectItem value="Oakland">Oakland</SelectItem>
                                <SelectItem value="Portland">Portland</SelectItem>
                                <SelectItem value="Seattle">Seattle</SelectItem>
                                <SelectItem value="Wood River">Wood River (MS River)</SelectItem>
                                <SelectItem value="St. Louis">St. Louis (MS River)</SelectItem>
                                <SelectItem value="Wickliffe">Wickliffe (MS River)</SelectItem>
                                <SelectItem value="Memphis">Memphis (MS River)</SelectItem>
                                <SelectItem value="Baton Rouge">Baton Rouge (MS River)</SelectItem>
                                <SelectItem value="Mobile">Mobile (Gulf Coast)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="designation">Designation</Label>
                            <Select
                              value={formData.designation || ''}
                              onValueChange={(value) => setFormData({...formData, designation: value})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select designation" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fuel_flat">Fuel Flat</SelectItem>
                                <SelectItem value="supply">Supply Barge</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="type">Type</Label>
                            <Select
                              value={formData.type}
                              onValueChange={(value) => setFormData({...formData, type: value})}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="tank">Tank</SelectItem>
                                <SelectItem value="deck">Deck</SelectItem>
                                <SelectItem value="hopper">Hopper</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
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
                                <SelectItem value="available">Available</SelectItem>
                                <SelectItem value="dispatched">Dispatched</SelectItem>
                                <SelectItem value="maintenance">Maintenance</SelectItem>
                                <SelectItem value="retired">Retired</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="year">Year Built</Label>
                            <Input
                              id="year"
                              type="number"
                              value={formData.year_built}
                              onChange={(e) => setFormData({...formData, year_built: parseFloat(e.target.value)})}
                              placeholder="e.g., 2010"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                          <Button type="button" variant="outline" onClick={resetForm}>
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            className="bg-gradient-to-r from-blue-600 to-blue-700"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            {editingBarge ? 'Update' : 'Add'} Barge
                          </Button>
                        </div>
                      </form>
                    </TabsContent>

                    <TabsContent value="tanks" className="space-y-6">
                      {editingBarge ? (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-900">Tank Configuration</h3>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleAddTank}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Tank
                            </Button>
                          </div>

                          {getTanksForBarge(editingBarge.id).length === 0 && !tankFormData.barge_id && (
                            <div className="text-center py-8 text-slate-500">
                              <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
                              <p>No tanks configured yet</p>
                            </div>
                          )}

                          {(getTanksForBarge(editingBarge.id).length > 0 || tankFormData.barge_id) && (
                            <div className="space-y-4">
                              {/* Existing Tanks */}
                              <div className="grid md:grid-cols-2 gap-3">
                                {getTanksForBarge(editingBarge.id)
                                  .sort((a, b) => {
                                    if (a.tank_number !== b.tank_number) return a.tank_number - b.tank_number;
                                    return a.tank_position === 'port' ? -1 : 1;
                                  })
                                  .map((tank) => (
                                    <div
                                      key={tank.id}
                                      className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                                        editingTank?.id === tank.id
                                          ? 'border-blue-500 bg-blue-50'
                                          : 'border-slate-200 hover:border-slate-300'
                                      }`}
                                      onClick={() => handleEditTank(tank)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          {tank.tank_color && tank.tank_color !== 'none' && (
                                            <div className={`w-5 h-5 rounded-full border-2 ${tankColorStyles[tank.tank_color]}`} />
                                          )}
                                          <span className="font-bold text-slate-900">
                                            Tank {tank.tank_number}{tank.tank_position === 'port' ? 'Port' : 'Star'}
                                          </span>
                                        </div>
                                        <Edit2 className="w-3 h-3 text-slate-400" />
                                      </div>
                                      <div className="text-sm text-slate-600 mt-1">
                                        {tank.capacity_gallons?.toLocaleString()} gal
                                      </div>
                                    </div>
                                  ))}
                              </div>

                              {/* Tank Form */}
                              {(editingTank || tankFormData.barge_id) && (
                                <form onSubmit={handleTankSubmit} className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                                  <h4 className="font-semibold text-slate-900 mb-4">
                                    {editingTank ? 'Edit Tank' : 'Add New Tank'}
                                  </h4>
                                  <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="tank_number">Tank Number *</Label>
                                      <Input
                                        id="tank_number"
                                        type="number"
                                        value={tankFormData.tank_number}
                                        onChange={(e) => setTankFormData({...tankFormData, tank_number: e.target.value})}
                                        placeholder="e.g., 1, 2, 3..."
                                        required
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="tank_position">Position *</Label>
                                      <Select
                                        value={tankFormData.tank_position}
                                        onValueChange={(value) => setTankFormData({...tankFormData, tank_position: value})}
                                        required
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="starboard">Starboard (Star)</SelectItem>
                                          <SelectItem value="port">Port</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="tank_color">Tank Color</Label>
                                      <Select
                                        value={tankFormData.tank_color}
                                        onValueChange={(value) => setTankFormData({...tankFormData, tank_color: value})}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">No Color</SelectItem>
                                          <SelectItem value="yellow">Yellow</SelectItem>
                                          <SelectItem value="green">Green</SelectItem>
                                          <SelectItem value="red">Red</SelectItem>
                                          <SelectItem value="blue">Blue</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="capacity">Capacity (Gallons) *</Label>
                                      <Input
                                        id="capacity"
                                        type="number"
                                        value={tankFormData.capacity_gallons}
                                        onChange={(e) => setTankFormData({...tankFormData, capacity_gallons: e.target.value})}
                                        placeholder="e.g., 50000"
                                        required
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="current">Initial Gallons</Label>
                                      <Input
                                        id="current"
                                        type="number"
                                        value={tankFormData.current_gallons}
                                        onChange={(e) => setTankFormData({...tankFormData, current_gallons: e.target.value})}
                                        placeholder="0"
                                      />
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor="product">Product Type</Label>
                                      <Select
                                        value={tankFormData.product_type}
                                        onValueChange={(value) => setTankFormData({...tankFormData, product_type: value})}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select product" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {activeProducts.map((product) => (
                                            <SelectItem key={product.id} value={product.name}>
                                              {product.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  <div className="space-y-2 mt-4">
                                    <Label htmlFor="notes">Notes</Label>
                                    <Textarea
                                      id="notes"
                                      value={tankFormData.notes}
                                      onChange={(e) => setTankFormData({...tankFormData, notes: e.target.value})}
                                      placeholder="Additional notes about this tank..."
                                      rows={2}
                                    />
                                  </div>

                                  <div className="flex justify-between items-center mt-4 pt-4 border-t">
                                    <div>
                                      {editingTank && (
                                        <Button 
                                          type="button" 
                                          variant="destructive"
                                          size="sm"
                                          onClick={handleDeleteTank}
                                          disabled={deleteTankMutation.isPending}
                                        >
                                          <Trash2 className="w-4 h-4 mr-1" />
                                          {deleteTankMutation.isPending ? 'Deleting...' : 'Delete'}
                                        </Button>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <Button 
                                        type="button" 
                                        variant="outline"
                                        size="sm"
                                        onClick={resetTankForm}
                                      >
                                        Cancel
                                      </Button>
                                      <Button 
                                        type="button"
                                        size="sm"
                                        onClick={handleTankSubmit}
                                        disabled={createTankMutation.isPending || updateTankMutation.isPending}
                                        className="bg-gradient-to-r from-emerald-600 to-emerald-700"
                                      >
                                        <Save className="w-4 h-4 mr-1" />
                                        {createTankMutation.isPending || updateTankMutation.isPending ? 'Saving...' : (editingTank ? 'Update' : 'Add')}
                                      </Button>
                                    </div>
                                  </div>
                                </form>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8 text-slate-500">
                          <p>Save the barge first to configure tanks</p>
                        </div>
                      )}
                    </TabsContent>


                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {barges.map((barge) => {
            const bargeTanks = getTanksForBarge(barge.id);
            const tankCapacity = getBargeTankCapacity(barge.id);
            const tankCount = bargeTanks.length;
            const compliance = calculateComplianceStatus(barge);
            const complianceIssues = complianceFields.filter(field => {
              if (!isValidDate(barge[field.key])) return false;
              const status = getComplianceStatus(barge[field.key]);
              return status === 'overdue' || status === 'due_soon';
            });
            const carbIssues = isCaliforniaMarket(barge.market) ? carbFields.filter(field => {
              if (!isValidDate(barge[field.key])) return false;
              const status = getComplianceStatus(barge[field.key]);
              return status === 'overdue' || status === 'due_soon';
            }) : [];
            const allIssues = [...complianceIssues, ...carbIssues];

            return (
              <Card key={barge.id} className="shadow-md border-slate-200 hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 bg-gradient-to-br ${
                        compliance.critical > 0 ? 'from-red-500 to-red-600' :
                        compliance.warning > 0 ? 'from-yellow-500 to-yellow-600' :
                        barge.market ? marketColors[barge.market] : 'from-slate-400 to-slate-500'
                      } rounded-xl flex items-center justify-center shadow-md`}>
                        <Ship className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold text-slate-900">
                          {barge.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-slate-500 capitalize">{barge.type} Barge</p>
                          {barge.designation && (
                            <Badge className={barge.designation === 'fuel_flat' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-purple-100 text-purple-800 border-purple-200'}>
                              {barge.designation === 'fuel_flat' ? 'Fuel Flat' : 'Supply Barge'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(barge)}
                        className="hover:bg-slate-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteBarge(barge)}
                        className="hover:bg-red-50 hover:text-red-600"
                        disabled={deleteBargeMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {allIssues.length > 0 && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors">
                          <div className="flex items-center gap-2 text-yellow-800 font-semibold text-sm mb-1">
                            <AlertTriangle className="w-4 h-4" />
                            {allIssues.length} Compliance Alert{allIssues.length > 1 ? 's' : ''}
                          </div>
                          <div className="text-xs text-yellow-700">
                            {allIssues.slice(0, 2).map(field => (
                              <div key={field.key}>
                                {field.label}: {formatDate(barge[field.key])}
                              </div>
                            ))}
                            {allIssues.length > 2 && (
                              <div className="font-semibold mt-1">Click to view all {allIssues.length} alerts</div>
                            )}
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-2xl flex items-center gap-2">
                            <AlertTriangle className="w-6 h-6 text-yellow-600" />
                            Compliance Alerts - {barge.name}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 mt-4">
                          {allIssues.map(field => {
                            const status = getComplianceStatus(barge[field.key]);
                            const daysUntil = differenceInDays(new Date(barge[field.key]), new Date());
                            return (
                              <div
                                key={field.key}
                                className={`p-4 rounded-lg border-2 ${
                                  status === 'overdue'
                                    ? 'bg-red-50 border-red-300'
                                    : 'bg-yellow-50 border-yellow-300'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <h4 className="font-bold text-slate-900">{field.label}</h4>
                                  <Badge className={
                                    status === 'overdue'
                                      ? 'bg-red-100 text-red-800 border-red-200'
                                      : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                  }>
                                    {status === 'overdue' ? 'OVERDUE' : 'DUE SOON'}
                                  </Badge>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-sm text-slate-700">
                                    <span className="font-semibold">Due Date:</span>{' '}
                                    {formatDate(barge[field.key])}
                                  </p>
                                  <p className={`text-sm font-semibold ${
                                    status === 'overdue' ? 'text-red-700' : 'text-yellow-700'
                                  }`}>
                                    {status === 'overdue'
                                      ? `${Math.abs(daysUntil)} days overdue`
                                      : `${daysUntil} days remaining`
                                    }
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  {barge.market && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        Market
                      </span>
                      <span className="font-semibold text-slate-900">{barge.market}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Status</span>
                    <Badge className={`${statusColors[barge.status]} border capitalize`}>
                      {barge.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">Tanks</span>
                    <span className="font-semibold text-slate-900">
                      {tankCount} tank{tankCount !== 1 ? 's' : ''} • {tankCapacity > 0 ? tankCapacity.toLocaleString() : '0'} gal
                    </span>
                  </div>
                  {barge.year_built && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Year Built</span>
                      <span className="font-medium text-slate-900">{barge.year_built}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {barges.length === 0 && !showForm && (
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-12 text-center">
              <Ship className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Barges Yet</h3>
              <p className="text-slate-600 mb-6">Add your first barge to start managing your fleet</p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add First Barge
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}