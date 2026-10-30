import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";
import TruckProductLinesEditor from "./TruckProductLinesEditor";
import { cleanProductLines, sumGallons } from "./productLines";

// Close out a truck delivery: enter actual delivered quantities per product, BOL and SO numbers.
export default function TruckCloseOutDialog({ dispatch, open, onOpenChange, onSave, isSaving }) {
  const [lines, setLines] = useState([]);
  const [bol, setBol] = useState("");
  const [so, setSo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!dispatch) return;
    const existing = dispatch.product_lines && dispatch.product_lines.length
      ? dispatch.product_lines
      : dispatch.product
        ? [{ product_name: dispatch.product + (dispatch.brand ? ` (${dispatch.brand})` : ""), unit: "gal", ordered_qty: dispatch.gallons ?? "", delivered_qty: "" }]
        : [];
    setLines(existing.map((l) => ({ ...l, delivered_qty: l.delivered_qty ?? "" })));
    setBol(dispatch.bol_number || "");
    setSo(dispatch.so_number || "");
    setError("");
  }, [dispatch, open]);

  const handleSave = async () => {
    const cleaned = cleanProductLines(lines);
    if (cleaned.length === 0) return setError("Add at least one product.");
    if (cleaned.some((l) => l.delivered_qty === null)) return setError("Enter a delivered quantity for every product (use 0 if nothing was delivered).");
    let who = "";
    try { who = (await base44.auth.me())?.full_name || ""; } catch (e) { /* ignore */ }
    const deliveredGallons = sumGallons(cleaned, "delivered_qty");
    onSave({
      product_lines: cleaned,
      bol_number: bol,
      so_number: so,
      gallons: deliveredGallons ?? dispatch.gallons ?? null,
      status: "delivered",
      closed_out: true,
      closed_out_date: new Date().toISOString(),
      closed_out_by_name: who,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Close Out Delivery{dispatch?.customer_name ? `: ${dispatch.customer_name}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Enter the actual quantity delivered for each product. Saving marks the dispatch as delivered.</p>
          <TruckProductLinesEditor lines={lines} onChange={setLines} showDelivered />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>BOL Number</Label>
              <Input value={bol} onChange={(e) => setBol(e.target.value)} />
            </div>
            <div>
              <Label>SO / SAGE Number</Label>
              <Input value={so} onChange={(e) => setSo(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Close Out Delivery"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
