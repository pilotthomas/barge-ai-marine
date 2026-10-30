import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Clock, Users, MapPin, Ship, Anchor, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfDay,
  subDays,
} from "date-fns";

// Parse "HH:MM" time string into decimal hours
const parseTime = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
};

// Calculate service hours from a dispatch's demurrage time fields
const calculateHours = (dispatch) => {
  const start = parseTime(dispatch.time_alongside) ?? parseTime(dispatch.time_transfer_commenced);
  const end = parseTime(dispatch.time_departed) ?? parseTime(dispatch.time_transfer_completed);
  if (start == null || end == null) return null;
  let diff = end - start;
  if (diff < 0) diff += 24; // handle overnight
  return diff;
};

// Collect all crew members from a dispatch
const getCrewList = (dispatch) => {
  const crew = [];
  if (dispatch.captain) crew.push(dispatch.captain);
  if (dispatch.deckhand) crew.push(dispatch.deckhand);
  if (dispatch.tankerman) crew.push(dispatch.tankerman);
  if (dispatch.crew_members?.length) crew.push(...dispatch.crew_members);
  return [...new Set(crew.filter(Boolean))];
};

// Color palette for crew member badges (cycles through)
const crewColors = [
  "bg-blue-100 text-blue-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-800",
  "bg-purple-100 text-purple-800",
  "bg-rose-100 text-rose-800",
  "bg-cyan-100 text-cyan-800",
  "bg-orange-100 text-orange-800",
  "bg-teal-100 text-teal-800",
];

