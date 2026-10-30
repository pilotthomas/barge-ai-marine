import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2, Loader2 } from "lucide-react";

const signed = (type, gallons) => (type === "truck_in" ? 1 : -1) * (Number(gallons) || 0);

// Applies a gallon change to the tank's current level so edits/deletes stay in sync.
async function adjustTank(tankId, delta) {
  if (!delta) return;
  const tank = await base44.entities.StorageTank.get(tankId);
  await base44.entities.StorageTank.update(tankId, {
    current_gallons: (tank.current_gallons || 0) + delta,
    last_updated: new Date().toISOString(),
  });
}

export default function TransactionRowActions({ tx }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({});
  const isIn = tx.transaction_type === "truck_in";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["storage-tanks"] });
    queryClient.invalidateQueries({ queryKey: ["storage-tank-transactions"] });
  };

  const startEdit = () => {
    setForm({
      transaction_date: tx.transaction_date || "",
      gallons: tx.gallons ?? "",
      truck_number: tx.truck_number || "",
      bol_number: tx.bol_number || "",
      party: (isIn ? tx.supplier : tx.customer) || "",
      notes: tx.notes || "",
    });
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    const gallons = parseFloat(form.gallons) || 0;
    await base44.entities.StorageTankTransaction.update(tx.id, {
      transaction_date: form.transaction_date,
      gallons,
      truck_number: form.truck_number,
      bol_number: form.bol_number,
      [isIn ? "supplier" : "customer"]: form.party,
      notes: form.notes,
      new_gallons: (tx.previous_gallons || 0) + signed(tx.transaction_type, gallons),
    });
    await adjustTank(tx.tank_id, signed(tx.transaction_type, gallons) - signed(tx.transaction_type, tx.gallons));
    setBusy(false);
    setOpen(false);
    refresh();
  };

  const remove = async () => {
    if (!window.confirm(`Delete this ${(tx.gallons || 0).toLocaleString()} gal line? The tank level will be adjusted back.`)) return;
    setBusy(true);
    await base44.entities.StorageTankTransaction.delete(tx.id);
    await adjustTank(tx.tank_id, -signed(tx.transaction_type, tx.gallons));
    setBusy(false);
    refresh();
  };

  const field = (key, label, type = "text") => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="flex gap-1 justify-end mt-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEdit} disabled={busy}><Pencil className="w-3.5 h-3.5" /></Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={remove} disabled={busy}>
        {busy && !open ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="text-left">
          <DialogHeader><DialogTitle>Edit {tx.tank_number} · {isIn ? "Received" : "Shipped"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {field("transaction_date", "Date", "date")}
            {field("gallons", "Gallons", "number")}
            {field("truck_number", "Truck #")}
            {field("bol_number", "BOL #")}
            {field("party", isIn ? "Supplier" : "Customer")}
            {field("notes", "Notes")}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}