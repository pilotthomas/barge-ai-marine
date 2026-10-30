import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { TRUCK_UNITS, emptyProductLine } from "./productLines";

// Editable list of actual products on a truck dispatch.
// V1: product name is free text (autocomplete from product CSV planned).
export default function TruckProductLinesEditor({ lines, onChange, showDelivered = false }) {
  const rows = lines && lines.length ? lines : [];
  const update = (i, field, value) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const add = () => onChange([...rows, emptyProductLine()]);
  const remove = (i) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Products on this Dispatch</Label>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="w-4 h-4 mr-1" /> Add Product
        </Button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-slate-500">Add the actual product names (e.g., "Castrol Hyspin AWS 68") and quantities dispatched.</p>
      )}
      {rows.map((row, i) => (
        <div key={i} className={`grid gap-2 items-end ${showDelivered ? "grid-cols-[1fr_90px_90px_90px_32px]" : "grid-cols-[1fr_90px_90px_32px]"}`}>
          <div>
            {i === 0 && <span className="text-xs text-slate-500">Product name</span>}
            <Input value={row.product_name || ""} onChange={(e) => update(i, "product_name", e.target.value)} placeholder="Product name" />
          </div>
          <div>
            {i === 0 && <span className="text-xs text-slate-500">Ordered</span>}
            <Input type="number" step="any" min="0" value={row.ordered_qty ?? ""} onChange={(e) => update(i, "ordered_qty", e.target.value)} />
          </div>
          <div>
            {i === 0 && <span className="text-xs text-slate-500">Unit</span>}
            <Select value={row.unit || "gal"} onValueChange={(v) => update(i, "unit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRUCK_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {showDelivered && (
            <div>
              {i === 0 && <span className="text-xs text-slate-500">Delivered</span>}
              <Input type="number" step="any" min="0" value={row.delivered_qty ?? ""} onChange={(e) => update(i, "delivered_qty", e.target.value)} />
            </div>
          )}
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove product">
            <X className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