export default function CrewHoursCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedMarket, setSelectedMarket] = useState("all");
  const [selectedCrew, setSelectedCrew] = useState("all");
  const [selectedDay, setSelectedDay] = useState(null);

  React.useEffect(() => {
    base44.auth.me().then((user) => {
      if (user?.default_market) setSelectedMarket(user.default_market);
    }).catch(() => {});
  }, []);

  const { data: dispatches = [] } = useQuery({
    queryKey: ["dispatches"],
    queryFn: () => base44.entities.Dispatch.list("-created_date"),
  });

  // Filter by market and exclude cancelled
  const filteredDispatches = dispatches.filter((d) => {
    if (d.status === "cancelled") return false;
    if (selectedMarket !== "all" && d.market !== selectedMarket) return false;
    return true;
  });

  // Build the set of all crew members for the filter dropdown
  const allCrewMembers = React.useMemo(() => {
    const set = new Set();
    filteredDispatches.forEach((d) => getCrewList(d).forEach((c) => set.add(c)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [filteredDispatches]);

  // Month calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get crew hours for a specific day: returns [{ name, hours, dispatch }]
  const getCrewHoursForDay = (day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayDispatches = filteredDispatches.filter((d) => d.start_date && d.start_date.startsWith(dayStr));
    const entries = [];
    dayDispatches.forEach((d) => {
      const hours = calculateHours(d);
      getCrewList(d).forEach((name) => {
        if (selectedCrew !== "all" && name !== selectedCrew) return;
        entries.push({ name, hours, dispatch: d });
      });
    });
    return entries;
  };

  // Aggregate total hours per crew member across the visible month
  const monthlySummary = React.useMemo(() => {
    const summary = {};
    const monthStr = format(currentMonth, "yyyy-MM");
    filteredDispatches.forEach((d) => {
      if (!d.start_date || !d.start_date.startsWith(monthStr)) return;
      const hours = calculateHours(d);
      getCrewList(d).forEach((name) => {
        if (selectedCrew !== "all" && name !== selectedCrew) return;
        if (!summary[name]) summary[name] = { name, totalHours: 0, jobs: 0, untracked: 0 };
        if (hours != null) summary[name].totalHours += hours;
        else summary[name].untracked += 1;
        summary[name].jobs += 1;
      });
    });
    return Object.values(summary).sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredDispatches, currentMonth, selectedCrew]);

  // Build crew hours by date for rolling window violation checks
  const crewHoursByDate = React.useMemo(() => {
    const map = {};
    filteredDispatches.forEach((d) => {
      if (!d.start_date) return;
      const hours = calculateHours(d);
      if (hours == null) return;
      getCrewList(d).forEach((name) => {
        if (selectedCrew !== "all" && name !== selectedCrew) return;
        if (!map[name]) map[name] = {};
        map[name][d.start_date] = (map[name][d.start_date] || 0) + hours;
      });
    });
    return map;
  }, [filteredDispatches, selectedCrew]);

  // Check HOS violations: >15h in any 24h period, >36h in any 72h period
  const getViolationStatus = (name, day) => {
    const crewMap = crewHoursByDate[name];
    if (!crewMap) return null;
    const dayStr = format(day, "yyyy-MM-dd");
    const h24 = crewMap[dayStr] || 0;
    const d1 = format(subDays(day, 1), "yyyy-MM-dd");
    const d2 = format(subDays(day, 2), "yyyy-MM-dd");
    const h72 = h24 + (crewMap[d1] || 0) + (crewMap[d2] || 0);
    const violations = [];
    if (h24 > 15) violations.push({ type: "24h", hours: h24, limit: 15 });
    if (h72 > 36) violations.push({ type: "72h", hours: h72, limit: 36 });
    return violations.length > 0 ? violations : null;
  };

  // Count HOS violations this month
  const violationCount = React.useMemo(() => {
    let count = 0;
    const seen = new Set();
    calendarDays.forEach((day) => {
      if (day.getMonth() !== currentMonth.getMonth()) return;
      const entries = getCrewHoursForDay(day);
      entries.forEach((e) => {
        const key = `${e.name}-${format(day, "yyyy-MM-dd")}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (getViolationStatus(e.name, day)) count += 1;
      });
    });
    return count;
  }, [calendarDays, crewHoursByDate, currentMonth]);

  // Total hours for the month (all crew)
  const monthTotalHours = monthlySummary.reduce((sum, m) => sum + m.totalHours, 0);

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const dayDetails = selectedDay ? getCrewHoursForDay(selectedDay) : [];

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
              Crew Hours of Service
            </h1>
            <p className="text-sm md:text-base text-slate-600">
              Hours logged by team members from barge dispatches (alongside → departed)
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Select value={selectedMarket} onValueChange={setSelectedMarket}>
              <SelectTrigger className="w-full md:w-44">
                <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Market" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Markets</SelectItem>
                <SelectItem value="Long Beach">Long Beach</SelectItem>
                <SelectItem value="Oakland">Oakland</SelectItem>
                <SelectItem value="Portland">Portland</SelectItem>
                <SelectItem value="Seattle">Seattle</SelectItem>
                <SelectItem value="Wood River">Wood River</SelectItem>
                <SelectItem value="St. Louis">St. Louis</SelectItem>
                <SelectItem value="Wickliffe">Wickliffe</SelectItem>
                <SelectItem value="Memphis">Memphis</SelectItem>
                <SelectItem value="Baton Rouge">Baton Rouge</SelectItem>
                <SelectItem value="Mobile">Mobile</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedCrew} onValueChange={setSelectedCrew}>
              <SelectTrigger className="w-full md:w-52">
                <Users className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Crew member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Crew</SelectItem>
                {allCrewMembers.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Month summary bar */}
        <Card className="shadow-md border-slate-200 bg-gradient-to-r from-sky-50 to-blue-50">
          <CardContent className="p-4 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold text-slate-900">{monthTotalHours.toFixed(1)}</div>
                <div className="text-xs text-slate-500">Total hours this month</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <div>
                <div className="text-2xl font-bold text-slate-900">{monthlySummary.length}</div>
                <div className="text-xs text-slate-500">Crew members</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Anchor className="w-5 h-5 text-amber-600" />
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {monthlySummary.reduce((s, m) => s + m.untracked, 0)}
                </div>
                <div className="text-xs text-slate-500">Jobs w/o logged times</div>
              </div>
            </div>
            {violationCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <div className="text-2xl font-bold text-red-600">{violationCount}</div>
                  <div className="text-xs text-slate-500">HOS violations (&gt;15h/24h or &gt;36h/72h)</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Month calendar */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-900">
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center font-semibold text-sm text-slate-600 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                const entries = getCrewHoursForDay(day);
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isTodayDate = isToday(day);
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const dayTotal = entries.reduce((s, e) => s + (e.hours || 0), 0);
                const hasUntracked = entries.some((e) => e.hours == null);

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-28 p-2 border rounded-lg cursor-pointer transition-all duration-200 ${
                      isCurrentMonth ? "bg-white" : "bg-slate-50"
                    } ${isTodayDate ? "border-blue-500 border-2" : "border-slate-200"} ${
                      isSelected ? "ring-2 ring-orange-500" : ""
                    } ${entries.length > 0 ? "hover:shadow-md" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className={`text-sm font-medium ${isCurrentMonth ? "text-slate-900" : "text-slate-400"}`}>
                        {format(day, "d")}
                      </div>
                      {dayTotal > 0 && (
                        <div className="text-[10px] font-semibold text-blue-600 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {dayTotal.toFixed(1)}h
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      {entries.slice(0, 3).map((entry, i) => {
                        const violation = getViolationStatus(entry.name, day);
                        return (
                          <div
                            key={i}
                            className={`text-[11px] px-1.5 py-0.5 rounded truncate ${
                              violation
                                ? "bg-red-100 text-red-800 font-semibold ring-1 ring-red-300"
                                : crewColors[i % crewColors.length]
                            }`}
                            title={violation ? violation.map((v) => `Over ${v.type} limit: ${v.hours.toFixed(1)}h (max ${v.limit}h)`).join("; ") : ""}
                          >
                            {entry.name}
                            {entry.hours != null && <span> · {entry.hours.toFixed(1)}h</span>}
                            {entry.hours == null && <span className="opacity-60"> · —</span>}
                          </div>
                        );
                      })}
                      {hasUntracked && entries.every((e) => e.hours == null) && entries.length > 0 && (
                        <div className="text-[10px] text-amber-600 font-medium">No times logged</div>
                      )}
                      {entries.length > 3 && (
                        <div className="text-[11px] text-slate-500 font-medium">
                          +{entries.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Day detail */}
          <Card className="shadow-md border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900">
                {selectedDay ? format(selectedDay, "MMMM d, yyyy") : "Select a date"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {!selectedDay && (
                <div className="text-center py-8 text-slate-500">
                  <Ship className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Click a day to see crew hours detail</p>
                </div>
              )}
              {selectedDay && dayDetails.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No crew service logged this day</p>
                </div>
              )}
              {selectedDay && dayDetails.length > 0 && (
                <div className="space-y-2">
                  {dayDetails.map((entry, i) => {
                    const violation = getViolationStatus(entry.name, selectedDay);
                    return (
                      <div key={i} className={`flex items-start justify-between p-2 rounded-lg ${violation ? "bg-red-50 ring-1 ring-red-200" : "hover:bg-slate-50"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${violation ? "bg-red-500" : crewColors[i % crewColors.length].split(" ")[0]}`} />
                            <span className="font-semibold text-slate-900 text-sm">{entry.name}</span>
                            {violation && <AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
                          </div>
                          <div className="text-xs text-slate-500 ml-4 mt-0.5 truncate">
                            {entry.dispatch.vessel_name} → {entry.dispatch.destination}
                          </div>
                          <div className="text-xs text-slate-400 ml-4">
                            {entry.dispatch.time_alongside && `Alongside ${entry.dispatch.time_alongside}`}
                            {entry.dispatch.time_departed && ` · Departed ${entry.dispatch.time_departed}`}
                          </div>
                          {violation && (
                            <div className="text-xs text-red-600 font-medium ml-4 mt-1 space-y-0.5">
                              {violation.map((v, vi) => (
                                <div key={vi}>
                                  HOS violation: {v.hours.toFixed(1)}h in {v.type} (limit {v.limit}h)
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <Badge className={violation ? "bg-red-600 text-white" : entry.hours != null ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}>
                          {entry.hours != null ? `${entry.hours.toFixed(1)}h` : "No times"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly summary */}
          <Card className="shadow-md border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xl font-bold text-slate-900">
                Hours by Crew Member — {format(currentMonth, "MMM yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {monthlySummary.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No crew hours logged this month</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {monthlySummary.map((m, i) => (
                    <div key={m.name} className="p-3 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${crewColors[i % crewColors.length]}`}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 text-sm truncate">{m.name}</div>
                          <div className="text-xs text-slate-500">
                            {m.jobs} {m.jobs === 1 ? "job" : "jobs"}
                            {m.untracked > 0 && <span className="text-amber-600"> · {m.untracked} no times</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{m.totalHours.toFixed(1)}h</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}