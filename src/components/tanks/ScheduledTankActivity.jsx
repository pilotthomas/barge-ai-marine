import React from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Ship, ExternalLink } from "lucide-react";

const statusStyles = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function ScheduledTankActivity({ deliveries, tanksById }) {
  return (
    <Card className="shadow-md border-slate-200 rounded-2xl">
      <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-cyan-600" /> Upcoming deliveries from these tanks ({deliveries.length})
        </CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to="/FuelDockDeliveries"><ExternalLink className="w-4 h-4 mr-1" /> Open Fuel Dock Calendar</Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {deliveries.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Ship className="w-14 h-14 mx-auto mb-3 text-slate-300" />
            <p>No scheduled fuel dock deliveries are linked to a tank yet.</p>
            <p className="text-sm mt-1">Pick a supply tank when scheduling a delivery on the Fuel Dock Calendar.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {deliveries.map((d) => {
              const tank = tanksById[d.storage_tank_id];
              return (
                <div key={d.id} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{d.vessel_name}{d.customer ? ` · ${d.customer}` : ""}</div>
                    <div className="text-sm text-slate-600">
                      {format(parseISO(d.delivery_date), "EEE, MMM d, yyyy")}{d.requested_delivery_time ? ` at ${d.requested_delivery_time}` : ""} • {d.fuel_dock_location}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">From {tank?.tank_number || d.storage_tank_name || "tank"}{d.cargo_type ? ` · ${d.cargo_type}` : ""}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-semibold text-cyan-700 tabular-nums">{(d.gallons_delivered || 0).toLocaleString()} gal</div>
                    <Badge className={`${statusStyles[d.status] || "bg-slate-100 text-slate-800 border-slate-200"} border text-xs`}>{d.status.replace("_", " ")}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}