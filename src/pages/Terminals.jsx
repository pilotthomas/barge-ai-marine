import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Building2, Phone, Mail, Clock, Edit2, Save, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";

const terminalTypeColors = {
  'Marine Terminal': 'bg-blue-100 text-blue-800 border-blue-200',
  'Refinery': 'bg-orange-100 text-orange-800 border-orange-200',
  'Storage Facility': 'bg-green-100 text-green-800 border-green-200',
  'Distribution Center': 'bg-purple-100 text-purple-800 border-purple-200',
  'Other': 'bg-slate-100 text-slate-800 border-slate-200'
};

const marketColors = {
  'Long Beach': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Oakland': 'bg-blue-100 text-blue-800 border-blue-200',
  'Portland': 'bg-amber-100 text-amber-800 border-amber-200',
  'Seattle': 'bg-purple-100 text-purple-800 border-purple-200'
};

export default function Terminals() {
  const [showForm, setShowForm] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState("all");
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    market: '',
    terminal_type: 'Marine Terminal',
    suppliers: [],
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    operating_hours: '',
    notes: '',
    is_active: true
  });
  const [supplierInput, setSupplierInput] = useState('');

  const queryClient = useQueryClient();

  const { data: terminals = [] } = useQuery({
    queryKey: ['terminals'],
    queryFn: () => base44.entities.Terminal.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Terminal.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Terminal.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Terminal.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      market: '',
      terminal_type: 'Marine Terminal',
      suppliers: [],
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      operating_hours: '',
      notes: '',
      is_active: true
    });
    setSupplierInput('');
    setShowForm(false);
    setEditingTerminal(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTerminal) {
      updateMutation.mutate({ id: editingTerminal.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (terminal) => {
    setEditingTerminal(terminal);
    setFormData(terminal);
    setShowForm(true);
  };

  const handleDelete = () => {
    if (editingTerminal && window.confirm(`Are you sure you want to delete ${editingTerminal.name}?`)) {
      deleteMutation.mutate(editingTerminal.id);
    }
  };

  const filteredTerminals = selectedMarket === "all"
    ? terminals
    : terminals.filter(t => t.market === selectedMarket);

  const activeTerminals = filteredTerminals.filter(t => t.is_active !== false);
  const inactiveTerminals = filteredTerminals.filter(t => t.is_active === false);

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Terminal Management
            </h1>
            <p className="text-slate-600">Manage loading terminals and facilities</p>
          </div>
          <div className="flex gap-3">
            <Select value={selectedMarket} onValueChange={setSelectedMarket}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                <SelectItem value="Long Beach">Long Beach</SelectItem>
                <SelectItem value="Oakland">Oakland</SelectItem>
                <SelectItem value="Portland">Portland</SelectItem>
                <SelectItem value="Seattle">Seattle</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                resetForm();
                setShowForm(!showForm);
              }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Terminal
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
                    {editingTerminal ? 'Edit Terminal' : 'Add New Terminal'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Terminal Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="e.g., Long Beach Marine Terminal"
                          required
                        />
                      </div>

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
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="location">Location/Address</Label>
                        <Input
                          id="location"
                          value={formData.location}
                          onChange={(e) => setFormData({...formData, location: e.target.value})}
                          placeholder="Physical address"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="terminal_type">Terminal Type</Label>
                        <Select
                          value={formData.terminal_type}
                          onValueChange={(value) => setFormData({...formData, terminal_type: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Marine Terminal">Marine Terminal</SelectItem>
                            <SelectItem value="Refinery">Refinery</SelectItem>
                            <SelectItem value="Storage Facility">Storage Facility</SelectItem>
                            <SelectItem value="Distribution Center">Distribution Center</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="suppliers">Suppliers at this Terminal</Label>
                        <div className="flex gap-2">
                          <Input
                            id="suppliers"
                            value={supplierInput}
                            onChange={(e) => setSupplierInput(e.target.value)}
                            placeholder="e.g., Chevron, Neste, Shell"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (supplierInput.trim() && !(formData.suppliers || []).includes(supplierInput.trim())) {
                                  setFormData({...formData, suppliers: [...(formData.suppliers || []), supplierInput.trim()]});
                                  setSupplierInput('');
                                }
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (supplierInput.trim() && !(formData.suppliers || []).includes(supplierInput.trim())) {
                                setFormData({...formData, suppliers: [...(formData.suppliers || []), supplierInput.trim()]});
                                setSupplierInput('');
                              }
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(formData.suppliers || []).map((supplier, index) => (
                            <div key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full flex items-center gap-2 text-sm">
                              <span>{supplier}</span>
                              <button
                               type="button"
                               onClick={() => setFormData({...formData, suppliers: (formData.suppliers || []).filter((_, i) => i !== index)})}
                               className="hover:text-blue-900"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contact_name">Contact Name</Label>
                        <Input
                          id="contact_name"
                          value={formData.contact_name}
                          onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
                          placeholder="Primary contact person"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contact_phone">Contact Phone</Label>
                        <Input
                          id="contact_phone"
                          value={formData.contact_phone}
                          onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                          placeholder="(555) 123-4567"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contact_email">Contact Email</Label>
                        <Input
                          id="contact_email"
                          type="email"
                          value={formData.contact_email}
                          onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                          placeholder="contact@terminal.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="operating_hours">Operating Hours</Label>
                        <Input
                          id="operating_hours"
                          value={formData.operating_hours}
                          onChange={(e) => setFormData({...formData, operating_hours: e.target.value})}
                          placeholder="e.g., 24/7, Mon-Fri 8am-5pm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        placeholder="Additional notes about this terminal..."
                        rows={3}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                      />
                      <Label htmlFor="is_active" className="cursor-pointer">
                        Terminal is active
                      </Label>
                    </div>

                    <div className="flex justify-between items-center pt-4">
                      <div>
                        {editingTerminal && (
                          <Button 
                            type="button" 
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete Terminal'}
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={resetForm}>
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          disabled={createMutation.isPending || updateMutation.isPending}
                          className="bg-gradient-to-r from-blue-600 to-blue-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingTerminal ? 'Update' : 'Add')} Terminal
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTerminals.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeTerminals.map((terminal) => (
              <Card key={terminal.id} className="shadow-md border-slate-200 hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{terminal.name}</h3>
                        <Badge className={`${marketColors[terminal.market]} border text-xs mt-1`}>
                          {terminal.market}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(terminal)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <Badge className={`${terminalTypeColors[terminal.terminal_type]} border text-xs`}>
                      {terminal.terminal_type}
                    </Badge>

                    {terminal.suppliers && terminal.suppliers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(terminal.suppliers || []).map((supplier, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200">
                            {supplier}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {terminal.location && (
                      <div className="flex items-start gap-2 text-sm text-slate-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{terminal.location}</span>
                      </div>
                    )}

                    {terminal.operating_hours && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Clock className="w-4 h-4 flex-shrink-0" />
                        <span>{terminal.operating_hours}</span>
                      </div>
                    )}

                    {(terminal.contact_name || terminal.contact_phone || terminal.contact_email) && (
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        {terminal.contact_name && (
                          <p className="text-sm font-medium text-slate-700">{terminal.contact_name}</p>
                        )}
                        {terminal.contact_phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="w-3 h-3" />
                            <span>{terminal.contact_phone}</span>
                          </div>
                        )}
                        {terminal.contact_email && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{terminal.contact_email}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {terminal.notes && (
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-sm text-slate-600">{terminal.notes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {inactiveTerminals.length > 0 && (
          <Card className="shadow-md border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900">Inactive Terminals</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactiveTerminals.map((terminal) => (
                  <div key={terminal.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 opacity-60">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-slate-900">{terminal.name}</h4>
                        <Badge className="bg-slate-200 text-slate-700 text-xs mt-1">
                          Inactive
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(terminal)}
                        className="h-8 w-8"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {terminals.length === 0 && !showForm && (
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-12 text-center">
              <Building2 className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Terminals Yet</h3>
              <p className="text-slate-600 mb-6">Add your first terminal to start managing loading locations</p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add First Terminal
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}