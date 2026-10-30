import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Save } from "lucide-react";

const EMPTY = {
  market: "",
  fuel_dock_location: "",
  facility_name: "",
  tank_number: "",
  capacity_gallons: "",
  product_type: "",
  current_gallons: 0,
  is_fuel_dock_connected: true,
  notes: "",
};

export default function TankFormDialog({ open, onOpenChange, tank, products, markets, onSubmit, isPending }) {
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    if (tank) {
      setForm({
        market: tank.market || "",
        fuel_dock_location: tank.fuel_dock_location || "",
        facility_name: tank.facility_name || "",
        tank_number: tank.tank_number || "",
        capacity_gallons: tank.capacity_gallons ?? "",
        product_type: tank.product_type || "",
        current_gallons: tank.current_gallons ?? 0,
        is_fuel_dock_connected: tank.is_fuel_dock_connected !== false,
        notes: tank.notes || "",
      });
    } else {
      const market = markets.includes("Seattle") ? "Seattle" : markets[0] || "";
      setForm({ ...EMPTY, market, fuel_dock_location: market === "Seattle" ? "Seattle Pier 15" : "", facility_name: market ? `${market} Fuel Dock` : "" });
    }
  }, [open, tank, markets]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      capacity_gallons: parseFloat(form.capacity_gallons) || 0,
      current_gallons: parseFloat(form.current_gallons) || 0,
      last_updated: new Date().toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tank ? "Edit Fuel Dock Tank" : "Add Fuel Dock Tank"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Market *</Label>
              <Select value={form.market} onValueChange={(v) => set({ market: v })} required>
                <SelectTrigger><SelectValue placeholder="Select market" /></SelectTrigger>
                <SelectContent>
                  {markets.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fuel Dock</Label>
              <Input value={form.fuel_dock_location} onChange={(e) => set({ fuel_dock_location: e.target.value })} placeholder="e.g., Seattle Pier 15" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Facility Name *</Label>
              <Input value={form.facility_name} onChange={(e) => set({ facility_name: e.target.value })} placeholder="e.g., Seattle Fuel Dock" required />
            </div>
            <div className="space-y-2">
              <Label>Tank Number/Name *</Label>
              <Input value={form.tank_number} onChange={(e) => set({ tank_number: e.target.value })} placeholder="e.g., Tank 1" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Capacity (Gallons) *</Label>
              <Input type="number" value={form.capacity_gallons} onChange={(e) => set({ capacity_gallons: e.target.value })} placeholder="0" required />
            </div>
            <div className="space-y-2">
              <Label>Current Level (Gallons)</Label>
              <Input type="number" value={form.current_gallons} onChange={(e) => set({ current_gallons: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Product Type</Label>
            <Select value={form.product_type} onValueChange={(v) => set({ product_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-cyan-50 border border-cyan-200">
            <Checkbox id="fuel_dock_connected" checked={form.is_fuel_dock_connected} onCheckedChange={(c) => set({ is_fuel_dock_connected: !!c })} />
            <Label htmlFor="fuel_dock_connected" className="cursor-pointer text-sm font-medium text-cyan-900">
              Connected to fuel dock pipeline
            </Label>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} placeholder="Optional notes..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending} className="bg-gradient-to-r from-cyan-600 to-cyan-700">
              <Save className="w-4 h-4 mr-2" />
              {isPending ? "Saving..." : tank ? "Save Changes" : "Add Tank"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}