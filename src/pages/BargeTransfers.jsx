import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ArrowRight, Ship, Calendar, Save, X, Edit2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";

export default function BargeTransfers() {
  const [showForm, setShowForm] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [formData, setFormData] = useState({
    transfer_date: '',
    from_barge_id: '',
    from_barge_name: '',
    to_barge_id: '',
    to_barge_name: '',
    product_type: '',
    resulting_product_type: '',
    is_blend: false,
    gallons_transferred: '',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: transfers = [] } = useQuery({
    queryKey: ['barge-transfers'],
    queryFn: () => base44.entities.BargeTransfer.list('-transfer_date'),
  });

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const activeProducts = products.filter(p => p.is_active !== false);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BargeTransfer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barge-transfers'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BargeTransfer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barge-transfers'] });
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      transfer_date: '',
      from_barge_id: '',
      from_barge_name: '',
      to_barge_id: '',
      to_barge_name: '',
      product_type: '',
      resulting_product_type: '',
      is_blend: false,
      gallons_transferred: '',
      notes: ''
    });
    setShowForm(false);
    setEditingTransfer(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      gallons_transferred: parseFloat(formData.gallons_transferred),
      // If not a blend or no resulting product specified, use source product
      resulting_product_type: formData.is_blend && formData.resulting_product_type 
        ? formData.resulting_product_type 
        : formData.product_type
    };
    
    if (editingTransfer) {
      updateMutation.mutate({ id: editingTransfer.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (transfer) => {
    setEditingTransfer(transfer);
    setFormData({
      transfer_date: transfer.transfer_date,
      from_barge_id: transfer.from_barge_id,
      from_barge_name: transfer.from_barge_name,
      to_barge_id: transfer.to_barge_id,
      to_barge_name: transfer.to_barge_name,
      product_type: transfer.product_type,
      resulting_product_type: transfer.resulting_product_type || transfer.product_type,
      is_blend: transfer.is_blend || false,
      gallons_transferred: transfer.gallons_transferred,
      notes: transfer.notes || ''
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFromBargeChange = (bargeId) => {
    const selectedBarge = barges.find(b => b.id === bargeId);
    setFormData({
      ...formData,
      from_barge_id: bargeId,
      from_barge_name: selectedBarge?.name || ''
    });
  };

  const handleToBargeChange = (bargeId) => {
    const selectedBarge = barges.find(b => b.id === bargeId);
    setFormData({
      ...formData,
      to_barge_id: bargeId,
      to_barge_name: selectedBarge?.name || ''
    });
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Barge to Barge Transfers
            </h1>
            <p className="text-slate-600">Track product transfers and blends between barges</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Record Transfer
          </Button>
        </div>

        <Card className="shadow-md border-slate-200 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-800">
                <Ship className="w-5 h-5" />
                <p className="text-sm font-medium">
                  Recording barge to barge transfers is essential for accurate inventory balancing. 
                  These transfers adjust inventory levels on both barges in the rolling inventory tracker.
                </p>
              </div>
              <div className="text-xs text-blue-700 pl-7">
                <strong>Product Blending:</strong> When loading one product on top of another (e.g., MGO on RD99), 
                check "Product Blend" and specify the resulting product type. This is common when blending off contaminated products.
              </div>
            </div>
          </CardContent>
        </Card>

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
                    {editingTransfer ? 'Edit Transfer' : 'Record Barge Transfer'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="transfer_date">Transfer Date *</Label>
                        <Input
                          id="transfer_date"
                          type="date"
                          value={formData.transfer_date}
                          onChange={(e) => setFormData({...formData, transfer_date: e.target.value})}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="product">Source Product Type *</Label>
                        <Select
                          value={formData.product_type}
                          onValueChange={(value) => setFormData({...formData, product_type: value})}
                          required
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

                      <div className="space-y-2">
                        <Label htmlFor="from_barge">From Barge *</Label>
                        <Select
                          value={formData.from_barge_id}
                          onValueChange={handleFromBargeChange}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select source barge" />
                          </SelectTrigger>
                          <SelectContent>
                            {barges.map((barge) => (
                              <SelectItem key={barge.id} value={barge.id}>
                                {barge.name} ({barge.market})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="to_barge">To Barge *</Label>
                        <Select
                          value={formData.to_barge_id}
                          onValueChange={handleToBargeChange}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select destination barge" />
                          </SelectTrigger>
                          <SelectContent>
                            {barges.map((barge) => (
                              <SelectItem key={barge.id} value={barge.id}>
                                {barge.name} ({barge.market}){barge.id === formData.from_barge_id ? ' - SAME BARGE' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {formData.is_blend && formData.to_barge_id === formData.from_barge_id && (
                          <p className="text-xs text-orange-700">
                            ⚠️ Same-barge blend: Product will be converted on {formData.from_barge_name}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="gallons">Gallons Transferred *</Label>
                        <Input
                          id="gallons"
                          type="number"
                          value={formData.gallons_transferred}
                          onChange={(e) => setFormData({...formData, gallons_transferred: e.target.value})}
                          placeholder="0"
                          required
                        />
                      </div>
                    </div>

                    {/* Product Blend Section */}
                    <div className="p-4 bg-orange-50 border-2 border-orange-200 rounded-lg space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="is_blend"
                          checked={formData.is_blend}
                          onCheckedChange={(checked) => setFormData({
                            ...formData, 
                            is_blend: checked,
                            // Reset resulting product if unchecked
                            resulting_product_type: checked ? formData.resulting_product_type : ''
                          })}
                        />
                        <Label htmlFor="is_blend" className="cursor-pointer text-sm font-bold text-orange-900">
                          Product Blend / Conversion (e.g., loading MGO on top of RD99)
                        </Label>
                      </div>

                      {formData.is_blend && (
                        <div className="space-y-2">
                          <Label htmlFor="resulting_product">Resulting Product Type *</Label>
                          <Select
                            value={formData.resulting_product_type}
                            onValueChange={(value) => setFormData({...formData, resulting_product_type: value})}
                            required={formData.is_blend}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select resulting product after blend" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeProducts.map((product) => (
                                <SelectItem key={product.id} value={product.name}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-orange-700">
                            Example: If loading MGO on top of RD99, the blend becomes MGO. 
                            The source barge loses {formData.product_type || 'source product'}, 
                            but the destination barge gains {formData.resulting_product_type || 'resulting product'}.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        placeholder="Additional notes about this transfer..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={resetForm}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        className="bg-gradient-to-r from-cyan-600 to-cyan-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (editingTransfer ? 'Update' : 'Record')} Transfer
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transfers List */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900">Transfer History</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {transfers.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Ship className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No transfers recorded yet</p>
                <p className="text-sm mt-2">Record your first barge to barge transfer above</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transfers.map((transfer) => {
                  const isBlend = transfer.is_blend && transfer.resulting_product_type && transfer.resulting_product_type !== transfer.product_type;
                  
                  return (
                    <Card key={transfer.id} className="border-slate-200 hover:shadow-md transition-shadow duration-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-md">
                              <ArrowRight className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{transfer.from_barge_name}</span>
                                <ArrowRight className="w-4 h-4 text-slate-400" />
                                <span className="font-bold text-slate-900">{transfer.to_barge_name}</span>
                                {isBlend && (
                                  <Badge className="bg-orange-100 text-orange-800 border-orange-300 border">
                                    BLEND
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-sm text-slate-600">
                                <Calendar className="w-3 h-3" />
                                <span>{format(parseISO(transfer.transfer_date), 'MMM d, yyyy')}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-2xl font-bold text-cyan-600">
                                {transfer.gallons_transferred.toLocaleString()} gal
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                                  {transfer.product_type}
                                </Badge>
                                {isBlend && (
                                  <>
                                    <ArrowRight className="w-3 h-3 text-slate-400" />
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                      {transfer.resulting_product_type}
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(transfer)}
                              className="hover:bg-slate-100"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {transfer.notes && (
                          <div className="pt-3 border-t border-slate-100 text-sm text-slate-600">
                            <span className="font-medium">Notes:</span> {transfer.notes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}