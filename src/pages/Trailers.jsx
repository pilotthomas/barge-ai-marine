import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Truck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Trailers() {
  const [showForm, setShowForm] = useState(false);
  const [editingTrailer, setEditingTrailer] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState("all");
  const [formData, setFormData] = useState({
    trailer_number: "",
    market: "Richmond CA",
    trailer_type: "Tank",
    capacity_gallons: "",
    status: "available",
    notes: ""
  });

  const queryClient = useQueryClient();

  const { data: trailers = [] } = useQuery({
    queryKey: ['trailers'],
    queryFn: () => base44.entities.Trailer.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Trailer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trailers'] });
      setShowForm(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Trailer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trailers'] });
      setShowForm(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Trailer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trailers'] });
    },
  });

  const resetForm = () => {
    setFormData({
      trailer_number: "",
      market: "Richmond CA",
      trailer_type: "Tank",
      capacity_gallons: "",
      status: "available",
      notes: ""
    });
    setEditingTrailer(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      capacity_gallons: formData.capacity_gallons ? parseFloat(formData.capacity_gallons) : undefined
    };
    if (editingTrailer) {
      updateMutation.mutate({ id: editingTrailer.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (trailer) => {
    setEditingTrailer(trailer);
    setFormData(trailer);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm("Are you sure you want to delete this trailer?")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredTrailers = selectedMarket === "all" 
    ? trailers 
    : trailers.filter(t => t.market === selectedMarket);

  // Sort trailers numerically by trailer_number
  const sortedTrailers = [...filteredTrailers].sort((a, b) => {
    const numA = parseInt(a.trailer_number.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.trailer_number.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  const activeTrailers = sortedTrailers.filter(t => t.status !== 'retired');
  const retiredTrailers = sortedTrailers.filter(t => t.status === 'retired');

  const statusColors = {
    available: "bg-green-100 text-green-800",
    dispatched: "bg-blue-100 text-blue-800",
    maintenance: "bg-yellow-100 text-yellow-800",
    retired: "bg-gray-100 text-gray-800"
  };

  const marketColors = {
    "Richmond CA": "bg-blue-100 text-blue-800",
    "Rancho Dominguez": "bg-green-100 text-green-800",
    "Seattle": "bg-orange-100 text-orange-800"
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Trailers</h1>
          <div className="flex items-center gap-4">
            <Select value={selectedMarket} onValueChange={setSelectedMarket}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                <SelectItem value="Richmond CA">Richmond CA</SelectItem>
                <SelectItem value="Rancho Dominguez">Rancho Dominguez</SelectItem>
                <SelectItem value="Seattle">Seattle</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-5 h-5 mr-2" />
              Add Trailer
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
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>{editingTrailer ? "Edit Trailer" : "Add New Trailer"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Trailer Number *</Label>
                        <Input
                          value={formData.trailer_number}
                          onChange={(e) => setFormData({ ...formData, trailer_number: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <Label>Market *</Label>
                        <Select
                          value={formData.market}
                          onValueChange={(value) => setFormData({ ...formData, market: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Richmond CA">Richmond CA</SelectItem>
                            <SelectItem value="Rancho Dominguez">Rancho Dominguez</SelectItem>
                            <SelectItem value="Seattle">Seattle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Trailer Type</Label>
                        <Select
                          value={formData.trailer_type}
                          onValueChange={(value) => setFormData({ ...formData, trailer_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Box Van">Box Van</SelectItem>
                            <SelectItem value="Tank">Tank</SelectItem>
                            <SelectItem value="Pup Tank">Pup Tank</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Capacity (gallons)</Label>
                        <Input
                          type="number"
                          value={formData.capacity_gallons}
                          onChange={(e) => setFormData({ ...formData, capacity_gallons: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label>Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) => setFormData({ ...formData, status: value })}
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

                      <div>
                        <Label>Notes</Label>
                        <Input
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => {
                        setShowForm(false);
                        resetForm();
                      }}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingTrailer ? "Update" : "Create"} Trailer
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTrailers.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {activeTrailers.map((trailer) => (
                <Card key={trailer.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Truck className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{trailer.trailer_number}</CardTitle>
                          <p className="text-sm text-gray-500">{trailer.trailer_type}</p>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEdit(trailer)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Badge className={marketColors[trailer.market]}>
                        {trailer.market}
                      </Badge>
                      <Badge className={statusColors[trailer.status]}>
                        {trailer.status}
                      </Badge>
                    </div>
                    {trailer.capacity_gallons && (
                      <div className="text-sm text-gray-600">
                        Capacity: {trailer.capacity_gallons.toLocaleString()} gal
                      </div>
                    )}
                    {trailer.notes && (
                      <div className="text-sm text-gray-600">
                        {trailer.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {retiredTrailers.length > 0 && (
              <>
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Retired Trailers</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {retiredTrailers.map((trailer) => (
                    <Card key={trailer.id} className="opacity-60">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                              <Truck className="w-6 h-6 text-gray-600" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{trailer.trailer_number}</CardTitle>
                              <p className="text-sm text-gray-500">{trailer.trailer_type}</p>
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(trailer)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex gap-2">
                          <Badge className={marketColors[trailer.market]}>
                            {trailer.market}
                          </Badge>
                          <Badge className={statusColors[trailer.status]}>
                            {trailer.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Trailers Yet</h3>
              <p className="text-gray-500 mb-6">Get started by adding your first trailer</p>
              <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-5 h-5 mr-2" />
                Add Trailer
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}