import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { analyzeWorker, DAILY_LIMIT, ROLLING_72_LIMIT } from "@/components/crew/hosUtils";
import { format } from "date-fns";

const dayCellClass = (hours) => {
  if (hours > DAILY_LIMIT) return "bg-red-100 text-red-800 font-bold";
  if (hours > 12) return "bg-amber-50 text-amber-800 font-semibold";
  if (hours > 0) return "text-slate-700";
  return "text-slate-300";
};

export default function CrewComplianceTable({ records }) {
  if (records.length === 0) return null;

  const dayHeaders = records[0].daily_hours || [];

  const analyzed = records
    .map((r) => ({ record: r, analysis: analyzeWorker(r) }))
    .sort((a, b) => {
      if (a.analysis.hasViolation !== b.analysis.hasViolation)
        return a.analysis.hasViolation ? -1 : 1;
      return (b.record.total_hours || 0) - (a.record.total_hours || 0);
    });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="py-2 px-3 font-semibold text-slate-600">Worker</th>
            <th className="py-2 px-2 font-semibold text-slate-600 hidden lg:table-cell">Position</th>
            <th className="py-2 px-2 font-semibold text-slate-600 hidden md:table-cell">Location</th>
            {dayHeaders.map((d) => (
              <th key={d.date} className="py-2 px-1 font-semibold text-slate-600 text-center">
                <div>{d.day_name.slice(0, 3)}</div>
                <div className="text-[10px] font-normal text-slate-400">
                  {format(new Date(d.date + "T12:00:00"), "M/d")}
                </div>
              </th>
            ))}
            <th className="py-2 px-2 font-semibold text-slate-600 text-center">7-Day</th>
            <th className="py-2 px-2 font-semibold text-slate-600 text-center">Last 72h</th>
            <th className="py-2 px-2 font-semibold text-slate-600 text-center">Avail. Today</th>
            <th className="py-2 px-2 font-semibold text-slate-600 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {analyzed.map(({ record, analysis }) => (
            <tr key={record.id} className={analysis.hasViolation ? "bg-red-50/60" : "hover:bg-slate-50"}>
              <td className="py-2 px-3">
                <div className="font-medium text-slate-900">{record.worker_name}</div>
                <div className="text-[11px] text-slate-400 lg:hidden">{record.job_code}</div>
              </td>
              <td className="py-2 px-2 text-xs text-slate-500 hidden lg:table-cell">
                {record.job_code?.replace("Marine ", "").replace(" TM", "")}
              </td>
              <td className="py-2 px-2 text-xs text-slate-500 hidden md:table-cell">{record.location}</td>
              {analysis.days.map((d) => (
                <td key={d.date} className="py-2 px-1 text-center">
                  <span className={`inline-block min-w-9 rounded px-1 py-0.5 text-xs ${dayCellClass(d.hours)}`}>
                    {d.hours > 0 ? d.hours.toFixed(d.hours % 1 ? 1 : 0) : "—"}
                  </span>
                </td>
              ))}
              <td className="py-2 px-2 text-center font-semibold text-slate-900">
                {(record.total_hours || 0).toFixed(1)}
              </td>
              <td className={`py-2 px-2 text-center font-semibold ${analysis.last3 > ROLLING_72_LIMIT ? "text-red-600" : "text-slate-900"}`}>
                {analysis.last3.toFixed(1)}
              </td>
              <td className="py-2 px-2 text-center">
                <span className={`font-bold ${analysis.remainingToday <= 0 ? "text-red-600" : analysis.remainingToday < 6 ? "text-amber-600" : "text-emerald-600"}`}>
                  {analysis.remainingToday.toFixed(1)}h
                </span>
              </td>
              <td className="py-2 px-2 text-center">
                {analysis.hasViolation ? (
                  <Badge className="bg-red-600 text-white gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {analysis.dayViolations.length > 0 && `>${DAILY_LIMIT}h/24h`}
                    {analysis.dayViolations.length > 0 && analysis.windowViolations.length > 0 && " · "}
                    {analysis.windowViolations.length > 0 && `>${ROLLING_72_LIMIT}h/72h`}
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800 gap-1">
                    <CheckCircle className="w-3 h-3" /> OK
                  </Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}