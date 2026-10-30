import React from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Droplet, Edit2, Trash2, ArrowDownToLine, ArrowUpFromLine, CalendarDays, AlertTriangle, Ruler } from "lucide-react";
import { getProductColor, fillPercent, fillBarColor } from "@/components/tanks/tankUtils";
import { hasChart, formatGauge, inchesAtGallons } from "@/components/tanks/strapping";

export default function FuelDockTankCard({ tank, scheduledDraws, monthSummary, onEdit, onDelete, onTransaction, onGauge }) {
  const current = tank.current_gallons || 0;
  const pct = fillPercent(current, tank.capacity_gallons);
  const committed = scheduledDraws.reduce((s, d) => s + (d.gallons_delivered || 0), 0);
  const projected = current - committed;
  const projectedPct = fillPercent(projected, tank.capacity_gallons);
  const lowAfterDraws = committed > 0 && projectedPct < 20;

  return (
    <Card className="border border-slate-200/80 hover:shadow-lg transition-shadow rounded-2xl">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-semibold text-xl text-slate-900 tracking-tight">{tank.tank_number}</h3>
            {tank.product_type && <Badge className={`${getProductColor(tank.product_type)} border mt-1`}>{tank.product_type}</Badge>}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(tank)}><Edit2 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => onDelete(tank)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <Droplet className="w-5 h-5 text-sky-600 self-center" />
          <span className="text-3xl font-semibold text-slate-900 tabular-nums">{current.toLocaleString()}</span>
          <span className="text-slate-500 text-sm">gal</span>
        </div>
        <div className="relative w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${fillBarColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          {committed > 0 && (
            <div className="absolute inset-y-0 bg-white/60 border-l border-white" style={{ left: `${Math.min(Math.max(projectedPct, 0), 100)}%`, width: `${Math.min(pct - Math.max(projectedPct, 0), 100)}%` }} />
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1.5">{pct}% of {(tank.capacity_gallons || 0).toLocaleString()} gal capacity</p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-slate-500">Last gauge</p>
            <p className="font-semibold text-slate-900">{tank.last_gauge_inches != null ? formatGauge(tank.last_gauge_inches) : "Not gauged"}</p>
            {tank.last_gauge_date && <p className="text-slate-500">{format(parseISO(tank.last_gauge_date), "MMM d, HH:mm")}</p>}
          </div>
          {tank.safe_fill_gallons ? (
            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-slate-500">Room to safe fill</p>
              <p className={`font-semibold tabular-nums ${current > tank.safe_fill_gallons ? "text-red-700" : "text-slate-900"}`}>{Math.max(tank.safe_fill_gallons - current, 0).toLocaleString()} gal</p>
              <p className="text-slate-500">Safe fill {tank.safe_fill_gallons.toLocaleString()}{hasChart(tank) ? ` @ ${formatGauge(inchesAtGallons(tank, tank.safe_fill_gallons))}` : ""}</p>
            </div>
          ) : null}
        </div>

        {committed > 0 && (
          <div className={`mt-3 p-3 rounded-xl border text-sm ${lowAfterDraws ? "bg-red-50 border-red-200" : "bg-cyan-50 border-cyan-200"}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-700"><CalendarDays className="w-4 h-4" /> Scheduled draws</span>
              <span className="font-semibold text-slate-900">-{committed.toLocaleString()} gal</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-slate-600">Projected level</span>
              <span className={`font-semibold ${lowAfterDraws ? "text-red-700" : "text-slate-900"}`}>{projected.toLocaleString()} gal</span>
            </div>
            {lowAfterDraws && <div className="flex items-center gap-1 text-xs text-red-700 mt-1"><AlertTriangle className="w-3 h-3" /> Plan a truck-in before these deliveries</div>}
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {scheduledDraws.slice(0, 3).map((d) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <span className="truncate">{format(parseISO(d.delivery_date), "MMM d")} · {d.vessel_name}</span>
                  <span className="tabular-nums">{(d.gallons_delivered || 0).toLocaleString()}</span>
                </li>
              ))}
              {scheduledDraws.length > 3 && <li className="text-slate-400">+{scheduledDraws.length - 3} more</li>}
            </ul>
          </div>
        )}

        {monthSummary.count > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800">In: +{monthSummary.totalIn.toLocaleString()}</div>
            <div className="p-2 rounded-lg bg-red-50 text-red-800">Out: -{monthSummary.totalOut.toLocaleString()}</div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          {hasChart(tank) && onGauge && (
            <Button size="sm" variant="outline" className="flex-1 border-cyan-300 text-cyan-700 hover:bg-cyan-50" onClick={() => onGauge(tank)}><Ruler className="w-4 h-4 mr-1" /> Gauge</Button>
          )}
          <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => onTransaction(tank, "truck_in")}><ArrowDownToLine className="w-4 h-4 mr-1" /> In</Button>
          <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => onTransaction(tank, "truck_out")}><ArrowUpFromLine className="w-4 h-4 mr-1" /> Out</Button>
        </div>
      </CardContent>
    </Card>
  );
}