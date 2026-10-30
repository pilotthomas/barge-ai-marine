import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Package, Edit2, Save, Droplet, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { REGIONS } from "@/lib/regions";

const regionShort = (key) => REGIONS.find(r => r.key === key)?.short || key;

const categoryColors = {
  Fuel: "bg-blue-100 text-blue-800 border-blue-200",
  Lubes: "bg-purple-100 text-purple-800 border-purple-200",
  Other: "bg-slate-100 text-slate-800 border-slate-200"
};

export default function Products() {
  const [showForm, setShowForm] = useState(false);
  const [editingCargo, setEditingCargo] = useState(null);
  const [activeTab, setActiveTab] = useState("marine");
  const [formData, setFormData] = useState({
    name: '',
    category: 'Fuel',
    delivery_method: 'Marine',
    brand: '',
    description: '',
    handling_notes: '',
    regions: [],
    gallons_per_metric_ton: '',
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: cargoTypes = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Cargo.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Cargo.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Cargo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo'] });
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Fuel',
      delivery_method: 'Marine',
      brand: '',
      description: '',
      handling_notes: '',
      regions: [],
      gallons_per_metric_ton: '',
      is_active: true
    });
    setShowForm(false);
    setEditingCargo(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const gpmt = formData.gallons_per_metric_ton ? parseFloat(formData.gallons_per_metric_ton) : null;
    const data = {
      ...formData,
      regions: formData.regions || [],
      gallons_per_metric_ton: gpmt,
      metric_tons_per_gallon_conversion: gpmt ? 1 / gpmt : (formData.metric_tons_per_gallon_conversion ?? null),
    };
    if (editingCargo) {
      updateMutation.mutate({ id: editingCargo.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (cargo) => {
    setEditingCargo(cargo);
    setFormData({ ...cargo, regions: cargo.regions || [], gallons_per_metric_ton: cargo.gallons_per_metric_ton ?? '' });
    setShowForm(true);
  };

  const handleDelete = () => {
    if (editingCargo && window.confirm(`Are you sure you want to delete ${editingCargo.name}?`)) {
      deleteMutation.mutate(editingCargo.id);
    }
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Product Catalog
            </h1>
            <p className="text-slate-600">Manage product types for deliveries and tracking</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Product
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
                    {editingCargo ? 'Edit Product' : 'Add New Product'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Product Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="e.g., Diesel, Lubricants - Bulk"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) => setFormData({...formData, category: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Fuel">Fuel</SelectItem>
                            <SelectItem value="Lubes">Lubes</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="delivery_method">Delivery Method</Label>
                        <Select
                          value={formData.delivery_method}
                          onValueChange={(value) => setFormData({...formData, delivery_method: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Marine">Marine Only (Barge/Fuel Dock)</SelectItem>
                            <SelectItem value="Trucking">Trucking Only</SelectItem>
                            <SelectItem value="Both">Both Marine &amp; Trucking</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gallons_per_metric_ton">Gallons per Metric Ton</Label>
                        <Input
                          id="gallons_per_metric_ton"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.gallons_per_metric_ton}
                          onChange={(e) => setFormData({...formData, gallons_per_metric_ton: e.target.value})}
                          placeholder="e.g., 316 (leave blank if not sold by MT)"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Available in Regions</Label>
                        <div className="flex flex-wrap gap-4">
                          {REGIONS.map((r) => (
                            <label key={r.key} className="flex items-center gap-2 cursor-pointer text-sm">
                              <Checkbox
                                checked={(formData.regions || []).includes(r.key)}
                                onCheckedChange={(checked) => {
                                  const current = formData.regions || [];
                                  setFormData({
                                    ...formData,
                                    regions: checked ? [...current, r.key] : current.filter(k => k !== r.key)
                                  });
                                }}
                              />
                              {r.label}
                            </label>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500">Leave all unchecked to make the product available in every region.</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        placeholder="Detailed description of the product..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="handling_notes">Handling Notes</Label>
                      <Textarea
                        id="handling_notes"
                        value={formData.handling_notes}
                        onChange={(e) => setFormData({...formData, handling_notes: e.target.value})}
                        placeholder="Special handling requirements or safety notes..."
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
                        Currently in use
                      </Label>
                    </div>

                    <div className="flex justify-between items-center pt-4">
                      <div>
                        {editingCargo && (
                          <Button 
                            type="button" 
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete Product'}
                          </Button>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={resetForm}>
                          Cancel
                        </Button>
                        <Button 
                          type="submit"
                          className="bg-gradient-to-r from-indigo-600 to-indigo-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {editingCargo ? 'Update' : 'Add'} Product
                        </Button>
                      </div>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="marine">Marine Products</TabsTrigger>
            <TabsTrigger value="trucking">Trucking Products</TabsTrigger>
          </TabsList>

          <TabsContent value="marine" className="mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cargoTypes.filter(c => c.delivery_method === 'Marine' || c.delivery_method === 'Both' || !c.delivery_method).map((cargo) => (
                <ProductCard key={cargo.id} cargo={cargo} onEdit={handleEdit} />
              ))}
            </div>
            {cargoTypes.filter(c => c.delivery_method === 'Marine' || c.delivery_method === 'Both' || !c.delivery_method).length === 0 && (
              <Card className="shadow-md border-slate-200">
                <CardContent className="p-12 text-center">
                  <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No Marine Products Yet</h3>
                  <p className="text-slate-600 mb-6">Add products for barge and fuel dock deliveries</p>
                  <Button
                    onClick={() => setShowForm(true)}
                    className="bg-gradient-to-r from-indigo-600 to-indigo-700"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Marine Product
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trucking" className="mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cargoTypes.filter(c => c.delivery_method === 'Trucking' || c.delivery_method === 'Both').map((cargo) => (
                <ProductCard key={cargo.id} cargo={cargo} onEdit={handleEdit} isTrucking={true} />
              ))}
            </div>
            {cargoTypes.filter(c => c.delivery_method === 'Trucking' || c.delivery_method === 'Both').length === 0 && (
              <Card className="shadow-md border-slate-200">
                <CardContent className="p-12 text-center">
                  <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No Trucking Products Yet</h3>
                  <p className="text-slate-600 mb-6">Add products for truck deliveries</p>
                  <Button
                    onClick={() => setShowForm(true)}
                    className="bg-gradient-to-r from-indigo-600 to-indigo-700"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Trucking Product
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {cargoTypes.length === 0 && !showForm && (
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Products Yet</h3>
              <p className="text-slate-600 mb-6">Add your first product to start tracking</p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-indigo-600 to-indigo-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add First Product
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ProductCard({ cargo, onEdit, isTrucking }) {
  const getTruckingColor = (productName) => {
    const name = productName.toUpperCase();
    if (name.includes('PTL BLENDING') || name.includes('PTL BLEND')) return 'bg-gray-900 text-white';
    if (name.includes('SHELL')) return 'bg-yellow-300 text-gray-900';
    if (name.includes('INVENTORY P') || name.includes('PICKUP')) return 'bg-gray-400 text-white';
    if (name.includes('CASTROL')) return 'bg-green-800 text-white';
    if (name.includes('CHEVRON')) return 'bg-blue-600 text-white';
    if (name.includes('LENOL')) return 'bg-red-600 text-white';
    if (name.includes('TOTAL')) return 'bg-cyan-400 text-gray-900';
    if (name.includes('RD99') || name.includes('RENEWABLE')) return 'bg-green-500 text-white';
    if (name.includes('CARB')) return 'bg-gray-300 text-gray-900';
    if (name.includes('GASOLINE')) return 'bg-white text-gray-900 border-2 border-gray-300';
    return 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white';
  };

  const iconBgClass = isTrucking ? getTruckingColor(cargo.name) : 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white';

  return (
    <Card className="shadow-md border-slate-200 hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${iconBgClass}`}>
              <Droplet className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">
                {cargo.name}
              </CardTitle>
              {!cargo.is_active && (
                <p className="text-sm text-slate-500">Inactive</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(cargo)}
            className="hover:bg-slate-100"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Category</span>
          <Badge className={`${categoryColors[cargo.category]} border capitalize`}>
            {cargo.category}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Delivery</span>
          <Badge variant="outline" className="capitalize">
            {cargo.delivery_method || 'Marine'}
          </Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-600">Regions</span>
          <div className="flex gap-1">
            {(cargo.regions && cargo.regions.length > 0)
              ? cargo.regions.map(k => <Badge key={k} variant="outline">{regionShort(k)}</Badge>)
              : <Badge variant="outline">All</Badge>}
          </div>
        </div>
        {cargo.gallons_per_metric_ton && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Gal / MT</span>
            <span className="text-sm font-medium text-slate-900">{cargo.gallons_per_metric_ton}</span>
          </div>
        )}

        {cargo.description && (
          <div className="pt-2">
            <p className="text-sm text-slate-600">{cargo.description}</p>
          </div>
        )}
        {cargo.handling_notes && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-700 mb-1">Handling Notes:</p>
            <p className="text-sm text-slate-600">{cargo.handling_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}