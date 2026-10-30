import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar as CalendarIcon, Ship, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isWithinInterval, addMonths, subMonths, isToday } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const taskTypeColors = {
  "USCG Compliance": "bg-blue-100 text-blue-800 border-blue-200",
  "ABS Compliance": "bg-purple-100 text-purple-800 border-purple-200",
  "SIRE Compliance": "bg-orange-100 text-orange-800 border-orange-200",
  "Drydock Schedule": "bg-red-100 text-red-800 border-red-200",
  "Scheduled Maintenance": "bg-green-100 text-green-800 border-green-200",
  "Internal Inspection": "bg-teal-100 text-teal-800 border-teal-200",
  "Vessel Inspection": "bg-cyan-100 text-cyan-800 border-cyan-200"
};

export default function ComplianceCalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCalendarItem, setSelectedCalendarItem] = useState(null);
  const [showCalendarDetail, setShowCalendarDetail] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ['maintenance-tasks'],
    queryFn: () => base44.entities.MaintenanceTask.list('-due_date'),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  const { data: tugs = [] } = useQuery({
    queryKey: ['tugs'],
    queryFn: () => base44.entities.Tug.list(),
  });

  const isValidDate = (dateString) => {
    if (!dateString) return false;
    try {
      const date = new Date(dateString + 'T12:00:00');
      return date instanceof Date && !isNaN(date.getTime());
    } catch {
      return false;
    }
  };

  // Compliance fields from vessels
  const complianceFields = [
    { key: 'uscg_internal_exam', label: 'USCG Internal Exam', type: 'USCG Compliance' },
    { key: 'uscg_5_year_drydock', label: 'USCG 5 Year Drydock', type: 'USCG Compliance' },
    { key: 'uscg_cargo_tank_exam', label: 'USCG Cargo Tank Exam', type: 'USCG Compliance' },
    { key: 'uscg_coi_expiration', label: 'USCG COI Expiration', type: 'USCG Compliance' },
    { key: 'uscg_cod_expiration', label: 'USCG COD Expiration', type: 'USCG Compliance' },
    { key: 'abs_2_5_year_drydock', label: 'ABS 2.5 Year Drydock', type: 'ABS Compliance' },
    { key: 'abs_load_line', label: 'ABS Load Line', type: 'ABS Compliance' },
    { key: 'abs_class', label: 'ABS Class', type: 'ABS Compliance' },
    { key: 'sire_expiration', label: 'SIRE Expiration', type: 'SIRE Compliance' },
    { key: 'carb_tier3_mandate', label: 'CARB Tier 3 Mandate', type: 'CARB Compliance' },
    { key: 'carb_tier4_mandate', label: 'CARB Tier 4 Mandate', type: 'CARB Compliance' },
  ];

  // Color map for compliance types
  const complianceTypeColors = {
    'USCG Compliance': { bg: 'bg-blue-100', text: 'text-blue-900', border: 'border-blue-200', hover: 'hover:bg-blue-200', accent: 'text-blue-700' },
    'ABS Compliance': { bg: 'bg-purple-100', text: 'text-purple-900', border: 'border-purple-200', hover: 'hover:bg-purple-200', accent: 'text-purple-700' },
    'SIRE Compliance': { bg: 'bg-orange-100', text: 'text-orange-900', border: 'border-orange-200', hover: 'hover:bg-orange-200', accent: 'text-orange-700' },
    'CARB Compliance': { bg: 'bg-green-100', text: 'text-green-900', border: 'border-green-200', hover: 'hover:bg-green-200', accent: 'text-green-700' },
  };

  // Extract all compliance dates from vessels
  const vesselComplianceDates = [];
  [...barges, ...tugs].forEach(vessel => {
    const tugInfo = tugs.find(t => t.id === vessel.id);
    const isThirdPartyTug = tugInfo?.is_third_party || false;
    const companyName = tugInfo?.company_name || null;
    
    complianceFields.forEach(field => {
      if (vessel[field.key] && isValidDate(vessel[field.key])) {
        const daysUntil = differenceInDays(new Date(vessel[field.key]), new Date());
        vesselComplianceDates.push({
          vessel_name: vessel.name,
          vessel_type: vessel.type || 'vessel',
          task_type: field.type,
          task_name: field.label,
          due_date: vessel[field.key],
          status: daysUntil < 0 ? 'overdue' : daysUntil <= 60 ? 'due_soon' : 'upcoming',
          source: 'vessel_compliance',
          is_third_party: isThirdPartyTug,
          company_name: companyName,
          id: `${vessel.id}-${field.key}` // Unique ID for calendar display
        });
      }
    });
  });

  // Get scheduled inspection tasks for calendar
  const scheduledTasks = tasks.filter(t => {
    if (t.status !== 'scheduled') return false;
    if (t.task_type === 'Drydock Schedule') return false;
    return true;
  });

  // Get drydock tasks for calendar
  const drydockTasks = tasks.filter(t => t.task_type === 'Drydock Schedule' && t.status !== 'completed');

  // Calendar setup
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getDrydocksForDay = (day) => {
    return drydockTasks.filter(task => {
      if (!task.drydock_out_of_water_date || !task.drydock_back_in_water_date) return false;

      return isWithinInterval(day, {
        start: new Date(task.drydock_out_of_water_date),
        end: new Date(task.drydock_back_in_water_date)
      });
    });
  };

  const getComplianceForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    
    // Get vessel compliance dates (these take precedence)
    const vesselDates = vesselComplianceDates.filter(item => {
      if (!item.due_date || !isValidDate(item.due_date)) return false;
      try {
        const itemDate = new Date(item.due_date + 'T12:00:00');
        return format(itemDate, 'yyyy-MM-dd') === dayStr;
      } catch {
        return false;
      }
    });

    // Get maintenance tasks (only if no vessel compliance dates exist for this day/vessel)
    const taskDates = tasks
      .filter(t => {
        if (t.status === 'completed') return false;
        if (t.status === 'scheduled') return false; // Skip scheduled, they show separately
        if (t.task_type === 'Drydock Schedule') return false;
        if (!t.due_date || !isValidDate(t.due_date)) return false;
        
        try {
          const taskDate = new Date(t.due_date + 'T12:00:00');
          return format(taskDate, 'yyyy-MM-dd') === dayStr;
        } catch {
          return false;
        }
      })
      .filter(t => {
        // Only include if no vessel compliance date exists for this vessel/task combo
        return !vesselDates.some(v => 
          v.vessel_name === t.vessel_name && 
          v.task_name === t.task_name
        );
      });
    
    return [...vesselDates, ...taskDates];
  };
  
  const getScheduledInspectionsForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return scheduledTasks.filter(task => {
      if (!task.due_date || !isValidDate(task.due_date)) return false;
      try {
        const taskDate = new Date(task.due_date + 'T12:00:00');
        return format(taskDate, 'yyyy-MM-dd') === dayStr;
      } catch {
        return false;
      }
    });
  };

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleCalendarItemClick = (item) => {
    setSelectedCalendarItem(item);
    setShowCalendarDetail(true);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Compliance Calendar
            </h1>
            <p className="text-slate-600">Visual calendar view of all compliance events and drydocks</p>
          </div>
        </div>

        {/* Calendar Detail Dialog */}
        <Dialog open={showCalendarDetail} onOpenChange={setShowCalendarDetail}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <CalendarIcon className="w-6 h-6 text-blue-600" />
                Item Details
              </DialogTitle>
            </DialogHeader>
            {selectedCalendarItem && (
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{selectedCalendarItem.vessel_name}</h3>
                      <p className="text-sm text-slate-600 capitalize">{selectedCalendarItem.vessel_type}</p>
                    </div>
                    <Badge className={taskTypeColors[selectedCalendarItem.task_type]}>
                      {selectedCalendarItem.task_type}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-semibold text-slate-700 min-w-[140px]">Task:</span>
                      <span className="text-sm text-slate-900">{selectedCalendarItem.task_name}</span>
                    </div>
                    {isValidDate(selectedCalendarItem.due_date) && (
                      <div className="flex items-start gap-2">
                        <span className="text-sm font-semibold text-slate-700 min-w-[140px]">Date:</span>
                        <span className="text-sm text-slate-900">
                          {format(parseISO(selectedCalendarItem.due_date), 'MMMM d, yyyy')}
                        </span>
                      </div>
                    )}
                    {selectedCalendarItem.notes && (
                      <div className="flex items-start gap-2 pt-3 border-t border-slate-200">
                        <span className="text-sm font-semibold text-slate-700 min-w-[140px]">Notes:</span>
                        <span className="text-sm text-slate-700">{selectedCalendarItem.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowCalendarDetail(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Calendar Section */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-900">
                {format(currentMonth, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex gap-2">
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
            {/* Legend */}
            <div className="mb-4 flex flex-wrap gap-2 md:gap-3 text-[10px] md:text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-200"></div>
                <span className="text-slate-600">Vessel Down</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-cyan-100 border border-cyan-200"></div>
                <span className="text-slate-600">Scheduled Inspection</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
                <span className="text-slate-600">USCG Compliance</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></div>
                <span className="text-slate-600">ABS Compliance</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-orange-100 border border-orange-200"></div>
                <span className="text-slate-600">SIRE Compliance</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-200"></div>
                <span className="text-slate-600">CARB Compliance</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-pink-100 border border-pink-300"></div>
                <span className="text-slate-600">3rd Party Vessels</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center font-semibold text-xs md:text-sm text-slate-600 py-1 md:py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 md:gap-2">
              {calendarDays.map((day, index) => {
                const dayDrydocks = getDrydocksForDay(day);
                const dayCompliance = getComplianceForDay(day);
                const dayScheduled = getScheduledInspectionsForDay(day);
                const allEvents = [...dayDrydocks, ...dayCompliance, ...dayScheduled];
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isTodayDate = isToday(day);

                return (
                  <div
                    key={index}
                    className={`
                      min-h-20 md:min-h-28 p-1 md:p-2 border rounded-lg transition-all duration-200
                      ${isCurrentMonth ? 'bg-white' : 'bg-slate-50'}
                      ${isTodayDate ? 'border-blue-500 border-2' : 'border-slate-200'}
                      ${allEvents.length > 0 ? 'shadow-sm' : ''}
                    `}
                  >
                    <div className={`text-xs md:text-sm font-medium mb-0.5 md:mb-1 ${
                      isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {/* Show drydocks */}
                      {dayDrydocks.slice(0, 1).map((task) => (
                        <div
                          key={task.id}
                          className="text-xs p-0.5 md:p-1 rounded bg-red-100 text-red-900 border border-red-200 cursor-pointer hover:bg-red-200 transition-colors"
                          onClick={() => handleCalendarItemClick(task)}
                        >
                          <Ship className="w-3 h-3 inline mr-0.5 md:mr-1 hidden md:inline" />
                          <span className="text-[10px] md:text-xs truncate block">{task.vessel_name}</span>
                          <div className="text-[9px] md:text-xs text-red-700 truncate hidden md:block">Drydock</div>
                        </div>
                      ))}
                      {/* Show vessel compliance dates (higher priority) - colored by type */}
                      {dayCompliance.filter(t => t.source === 'vessel_compliance').slice(0, 2).map((item, idx) => {
                        const colors = item.is_third_party 
                          ? { bg: 'bg-pink-100', text: 'text-pink-900', border: 'border-pink-300', hover: 'hover:bg-pink-200', accent: 'text-pink-700' }
                          : complianceTypeColors[item.task_type] || complianceTypeColors['USCG Compliance'];
                        return (
                          <div
                            key={`comp-${idx}`}
                            className={`text-xs p-0.5 md:p-1 rounded cursor-pointer transition-colors ${colors.bg} ${colors.text} border ${colors.border} ${colors.hover}`}
                            onClick={() => handleCalendarItemClick(item)}
                          >
                            <AlertTriangle className="w-3 h-3 inline mr-0.5 md:mr-1 hidden md:inline" />
                            <span className="text-[10px] md:text-xs truncate block">{item.vessel_name}</span>
                            {item.company_name && <div className="text-[9px] md:text-xs truncate text-slate-600">{item.company_name}</div>}
                            <div className={`text-[9px] md:text-xs truncate font-semibold ${colors.accent}`}>{item.task_name}</div>
                          </div>
                        );
                      })}
                      {/* Show maintenance task compliance (lower priority) - colored by type */}
                      {dayCompliance.filter(t => !t.source).slice(0, 1).map((task, idx) => {
                        const colors = complianceTypeColors[task.task_type] || complianceTypeColors['USCG Compliance'];
                        return (
                          <div
                            key={`task-${idx}`}
                            className={`text-xs p-0.5 md:p-1 rounded cursor-pointer transition-colors ${colors.bg} ${colors.text} border ${colors.border} ${colors.hover}`}
                            onClick={() => handleCalendarItemClick(task)}
                          >
                            <AlertTriangle className="w-3 h-3 inline mr-0.5 md:mr-1 hidden md:inline" />
                            <span className="text-[10px] md:text-xs truncate block">{task.vessel_name}</span>
                            <div className={`text-[9px] md:text-xs truncate font-semibold ${colors.accent}`}>{task.task_name}</div>
                          </div>
                        );
                      })}
                      {/* Show scheduled inspections */}
                      {dayScheduled.slice(0, 1).map((task, idx) => (
                        <div
                          key={`sched-${idx}`}
                          className="text-xs p-0.5 md:p-1 rounded bg-cyan-100 text-cyan-900 border border-cyan-200 cursor-pointer hover:bg-cyan-200 transition-colors"
                          onClick={() => handleCalendarItemClick(task)}
                        >
                          <CalendarIcon className="w-3 h-3 inline mr-0.5 md:mr-1 hidden md:inline" />
                          <span className="text-[10px] md:text-xs truncate block">{task.vessel_name}</span>
                          <div className="text-[9px] md:text-xs truncate text-cyan-700 hidden md:block">
                            {task.task_name || 'Scheduled'}
                          </div>
                        </div>
                      ))}
                      {allEvents.length > 3 && (
                        <div className="text-[9px] md:text-xs text-slate-500 font-medium">
                          +{allEvents.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}