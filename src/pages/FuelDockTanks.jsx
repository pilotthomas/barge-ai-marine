import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, endOfMonth, startOfToday, addDays } from "date-fns";
import { base44 } from "@/api/base44Client";
import { useRegion } from "@/lib/RegionContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Fuel, Plus, Warehouse, History, CalendarDays, Gauge, Droplet, Ruler } from "lucide-react";
import GaugeReadingDialog from "@/components/tanks/GaugeReadingDialog";
import GaugeReadingLog from "@/components/tanks/GaugeReadingLog";
import TankFormDialog from "@/components/tanks/TankFormDialog";
import TankTransactionDialog from "@/components/tanks/TankTransactionDialog";
import FuelDockTankCard from "@/components/tanks/FuelDockTankCard";
import TankTransactionHistory from "@/components/tanks/TankTransactionHistory";
import ScheduledTankActivity from "@/components/tanks/ScheduledTankActivity";
import { ACTIVE_DELIVERY_STATUSES } from "@/components/tanks/tankUtils";

export default function FuelDockTanks() {
  const { markets, regionLabel } = useRegion();
  const queryClient = useQueryClient();
  const [showTankForm, setShowTankForm] = useState(false);
  const [editingTank, setEditingTank] = useState(null);
  const [txTank, setTxTank] = useState(null);
  const [txType, setTxType] = useState("truck_in");
  const [historyMonth, setHistoryMonth] = useState(new Date());
  const [gaugeTank, setGaugeTank] = useState(null);

  const { data: tanks = [], isLoading } = useQuery({ queryKey: ["storage-tanks"], queryFn: () => base44.entities.StorageTank.list() });
  const { data: transactions = [] } = useQuery({ queryKey: ["storage-tank-transactions"], queryFn: () => base44.entities.StorageTankTransaction.list("-transaction_date", 500) });
  const { data: deliveries = [] } = useQuery({ queryKey: ["fuel-dock-deliveries"], queryFn: () => base44.entities.FuelDockDelivery.list("-delivery_date") });
  const { data: products = [] } = useQuery({ queryKey: ["cargo"], queryFn: () => base44.entities.Cargo.list() });
  const { data: gaugeReadings = [] } = useQuery({ queryKey: ["tank-gauge-readings"], queryFn: () => base44.entities.TankGaugeReading.list("-reading_date", 500) });

  const connectedTanks = tanks.filter((t) => t.is_fuel_dock_connected);
  const tanksById = Object.fromEntries(connectedTanks.map((t) => [t.id, t]));
  const today = startOfToday();

  const upcoming = deliveries
    .filter((d) => tanksById[d.storage_tank_id] && ACTIVE_DELIVERY_STATUSES.includes(d.status) && d.delivery_date && parseISO(d.delivery_date) >= today)
    .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date));
  const drawsByTank = upcoming.reduce((acc, d) => ((acc[d.storage_tank_id] ||= []).push(d), acc), {});

  const monthStart = startOfMonth(historyMonth);
  const monthEnd = endOfMonth(historyMonth);
  const monthTransactions = transactions.filter((t) => {
    if (!tanksById[t.tank_id]) return false;
    const d = parseISO(t.transaction_date);
    return d >= monthStart && d <= monthEnd;
  });
  const monthSummary = (tankId) => {
    const rows = monthTransactions.filter((t) => t.tank_id === tankId);
    const totalIn = rows.filter((t) => t.transaction_type === "truck_in").reduce((s, t) => s + (t.gallons || 0), 0);
    const totalOut = rows.filter((t) => t.transaction_type === "truck_out").reduce((s, t) => s + (t.gallons || 0), 0);
    return { totalIn, totalOut, count: rows.length };
  };

  const totalOnHand = connectedTanks.reduce((s, t) => s + (t.current_gallons || 0), 0);
  const totalCapacity = connectedTanks.reduce((s, t) => s + (t.capacity_gallons || 0), 0);
  const next7 = upcoming.filter((d) => parseISO(d.delivery_date) <= addDays(today, 7)).reduce((s, d) => s + (d.gallons_delivered || 0), 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["storage-tanks"] });
    queryClient.invalidateQueries({ queryKey: ["storage-tank-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["tank-gauge-readings"] });
  };

  // A physical gauge reading is the source of truth: log it, then reset the tank's book level to the chart gallons.
  const saveGauge = useMutation({
    mutationFn: async (reading) => {
      const saved = await base44.entities.TankGaugeReading.create(reading);
      await base44.entities.StorageTank.update(reading.tank_id, {
        current_gallons: reading.gallons,
        last_gauge_inches: reading.gauge_inches,
        last_gauge_date: reading.reading_date,
        last_updated: new Date().toISOString(),
      });
      return saved;
    },
    onSuccess: () => { invalidate(); setGaugeTank(null); },
  });

  const saveTank = useMutation({
    mutationFn: (data) => (editingTank ? base44.entities.StorageTank.update(editingTank.id, data) : base44.entities.StorageTank.create(data)),
    onSuccess: () => { invalidate(); setShowTankForm(false); setEditingTank(null); },
  });
  const deleteTank = useMutation({ mutationFn: (id) => base44.entities.StorageTank.delete(id), onSuccess: invalidate });
  const createTransaction = useMutation({
    mutationFn: async (data) => {
      const tx = await base44.entities.StorageTankTransaction.create(data);
      await base44.entities.StorageTank.update(data.tank_id, { current_gallons: data.new_gallons, last_updated: new Date().toISOString() });
      return tx;
    },
    onSuccess: () => { invalidate(); setTxTank(null); },
  });

  const groups = connectedTanks.reduce((acc, t) => {
    const key = t.fuel_dock_location || t.facility_name || "Fuel Dock";
    (acc[key] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600 mb-1">{regionLabel}</p>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 mb-1">Fuel Dock Tanks</h1>
            <p className="text-slate-600">Shore tanks feeding the fuel dock — track levels, truck movements and scheduled draws</p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline"><Link to="/FuelDockDeliveries"><CalendarDays className="w-4 h-4 mr-2" /> Fuel Dock Calendar</Link></Button>
            <Button onClick={() => { setEditingTank(null); setShowTankForm(true); }} className="bg-gradient-to-r from-cyan-600 to-cyan-700 shadow-lg">
              <Plus className="w-5 h-5 mr-2" /> Add Tank
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "On hand", value: `${totalOnHand.toLocaleString()} gal`, sub: `${totalCapacity ? Math.round((totalOnHand / totalCapacity) * 100) : 0}% of ${totalCapacity.toLocaleString()} gal`, icon: Droplet },
            { label: "Scheduled next 7 days", value: `${next7.toLocaleString()} gal`, sub: `${upcoming.length} upcoming deliveries`, icon: CalendarDays },
            { label: "Connected tanks", value: connectedTanks.length, sub: `${Object.keys(groups).length} fuel dock${Object.keys(groups).length === 1 ? "" : "s"}`, icon: Gauge },
          ].map((s) => (
            <Card key={s.label} className="rounded-2xl border-slate-200 shadow-md">
              <CardContent className="p-5 flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">{s.label}</p>
                  <p className="text-2xl font-semibold text-slate-900 tabular-nums">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
                </div>
                <s.icon className="w-6 h-6 text-cyan-500" />
              </CardContent>
            </Card>
          ))}
        </div>

        <TankFormDialog open={showTankForm} onOpenChange={setShowTankForm} tank={editingTank} products={products.filter((p) => p.is_active !== false)} markets={markets} onSubmit={saveTank.mutate} isPending={saveTank.isPending} />
        <GaugeReadingDialog open={!!gaugeTank} onOpenChange={(o) => !o && setGaugeTank(null)} tank={gaugeTank} onSubmit={saveGauge.mutate} isPending={saveGauge.isPending} />
        <TankTransactionDialog open={!!txTank} onOpenChange={(o) => !o && setTxTank(null)} tank={txTank} type={txType} onSubmit={createTransaction.mutate} isPending={createTransaction.isPending} />

        <Tabs defaultValue="tanks" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="tanks" className="gap-2"><Warehouse className="w-4 h-4" /> Tank Levels</TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2"><CalendarDays className="w-4 h-4" /> Scheduled</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><History className="w-4 h-4" /> History</TabsTrigger>
            <TabsTrigger value="gauges" className="gap-2"><Ruler className="w-4 h-4" /> Gauge Log</TabsTrigger>
          </TabsList>

          <TabsContent value="tanks" className="space-y-6">
            {isLoading ? (
              <div className="p-12 text-center text-slate-500">Loading tanks…</div>
            ) : connectedTanks.length === 0 ? (
              <Card className="rounded-2xl border-slate-200 shadow-md">
                <CardContent className="p-12 text-center">
                  <Fuel className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No fuel dock tanks yet</h3>
                  <p className="text-slate-600 mb-6">Add the Seattle tanks connected to the fuel dock to start tracking inventory and scheduling.</p>
                  <Button onClick={() => setShowTankForm(true)} className="bg-gradient-to-r from-cyan-600 to-cyan-700"><Plus className="w-4 h-4 mr-2" /> Add Tank</Button>
                </CardContent>
              </Card>
            ) : (
              Object.entries(groups).map(([dock, dockTanks]) => (
                <Card key={dock} className="rounded-2xl border-2 border-cyan-200 shadow-lg overflow-hidden">
                  <CardHeader className="border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-white">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-xl flex items-center justify-center shadow-md"><Fuel className="w-6 h-6 text-white" /></div>
                      <div>
                        <CardTitle className="text-2xl font-semibold text-slate-900">{dock}</CardTitle>
                        <p className="text-sm text-slate-600">{dockTanks.length} tank{dockTanks.length === 1 ? "" : "s"} · {dockTanks[0].market}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {dockTanks.map((tank) => (
                      <FuelDockTankCard
                        key={tank.id}
                        tank={tank}
                        scheduledDraws={drawsByTank[tank.id] || []}
                        monthSummary={monthSummary(tank.id)}
                        onEdit={(t) => { setEditingTank(t); setShowTankForm(true); }}
                        onDelete={(t) => window.confirm(`Delete ${t.tank_number}? This cannot be undone.`) && deleteTank.mutate(t.id)}
                        onTransaction={(t, type) => { setTxTank(t); setTxType(type); }}
                        onGauge={setGaugeTank}
                      />
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduledTankActivity deliveries={upcoming} tanksById={tanksById} />
          </TabsContent>

          <TabsContent value="history">
            <TankTransactionHistory transactions={monthTransactions} month={historyMonth} onMonthChange={setHistoryMonth} />
          </TabsContent>

          <TabsContent value="gauges">
            <GaugeReadingLog readings={gaugeReadings.filter((r) => tanksById[r.tank_id])} tanks={connectedTanks} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}