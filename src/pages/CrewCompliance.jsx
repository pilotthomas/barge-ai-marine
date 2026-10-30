import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, AlertTriangle, Clock, ShieldCheck, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import HoursUploader from "@/components/crew/HoursUploader";
import CrewComplianceTable from "@/components/crew/CrewComplianceTable";
import { analyzeWorker, DAILY_LIMIT, ROLLING_72_LIMIT } from "@/components/crew/hosUtils";

export default function CrewCompliance() {
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["crewWeeklyHours"],
    queryFn: () => base44.entities.CrewWeeklyHours.list("-created_date", 500),
  });

  const ALLOWED_JOB_CODES = ["Marine Pilot TM", "Marine Tankerman TM", "Marine Ships Crew TM"];
  const marineRecords = records.filter((r) => ALLOWED_JOB_CODES.includes((r.job_code || "").trim()));

  const regions = [...new Set(marineRecords.map((r) => r.region).filter(Boolean))].sort();

  const filtered = marineRecords.filter((r) => {
    if (regionFilter !== "all" && r.region !== regionFilter) return false;
    if (search && !r.worker_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const analyses = filtered.map((r) => analyzeWorker(r));
  const violationCount = analyses.filter((a) => a.hasViolation).length;
  const maxedOut = analyses.filter((a) => a.remainingToday <= 0).length;
  const weekEnd = records[0]?.week_end_date;

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
              USCG Crew Compliance
            </h1>
            <p className="text-sm md:text-base text-slate-600">
              Hours of service vs. 46 U.S.C. §8104 — max {DAILY_LIMIT}h in any 24-hour period, max{" "}
              {ROLLING_72_LIMIT}h in any 72-hour period
            </p>
          </div>
        </div>

        {/* Uploader */}
        <HoursUploader onUploaded={() => queryClient.invalidateQueries({ queryKey: ["crewWeeklyHours"] })} />

        {records.length > 0 && (
          <>
            {/* Summary bar */}
            <Card className="shadow-md border-slate-200 bg-gradient-to-r from-sky-50 to-blue-50">
              <CardContent className="p-4 flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{filtered.length}</div>
                    <div className="text-xs text-slate-500">Crew members</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-5 h-5 ${violationCount > 0 ? "text-red-600" : "text-slate-400"}`} />
                  <div>
                    <div className={`text-2xl font-bold ${violationCount > 0 ? "text-red-600" : "text-slate-900"}`}>
                      {violationCount}
                    </div>
                    <div className="text-xs text-slate-500">HOS violations</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className={`w-5 h-5 ${maxedOut > 0 ? "text-amber-600" : "text-emerald-600"}`} />
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{maxedOut}</div>
                    <div className="text-xs text-slate-500">No hours available today</div>
                  </div>
                </div>
                {weekEnd && (
                  <div className="flex items-center gap-2 ml-auto">
                    <FileSpreadsheet className="w-5 h-5 text-slate-400" />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        Week ending {format(new Date(weekEnd + "T12:00:00"), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-slate-500">Current report</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Table */}
            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <CardTitle className="text-xl font-bold text-slate-900">
                    Crew Hours vs. USCG Limits
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Search worker..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 w-full sm:w-52"
                      />
                    </div>
                    <Select value={regionFilter} onValueChange={setRegionFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Regions</SelectItem>
                        {regions.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-2 md:p-4">
                <CrewComplianceTable records={filtered} />
                {filtered.length === 0 && (
                  <div className="text-center py-8 text-slate-500">No workers match your filters</div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {!isLoading && records.length === 0 && (
          <Card className="shadow-md border-slate-200">
            <CardContent className="py-12 text-center text-slate-500">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hours report uploaded yet</p>
              <p className="text-sm mt-1">
                Download the "PTL Weekly Hours by Roster" report from Workday and upload it above to track
                crew hours against USCG crewing requirements.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}