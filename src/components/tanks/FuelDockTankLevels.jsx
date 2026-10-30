import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { parseISO, isSameMonth } from "date-fns";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fuel, ArrowRight } from "lucide-react";
import { fillPercent, fillBarColor, ACTIVE_DELIVERY_STATUSES } from "@/components/tanks/tankUtils";

export default function FuelDockTankLevels({ market, deliveries, month }) {
  const { data: tanks = [] } = useQuery({
    queryKey: ["storage-tanks"],
    queryFn: () => base44.entities.StorageTank.list(),
  });

  const connected = tanks.filter((t) => t.is_fuel_dock_connected && (market === "all" || t.market === market));
  if (connected.length === 0) return null;

  const scheduledFor = (tankId) =>
    deliveries.filter(
      (d) => d.storage_tank_id === tankId && ACTIVE_DELIVERY_STATUSES.includes(d.status) && d.delivery_date && isSameMonth(parseISO(d.delivery_date), month)
    );

  return (
    <Card className="shadow-lg border-cyan-200 rounded-2xl overflow-hidden">
      <CardHeader className="border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-white flex flex-row items-center justify-between py-4">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Fuel className="w-5 h-5 text-cyan-600" /> Fuel Dock Tank Levels
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="text-cyan-700 hover:text-cyan-900">
          <Link to="/FuelDockTanks">Manage tanks <ArrowRight className="w-4 h-4 ml-1" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {connected.map((tank) => {
          const current = tank.current_gallons || 0;
          const pct = fillPercent(current, tank.capacity_gallons);
          const draws = scheduledFor(tank.id);
          const committed = draws.reduce((s, d) => s + (d.gallons_delivered || 0), 0);
          return (
            <div key={tank.id} className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-semibold text-slate-900">{tank.tank_number}</span>
                <span className="text-xs text-slate-500">{tank.product_type}</span>
              </div>
              <div className="text-2xl font-semibold text-slate-900 tabular-nums">{current.toLocaleString()} <span className="text-xs font-normal text-slate-500">gal</span></div>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
                <div className={`h-2 rounded-full ${fillBarColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-1.5">
                <span>{pct}% full</span>
                <span className={committed > current ? "text-red-600 font-medium" : ""}>
                  {draws.length} scheduled · {committed.toLocaleString()} gal
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}