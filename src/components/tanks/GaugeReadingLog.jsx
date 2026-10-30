import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ruler } from "lucide-react";

const TYPE_LABEL = { opening: "Opening", closing: "Closing", spot: "Spot", pre_transfer: "Pre-transfer", post_transfer: "Post-transfer" };

export default function GaugeReadingLog({ readings, tanks }) {
  const [tankId, setTankId] = useState("all");
  const rows = readings
    .filter((r) => tankId === "all" || r.tank_id === tankId)
    .sort((a, b) => (b.reading_date || "").localeCompare(a.reading_date || ""));

  return (
    <Card className="shadow-md border-slate-200 rounded-2xl">
      <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-lg font-semibold text-slate-900">Gauge readings ({rows.length})</CardTitle>
        <Select value={tankId} onValueChange={setTankId}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tanks</SelectItem>
            {tanks.map((t) => <SelectItem key={t.id} value={t.id}>{t.tank_number}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <Ruler className="w-14 h-14 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-600">No gauge readings yet. Use the Gauge button on a tank to record one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Tank</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-right p-3">Gauge</th>
                  <th className="text-right p-3">Gallons</th>
                  <th className="text-right p-3">Book</th>
                  <th className="text-right p-3">Variance</th>
                  <th className="text-left p-3">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3 whitespace-nowrap">{r.reading_date ? format(parseISO(r.reading_date), "MMM d, HH:mm") : "—"}</td>
                    <td className="p-3 font-medium text-slate-900">{r.tank_number}</td>
                    <td className="p-3">{TYPE_LABEL[r.reading_type] || r.reading_type || "—"}</td>
                    <td className="p-3 text-right tabular-nums">{r.gauge_display}</td>
                    <td className="p-3 text-right tabular-nums font-semibold">{(r.gallons || 0).toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums text-slate-500">{(r.book_gallons || 0).toLocaleString()}</td>
                    <td className={`p-3 text-right tabular-nums ${!r.variance_gallons ? "" : r.variance_gallons > 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {r.variance_gallons > 0 ? "+" : ""}{(r.variance_gallons || 0).toLocaleString()}
                    </td>
                    <td className="p-3 text-slate-600">{r.taken_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}