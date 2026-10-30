import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, TrendingDown, DollarSign } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EMPTY_FORM = {
  vessel_name: "",
  vessel_type: "barge",
  market: "",
  start_date: "",
  end_date: "",
  reason: "",
  estimated_volume_lost_gallons: "",
  revenue_lost: "",
  comments: ""
};

export default function LostRevenueTracker() {
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  const queryClient = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: ["lost-revenue-entries"],
    queryFn: () => base44.entities.LostRevenueEntry.list("-start_date"),
  });

  const { data: barges = [] } = useQuery({
    queryKey: ["barges"],
    queryFn: () => base44.entities.Barge.list(),
  });

  const { data: tugs = [] } = useQuery({
    queryKey: ["tugs"],
    queryFn: () => base44.entities.Tug.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.LostRevenueEntry.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["lost-revenue-entries"] }); closeForm(); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LostRevenueEntry.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["lost-revenue-entries"] }); closeForm(); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LostRevenueEntry.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lost-revenue-entries"] })
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingEntry(null);
    setFormData(EMPTY_FORM);
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      vessel_name: entry.vessel_name || "",
      vessel_type: entry.vessel_type || "barge",
      market: entry.market || "",
      start_date: entry.start_date || "",
      end_date: entry.end_date || "",
      reason: entry.reason || "",
      estimated_volume_lost_gallons: entry.estimated_volume_lost_gallons ?? "",
      revenue_lost: entry.revenue_lost ?? "",
      comments: entry.comments || ""
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      estimated_volume_lost_gallons: formData.estimated_volume_lost_gallons !== "" ? parseFloat(formData.estimated_volume_lost_gallons) : null,
      revenue_lost: formData.revenue_lost !== "" ? parseFloat(formData.revenue_lost) : null
    };
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getMonths = (start, end) => {
    if (!start) return null;
    const endDate = end ? new Date(end) : new Date();
    const days = differenceInDays(endDate, new Date(start));
    return (days / 30.44).toFixed(1);
  };

  // Filter by year
  const filteredEntries = entries.filter(e => {
    if (!filterYear || filterYear === "all") return true;
    return e.start_date && e.start_date.startsWith(filterYear);
  });

  // Totals
  const totalVolume = filteredEntries.reduce((sum, e) => sum + (e.estimated_volume_lost_gallons || 0), 0);
  const totalRevenue = filteredEntries.reduce((sum, e) => sum + (e.revenue_lost || 0), 0);

  const availableYears = [...new Set(entries.map(e => e.start_date?.slice(0, 4)).filter(Boolean))].sort((a, b) => b - a);

  const vessels = formData.vessel_type === "barge" ? barges : tugs;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Volume Lost ({filterYear === "all" ? "All Time" : filterYear})</p>
              <p className="text-2xl font-bold text-red-600">{totalVolume.toLocaleString()} gal</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Revenue Lost ({filterYear === "all" ? "All Time" : filterYear})</p>
              <p className="text-2xl font-bold text-orange-600">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Year:</Label>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              {!availableYears.includes(new Date().getFullYear().toString()) && (
                <SelectItem value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => { setFormData(EMPTY_FORM); setEditingEntry(null); setShowForm(true); }}
          className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Entry
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-700 text-white text-center">
              <td colSpan={10} className="py-2 font-bold text-base tracking-wide">
                LOST REVENUE / VOLUME TRACKER MONTHLY
              </td>
            </tr>
            <tr className="bg-slate-100 text-slate-700 text-xs font-semibold border-b border-slate-300">
              <th className="px-3 py-2 text-left whitespace-nowrap">Barge / Tug</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Market</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Start Date Out of Service</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">End Date / Return</th>
              <th className="px-3 py-2 text-center whitespace-nowrap">Months</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Reason</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Est. Volume Lost (gal)</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">Revenue Lost ($)</th>
              <th className="px-3 py-2 text-left whitespace-nowrap">Comments</th>
              <th className="px-3 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-12 text-slate-400">
                  No entries yet. Click "Add Entry" to track downed equipment.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry, idx) => (
                <tr key={entry.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50 transition-colors`}>
                  <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">{entry.vessel_name}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{entry.market || "—"}</td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {entry.start_date ? format(parseISO(entry.start_date), "M/d/yyyy") : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {entry.end_date ? format(parseISO(entry.end_date), "M/d/yyyy") : <span className="text-orange-500 font-medium">Ongoing</span>}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-700">
                    {getMonths(entry.start_date, entry.end_date) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{entry.reason || "—"}</td>
                  <td className="px-3 py-2 text-right text-slate-900 font-mono">
                    {entry.estimated_volume_lost_gallons != null ? entry.estimated_volume_lost_gallons.toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-red-700 font-mono font-semibold">
                    {entry.revenue_lost != null ? `$${entry.revenue_lost.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">{entry.comments || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(entry)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => { if (window.confirm(`Delete entry for ${entry.vessel_name}?`)) deleteMutation.mutate(entry.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
            {/* Totals row */}
            {filteredEntries.length > 0 && (
              <tr className="bg-slate-200 font-bold border-t-2 border-slate-400">
                <td colSpan={6} className="px-3 py-2 text-right text-slate-700">TOTALS:</td>
                <td className="px-3 py-2 text-right font-mono text-slate-900">{totalVolume.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Entry" : "Add Lost Revenue Entry"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Vessel Type</Label>
                <Select value={formData.vessel_type} onValueChange={(v) => setFormData({ ...formData, vessel_type: v, vessel_name: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="barge">Barge</SelectItem>
                    <SelectItem value="tug">Tug</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Vessel *</Label>
                <Select value={formData.vessel_name} onValueChange={(v) => setFormData({ ...formData, vessel_name: v })}>
                  <SelectTrigger><SelectValue placeholder="Select vessel" /></SelectTrigger>
                  <SelectContent>
                    {vessels.map(v => <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Market</Label>
                <Select value={formData.market} onValueChange={(v) => setFormData({ ...formData, market: v })}>
                  <SelectTrigger><SelectValue placeholder="Select market" /></SelectTrigger>
                  <SelectContent>
                    {["Long Beach","Oakland","Portland","Seattle","Wood River","St. Louis","Wycliffe","Memphis","Baton Rouge","Mobile"].map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Reason</Label>
                <Select value={formData.reason} onValueChange={(v) => setFormData({ ...formData, reason: v })}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dry Dock">Dry Dock</SelectItem>
                    <SelectItem value="Mechanical">Mechanical</SelectItem>
                    <SelectItem value="Regulatory">Regulatory</SelectItem>
                    <SelectItem value="Inspection">Inspection</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Start Date Out of Service *</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>End Date / Return to Service</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                <p className="text-xs text-slate-500">Leave blank if still out of service</p>
              </div>
              <div className="space-y-1">
                <Label>Est. Volume Lost (gallons)</Label>
                <Input type="number" value={formData.estimated_volume_lost_gallons} onChange={(e) => setFormData({ ...formData, estimated_volume_lost_gallons: e.target.value })} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>Revenue Lost ($)</Label>
                <Input type="number" value={formData.revenue_lost} onChange={(e) => setFormData({ ...formData, revenue_lost: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Comments</Label>
              <Textarea value={formData.comments} onChange={(e) => setFormData({ ...formData, comments: e.target.value })} rows={2} placeholder="Additional notes..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-red-600 hover:bg-red-700">
                {editingEntry ? "Update" : "Add"} Entry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}