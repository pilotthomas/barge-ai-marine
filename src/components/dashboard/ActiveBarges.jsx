import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ship, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function ActiveBarges({ barges, dispatches }) {
  const activeDispatches = dispatches.filter(d => d.status === 'in_transit');
  
  const bargeUtilization = barges.map(barge => {
    const bargeDispatches = activeDispatches.filter(d => d.barge_id === barge.id);
    return {
      ...barge,
      activeDispatch: bargeDispatches[0] || null,
      utilization: barge.status === 'dispatched' ? 100 : 0
    };
  });

  return (
    <Card className="shadow-md border-slate-200">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-600" />
          Fleet Status
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {barges.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Ship className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No barges in fleet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bargeUtilization.map((barge) => (
              <div key={barge.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ship className="w-4 h-4 text-slate-600" />
                    <span className="font-medium text-slate-900">{barge.name}</span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    barge.status === 'dispatched' 
                      ? 'bg-orange-100 text-orange-800' 
                      : barge.status === 'available'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-800'
                  }`}>
                    {barge.status}
                  </span>
                </div>
                {barge.activeDispatch && (
                  <p className="text-xs text-slate-600 ml-6">
                    {barge.activeDispatch.origin} → {barge.activeDispatch.destination}
                  </p>
                )}
                <Progress value={barge.utilization} className="h-2" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}