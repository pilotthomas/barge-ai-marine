import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Anchor, Edit2, Save, MapPin } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const statusColors = {
  available: "bg-emerald-100 text-emerald-800 border-emerald-200",
  assigned: "bg-orange-100 text-orange-800 border-orange-200",
  maintenance: "bg-yellow-100 text-yellow-800 border-yellow-200",
  retired: "bg-slate-100 text-slate-800 border-slate-200"
};

const marketColors = {
  "Long Beach": "from-orange-500 to-orange-600",
  "Oakland": "from-emerald-500 to-emerald-600",
  "Portland": "from-purple-500 to-purple-600",
  "Seattle": "from-blue-500 to-blue-600",
  "Wood River": "from-amber-500 to-amber-600",
  "St. Louis": "from-amber-500 to-amber-600",
  "Wickliffe": "from-amber-500 to-amber-600",
  "Memphis": "from-rose-500 to-rose-600",
  "Baton Rouge": "from-red-500 to-red-600",
  "Mobile": "from-teal-500 to-teal-600"
};

export default function Tugs() {
  const [showForm, setShowForm] = useState(false);
  const [editingTug, setEditingTug] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    market: '',
    is_third_party: false,
    status: 'available',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: tugs = [] } = useQuery({
    queryKey: ['tugs'],
    queryFn: () => base44.entities.Tug.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Tug.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tugs'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tug.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tugs'] });
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      company_name: '',
      market: '',
      is_third_party: false,
      status: 'available',
      notes: ''
    });
    setShowForm(false);
    setEditingTug(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTug) {
      updateMutation.mutate({ id: editingTug.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (tug) => {
    setEditingTug(tug);
    setFormData(tug);
    setShowForm(true);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Tug Management
            </h1>
            <p className="text-slate-600">Manage your tug fleet and third-party providers</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Tug
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
                    {editingTug ? 'Edit Tug' : 'Add New Tug'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Tug Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="e.g., Pacific Warrior"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company_name">Company Name</Label>
                        <Input
                          id="company_name"
                          value={formData.company_name}
                          onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                          placeholder="e.g., Crowley Maritime"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="market">Operating Market *</Label>
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
                            <SelectItem value="assigned">Assigned</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="retired">Retired</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 flex items-end">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="is_third_party"
                            checked={formData.is_third_party}
                            onCheckedChange={(checked) => setFormData({...formData, is_third_party: checked})}
                          />
                          <Label htmlFor="is_third_party" className="cursor-pointer">
                            Third-Party Provider
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        placeholder="Additional notes about the tug..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        className="bg-gradient-to-r from-teal-600 to-teal-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {editingTug ? 'Update' : 'Add'} Tug
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tugs.map((tug) => (
            <Card key={tug.id} className="shadow-md border-slate-200 hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${tug.market ? marketColors[tug.market] : 'from-slate-400 to-slate-500'} rounded-xl flex items-center justify-center shadow-md`}>
                      <Anchor className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-900">
                        {tug.name}
                      </CardTitle>
                      {tug.company_name && (
                        <p className="text-sm text-slate-500 italic">{tug.company_name}</p>
                      )}
                      {tug.is_third_party && (
                        <p className="text-sm text-purple-600 font-medium">3rd Party Provider</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(tug)}
                    className="hover:bg-slate-100"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                {tug.market && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Market
                    </span>
                    <span className="font-semibold text-slate-900">{tug.market}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Status</span>
                  <Badge className={`${statusColors[tug.status]} border capitalize`}>
                    {tug.status}
                  </Badge>
                </div>
                {tug.notes && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-sm text-slate-600">{tug.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {tugs.length === 0 && !showForm && (
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-12 text-center">
              <Anchor className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Tugs Yet</h3>
              <p className="text-slate-600 mb-6">Add your first tug to start managing your fleet</p>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-teal-600 to-teal-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add First Tug
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}