import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowDownToLine, ArrowUpFromLine, Save } from "lucide-react";

const EMPTY = { transaction_date: "", gallons: "", truck_number: "", bol_number: "", driver_name: "", customer: "", supplier: "", notes: "", used_carrier: false };

export default function TankTransactionDialog({ open, onOpenChange, tank, type, onSubmit, isPending }) {
  const [form, setForm] = useState(EMPTY);
  const isIn = type === "truck_in";

  useEffect(() => {
    if (open) setForm({ ...EMPTY, transaction_date: format(new Date(), "yyyy-MM-dd") });
  }, [open, tank, type]);

  if (!tank) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const gallons = parseFloat(form.gallons) || 0;
  const previous = tank.current_gallons || 0;
  const next = isIn ? previous + gallons : previous - gallons;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      tank_id: tank.id,
      facility_name: tank.facility_name || tank.fuel_dock_location || "Fuel Dock",
      tank_number: tank.tank_number,
      market: tank.market,
      transaction_type: type,
      transaction_date: form.transaction_date,
      gallons,
      product_type: tank.product_type || "Unspecified",
      truck_number: form.truck_number,
      bol_number: form.bol_number,
      driver_name: form.driver_name,
      customer: form.customer,
      supplier: form.supplier,
      used_carrier: isIn ? false : form.used_carrier,
      previous_gallons: previous,
      new_gallons: next,
      notes: form.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isIn ? <ArrowDownToLine className="w-5 h-5 text-emerald-600" /> : <ArrowUpFromLine className="w-5 h-5 text-red-600" />}
            {isIn ? "Truck In (Receiving)" : "Truck Out (Shipping)"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="font-semibold text-slate-900">{tank.tank_number}</div>
            <div className="text-sm text-slate-600">{tank.fuel_dock_location || tank.facility_name}{tank.product_type ? ` • ${tank.product_type}` : ""}</div>
            <div className="text-sm text-slate-600">Current level: {previous.toLocaleString()} gal</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={form.transaction_date} onChange={(e) => set({ transaction_date: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Gallons *</Label>
              <Input type="number" value={form.gallons} onChange={(e) => set({ gallons: e.target.value })} placeholder="0" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Truck #</Label>
              <Input value={form.truck_number} onChange={(e) => set({ truck_number: e.target.value })} placeholder="Truck number" />
            </div>
            <div className="space-y-2">
              <Label>BOL #</Label>
              <Input value={form.bol_number} onChange={(e) => set({ bol_number: e.target.value })} placeholder="Bill of Lading" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Driver Name</Label>
            <Input value={form.driver_name} onChange={(e) => set({ driver_name: e.target.value })} placeholder="Driver name" />
          </div>
          {isIn ? (
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Input value={form.supplier} onChange={(e) => set({ supplier: e.target.value })} placeholder="Supplier name" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Customer</Label>
                <Input value={form.customer} onChange={(e) => set({ customer: e.target.value })} placeholder="Customer name" />
              </div>
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Checkbox id="tx_used_carrier" checked={form.used_carrier} onCheckedChange={(c) => set({ used_carrier: !!c })} />
                <Label htmlFor="tx_used_carrier" className="cursor-pointer text-sm font-medium text-amber-900">Used Carrier (3rd party hauler)</Label>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} placeholder="Optional notes..." />
          </div>
          {form.gallons && (
            <div className={`p-3 rounded-lg border-2 text-sm font-medium ${isIn ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-red-50 border-red-200 text-red-900"}`}>
              New tank level: {next.toLocaleString()} gal
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending} className={isIn ? "bg-gradient-to-r from-emerald-600 to-emerald-700" : "bg-gradient-to-r from-red-600 to-red-700"}>
              <Save className="w-4 h-4 mr-2" />
              {isPending ? "Saving..." : "Record Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}