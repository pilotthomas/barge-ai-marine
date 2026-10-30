import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ruler, AlertTriangle } from "lucide-react";
import MilitaryTimeInput from "@/components/ui/MilitaryTimeInput";
import { gallonsAtInches, toInches, formatGauge, maxGaugeInches, hasChart, FRACTIONS } from "@/components/tanks/strapping";

const READING_TYPES = [
  { value: "opening", label: "Opening (start of day)" },
  { value: "closing", label: "Closing (end of day)" },
  { value: "spot", label: "Spot check" },
  { value: "pre_transfer", label: "Before transfer" },
  { value: "post_transfer", label: "After transfer" },
];

const blank = () => ({ ft: "", inch: "", frac: "0", reading_type: "opening", taken_by: "", notes: "", reading_date: format(new Date(), "yyyy-MM-dd'T'HH:mm") });

export default function GaugeReadingDialog({ open, onOpenChange, tank, onSubmit, isPending }) {
  const [form, setForm] = useState(blank());
  useEffect(() => { if (open) setForm(blank()); }, [open, tank?.id]);

  const inches = useMemo(() => (form.ft === "" && form.inch === "" ? null : toInches(form.ft, form.inch, form.frac)), [form]);
  const gallons = inches == null ? null : gallonsAtInches(tank, inches);
  const book = tank?.current_gallons || 0;
  const variance = gallons == null ? null : gallons - book;
  const outOfRange = inches != null && gallons == null;
  const overSafeFill = gallons != null && tank?.safe_fill_gallons && gallons > tank.safe_fill_gallons;

  if (!tank) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = () => {
    if (gallons == null) return;
    onSubmit({
      tank_id: tank.id,
      tank_number: tank.tank_number,
      facility_name: tank.facility_name,
      market: tank.market,
      product_type: tank.product_type || "",
      reading_date: new Date(form.reading_date).toISOString(),
      gauge_inches: inches,
      gauge_display: formatGauge(inches),
      gallons,
      book_gallons: book,
      variance_gallons: variance,
      reading_type: form.reading_type,
      taken_by: form.taken_by,
      notes: form.notes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ruler className="w-5 h-5 text-cyan-600" /> Gauge {tank.tank_number}</DialogTitle>
          <DialogDescription>
            Enter the innage (product height). Gallons come from the tank's strapping chart.
            {tank.reference_gauge_height && <> Reference height {tank.reference_gauge_height}.</>}
          </DialogDescription>
        </DialogHeader>

        {!hasChart(tank) ? (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">This tank has no strapping chart loaded yet.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Feet</Label><Input type="number" min="0" inputMode="numeric" value={form.ft} onChange={set("ft")} /></div>
              <div><Label>Inches</Label><Input type="number" min="0" max="11" inputMode="numeric" value={form.inch} onChange={set("inch")} /></div>
              <div>
                <Label>Fraction</Label>
                <Select value={form.frac} onValueChange={set("frac")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FRACTIONS.map((f) => <SelectItem key={f.label} value={String(f.value)}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
              <div className="flex justify-between text-sm text-slate-600"><span>Gauge</span><span className="font-medium text-slate-900">{inches == null ? "—" : formatGauge(inches)}</span></div>
              <div className="flex justify-between items-baseline mt-1"><span className="text-sm text-slate-600">Chart gallons</span><span className="text-2xl font-semibold tabular-nums text-slate-900">{gallons == null ? "—" : gallons.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm mt-1"><span className="text-slate-600">Book before reading</span><span className="tabular-nums">{book.toLocaleString()}</span></div>
              {variance != null && (
                <div className="flex justify-between text-sm mt-1"><span className="text-slate-600">Variance</span><span className={`font-semibold tabular-nums ${variance === 0 ? "text-slate-900" : variance > 0 ? "text-emerald-700" : "text-red-700"}`}>{variance > 0 ? "+" : ""}{variance.toLocaleString()}</span></div>
              )}
              {outOfRange && <p className="text-xs text-red-700 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Above the chart's max of {formatGauge(maxGaugeInches(tank))}</p>}
              {overSafeFill && <p className="text-xs text-red-700 mt-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Above safe fill ({tank.safe_fill_gallons.toLocaleString()} gal)</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Reading type</Label>
                <Select value={form.reading_type} onValueChange={set("reading_type")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{READING_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date / time (24h)</Label><div className="flex gap-2">
                <Input type="date" value={form.reading_date.slice(0, 10)} onChange={(e) => setForm({ ...form, reading_date: `${e.target.value}T${form.reading_date.slice(11)}` })} />
                <MilitaryTimeInput className="w-28" value={form.reading_date.slice(11)} onChange={(v) => setForm({ ...form, reading_date: `${form.reading_date.slice(0, 10)}T${v}` })} />
              </div></div>
            </div>
            <div><Label>Gauged by</Label><Input value={form.taken_by} onChange={set("taken_by")} placeholder="Name" /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={set("notes")} /></div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={gallons == null || isPending} className="bg-cyan-600 hover:bg-cyan-700">{isPending ? "Saving…" : "Save reading & set level"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}