import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, CheckCircle, Calendar as CalendarIcon, Ship, Wrench, Save, X, Mail, Edit2, TrendingDown } from "lucide-react";
import LostRevenueTracker from "../components/maintenance/LostRevenueTracker";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO, differenceInDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const taskTypeColors = {
  "USCG Compliance": "bg-blue-100 text-blue-800 border-blue-200",
  "ABS Compliance": "bg-purple-100 text-purple-800 border-purple-200",
  "SIRE Compliance": "bg-orange-100 text-orange-800 border-orange-200",
  "Drydock Schedule": "bg-red-100 text-red-800 border-red-200",
  "Scheduled Maintenance": "bg-green-100 text-green-800 border-green-200",
  "Internal Inspection": "bg-teal-100 text-teal-800 border-teal-200",
  "Vessel Inspection": "bg-cyan-100 text-cyan-800 border-cyan-200"
};

const statusColors = {
  upcoming: "bg-slate-100 text-slate-800 border-slate-200",
  due_soon: "bg-yellow-100 text-yellow-800 border-yellow-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  scheduled: "bg-blue-100 text-blue-800 border-blue-200"
};

export default function Maintenance() {
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({
    vessel_type: 'barge',
    vessel_id: '',
    vessel_name: '',
    task_type: 'USCG Compliance',
    task_name: '',
    status_code: 'DRY DOCK',
    current_condition: 'MODERATE REPAIR',
    due_date: '',
    status: 'upcoming',
    completion_date: '',
    drydock_out_of_water_date: '',
    drydock_back_in_water_date: '',
    facility_location: '',
    estimated_downtime_days: '',
    notes: '',
    is_afe_item: false,
    afe_request_number: '',
    afe_po_number: '',
    vendor_name: '',
    budgeted_amount: '',
    final_charge: ''
  });

  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ['maintenance-tasks'],
    queryFn: () => base44.entities.MaintenanceTask.list('-due_date'),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: tugs = [] } = useQuery({
    queryKey: ['tugs'],
    queryFn: () => base44.entities.Tug.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MaintenanceTask.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MaintenanceTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MaintenanceTask.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });

  const markBackInServiceMutation = useMutation({
    mutationFn: ({ id, task }) => base44.entities.MaintenanceTask.update(id, {
      ...task,
      status: 'completed',
      completion_date: format(new Date(), 'yyyy-MM-dd')
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });

  const sendAlertMutation = useMutation({
    mutationFn: async (task) => {
      const daysUntil = differenceInDays(new Date(task.due_date), new Date());
      const emailBody = `
Compliance Task Due Soon

Vessel: ${task.vessel_name} (${task.vessel_type})
Task Type: ${task.task_type}
Task Name: ${task.task_name}
Due Date: ${format(parseISO(task.due_date), 'MMM d, yyyy')}
Days Until Due: ${daysUntil}
Status: ${task.status}

${task.notes ? `Notes: ${task.notes}` : ''}

This is an automated alert from PTL Marine Compliance System.
      `;

      await base44.functions.invoke('sendEmail', {
        to: 'ca.orders@ptlmarine.com',
        subject: `Compliance Alert: ${task.task_name} - ${task.vessel_name} (Due in ${daysUntil} days)`,
        html: emailBody.replace(/\n/g, '<br/>')
      });

      // Update last alert sent
      await base44.entities.MaintenanceTask.update(task.id, {
        ...task,
        last_alert_sent: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    }
  });

  const resetForm = () => {
    setFormData({
      vessel_type: 'barge',
      vessel_id: '',
      vessel_name: '',
      task_type: 'USCG Compliance',
      task_name: '',
      status_code: 'DRY DOCK',
      current_condition: 'MODERATE REPAIR',
      due_date: '',
      status: 'upcoming',
      completion_date: '',
      drydock_out_of_water_date: '',
      drydock_back_in_water_date: '',
      facility_location: '',
      estimated_downtime_days: '',
      notes: '',
      is_afe_item: false,
      afe_request_number: '',
      afe_po_number: '',
      vendor_name: '',
      budgeted_amount: '',
      final_charge: ''
    });
    setShowForm(false);
    setEditingTask(null);
  };

  const handleAddDrydock = () => {
    setFormData({
      vessel_type: 'barge',
      vessel_id: '',
      vessel_name: '',
      task_type: 'Drydock Schedule',
      task_name: '',
      status_code: 'DRY DOCK',
      current_condition: 'MODERATE REPAIR',
      due_date: '',
      status: 'scheduled',
      completion_date: '',
      drydock_out_of_water_date: '',
      drydock_back_in_water_date: '',
      facility_location: '',
      estimated_downtime_days: '',
      notes: '',
      is_afe_item: false,
      afe_request_number: '',
      afe_po_number: '',
      vendor_name: '',
      budgeted_amount: '',
      final_charge: ''
    });
    setEditingTask(null);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // For drydock schedules, set due_date to the out of water date if not already set
    const submitData = { ...formData };
    if (formData.task_type === 'Drydock Schedule' && !formData.due_date && formData.drydock_out_of_water_date) {
      submitData.due_date = formData.drydock_out_of_water_date;
    }
    
    // Convert AFE amounts to numbers if they exist
    if (submitData.budgeted_amount !== '' && submitData.budgeted_amount !== null && submitData.budgeted_amount !== undefined) {
      submitData.budgeted_amount = parseFloat(submitData.budgeted_amount);
    } else {
      delete submitData.budgeted_amount;
    }
    
    if (submitData.final_charge !== '' && submitData.final_charge !== null && submitData.final_charge !== undefined) {
      submitData.final_charge = parseFloat(submitData.final_charge);
    } else {
      delete submitData.final_charge;
    }

    // Handle estimated_downtime_days
    if (submitData.estimated_downtime_days !== '' && submitData.estimated_downtime_days !== null && submitData.estimated_downtime_days !== undefined) {
      submitData.estimated_downtime_days = parseInt(submitData.estimated_downtime_days);
    } else {
      delete submitData.estimated_downtime_days;
    }
    
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData(task);
    setShowForm(true);
  };

  const handleVesselSelect = (vesselId) => {
    const vessel = formData.vessel_type === 'barge'
      ? barges.find(b => b.id === vesselId)
      : tugs.find(t => t.id === vesselId);

    setFormData({
      ...formData,
      vessel_id: vesselId,
      vessel_name: vessel?.name || ''
    });
  };

  // Calculate task status based on due date
  const getTaskStatus = (task) => {
    if (task.status === 'completed') return 'completed';

    const daysUntil = differenceInDays(new Date(task.due_date), new Date());

    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 60) return 'due_soon';
    return 'upcoming';
  };

  // Calculate back in service date from start date and days
  const calculateBackInServiceDate = (startDate, days) => {
    if (!startDate || !days) return '';
    const start = new Date(startDate);
    // Ensure days is a number, default to 0 if not valid
    const numericDays = parseInt(days, 10);
    if (isNaN(numericDays)) return '';

    const back = new Date(start);
    back.setDate(start.getDate() + numericDays);
    return format(back, 'yyyy-MM-dd');
  };

  // Calculate days to service (keeping this for displaying existing records)
  const calculateDaysToService = (backInWaterDate) => {
    if (!backInWaterDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const backDate = new Date(backInWaterDate);
    backDate.setHours(0, 0, 0, 0);
    return differenceInDays(backDate, today);
  };

  // Group tasks by type - EXCLUDE Drydock Schedule tasks (they go to Vessels Down)
  const tasksByType = {};
  tasks.forEach(task => {
    // Skip compliance tasks AND drydock tasks - they're managed elsewhere
    if (task.task_type === 'USCG Compliance' ||
        task.task_type === 'ABS Compliance' ||
        task.task_type === 'SIRE Compliance' ||
        task.task_type === 'Drydock Schedule') {
      return;
    }
    const type = task.task_type;
    if (!tasksByType[type]) {
      tasksByType[type] = [];
    }
    tasksByType[type].push({
      ...task,
      calculatedStatus: getTaskStatus(task)
    });
  });

  const isValidDate = (dateString) => {
    if (!dateString) return false;
    try {
      const date = new Date(dateString + 'T00:00:00.000Z');
      return date instanceof Date && !isNaN(date.getTime());
    } catch {
      return false;
    }
  };

  // Get vessels currently down - show all non-completed drydock tasks
  const vesselsDown = tasks.filter(t => {
    if (t.status === 'completed') return false;
    if (t.task_type !== 'Drydock Schedule') return false;
    return true;
  });

  // Get recently returned to service (completed in last 30 days)
  const recentlyReturned = tasks.filter(t => {
    if (t.status !== 'completed') return false;
    if (t.task_type !== 'Drydock Schedule') return false;
    if (!t.completion_date) return false;
    
    const completedDate = new Date(t.completion_date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return completedDate >= thirtyDaysAgo;
  });



  // Get tasks needing alerts (due within 60 days, no alert sent in last 14 days)
  const tasksNeedingAlerts = tasks.filter(t => {
    if (t.status === 'completed') return false;

    const daysUntil = isValidDate(t.due_date) ? differenceInDays(new Date(t.due_date), new Date()) : Infinity; // Use Infinity if date is invalid
    
    // Only include tasks that are overdue or due within 60 days
    if (daysUntil > 60) return false;

    // Check if an alert has been sent recently
    if (t.last_alert_sent) {
      const daysSinceAlert = differenceInDays(new Date(), new Date(t.last_alert_sent));
      return daysSinceAlert >= 14; // Send new alert if last one was > 14 days ago
    }

    // If no alert ever sent, send one
    return true;
  });



  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Vessel Maintenance
            </h1>
            <p className="text-slate-600">Track vessel repairs, maintenance, and dry docks</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Task
          </Button>
        </div>

        {/* Alert Section */}
        {tasksNeedingAlerts.length > 0 && (
          <Card className="shadow-lg border-2 border-yellow-300 bg-yellow-50">
            <CardHeader className="border-b border-yellow-200">
              <div className="flex items-center justify-between">
                <Dialog>
                  <DialogTrigger asChild>
                    <div className="flex items-center gap-3 cursor-pointer hover:bg-blue-100 transition-colors p-2 rounded-lg">
                      <AlertTriangle className="w-6 h-6 text-yellow-600" />
                      <CardTitle className="text-xl font-bold text-slate-900">
                        {tasksNeedingAlerts.length} Task{tasksNeedingAlerts.length !== 1 ? 's' : ''} Need Attention
                      </CardTitle>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6 text-yellow-600" />
                        Compliance Tasks Needing Attention
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 mt-4">
                      {tasksNeedingAlerts.map(task => {
                        const daysUntil = isValidDate(task.due_date) ? differenceInDays(new Date(task.due_date), new Date()) : null;
                        const isOverdue = daysUntil !== null && daysUntil < 0;
                        
                        return (
                          <div
                            key={task.id}
                            className={`p-4 rounded-lg border-2 ${
                              isOverdue
                                ? 'bg-red-50 border-red-300'
                                : 'bg-yellow-50 border-yellow-300'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-bold text-slate-900 text-lg">{task.vessel_name}</h4>
                                <p className="text-sm text-slate-600 capitalize">{task.vessel_type}</p>
                              </div>
                              <Badge className={
                                isOverdue
                                  ? 'bg-red-100 text-red-800 border-red-200'
                                  : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                              }>
                                {isOverdue ? 'OVERDUE' : 'DUE SOON'}
                              </Badge>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-start gap-2">
                                <span className="text-sm font-semibold text-slate-700 min-w-[100px]">Task Type:</span>
                                <Badge className={taskTypeColors[task.task_type] + ' border'}>
                                  {task.task_type}
                                </Badge>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="text-sm font-semibold text-slate-700 min-w-[100px]">Task Name:</span>
                                <span className="text-sm text-slate-900">{task.task_name}</span>
                              </div>
                              {isValidDate(task.due_date) && (
                                <div className="flex items-start gap-2">
                                  <span className="text-sm font-semibold text-slate-700 min-w-[100px]">Due Date:</span>
                                  <span className="text-sm text-slate-900">
                                    {format(parseISO(task.due_date), 'MMMM d, yyyy')}
                                  </span>
                                </div>
                              )}
                              {daysUntil !== null && (
                                <div className="flex items-start gap-2">
                                  <span className="text-sm font-semibold text-slate-700 min-w-[100px]">Status:</span>
                                  <span className={`text-sm font-bold ${
                                    isOverdue ? 'text-red-600' : 'text-yellow-600'
                                  }`}>
                                    {isOverdue
                                      ? `${Math.abs(daysUntil)} days overdue`
                                      : `Due in ${daysUntil} days`
                                    }
                                  </span>
                                </div>
                              )}
                              {task.notes && (
                                <div className="flex items-start gap-2 pt-2 border-t border-slate-200">
                                  <span className="text-sm font-semibold text-slate-700 min-w-[100px]">Notes:</span>
                                  <span className="text-sm text-slate-700">{task.notes}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  size="sm"
                  onClick={() => {
                    tasksNeedingAlerts.forEach(task => {
                      sendAlertMutation.mutate(task);
                    });
                  }}
                  disabled={sendAlertMutation.isPending}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Alerts to Vetting Team
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-sm text-slate-700">
                These compliance tasks are due within 60 days. Click the title above to view details or send email alerts to WestCoastVesselVetting@ptlmarine.com
              </p>
            </CardContent>
          </Card>
        )}

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="shadow-lg border-slate-200">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    {editingTask
                      ? 'Edit Task'
                      : formData.task_type === 'Drydock Schedule'
                        ? 'Add Vessel Down'
                        : 'Add Maintenance Task'
                    }
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="vessel_type">Vessel Type *</Label>
                        <Select
                          value={formData.vessel_type}
                          onValueChange={(value) => setFormData({ ...formData, vessel_type: value, vessel_id: '', vessel_name: '' })}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="barge">Barge</SelectItem>
                            <SelectItem value="tug">Tug</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vessel">Vessel *</Label>
                        <Select
                          value={formData.vessel_id}
                          onValueChange={handleVesselSelect}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select vessel" />
                          </SelectTrigger>
                          <SelectContent>
                            {(formData.vessel_type === 'barge' ? barges : tugs).map((vessel) => (
                              <SelectItem key={vessel.id} value={vessel.id}>
                                {vessel.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="task_type">Task Type *</Label>
                        <Select
                          value={formData.task_type}
                          onValueChange={(value) => setFormData({ ...formData, task_type: value, task_name: '' })}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USCG Compliance">USCG Compliance</SelectItem>
                            <SelectItem value="ABS Compliance">ABS Compliance</SelectItem>
                            <SelectItem value="SIRE Compliance">SIRE Compliance</SelectItem>
                            <SelectItem value="Drydock Schedule">Drydock Schedule</SelectItem>
                            <SelectItem value="Scheduled Maintenance">Scheduled Maintenance</SelectItem>
                            <SelectItem value="Internal Inspection">Internal Inspection</SelectItem>
                            <SelectItem value="Vessel Inspection">Vessel Inspection</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="task_name">Task Name *</Label>
                        {formData.task_type === 'USCG Compliance' ? (
                          <Select
                            value={formData.task_name}
                            onValueChange={(value) => setFormData({ ...formData, task_name: value })}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select task" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Cargo Tank Exam">Cargo Tank Exam</SelectItem>
                              <SelectItem value="Internal Exam">Internal Exam</SelectItem>
                              <SelectItem value="Annual COI Inspection">Annual COI Inspection</SelectItem>
                              <SelectItem value="COD Expiration Date">COD Expiration Date</SelectItem>
                              <SelectItem value="USCG Dry Dock Exam">USCG Dry Dock Exam</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : formData.task_type === 'ABS Compliance' ? (
                          <Select
                            value={formData.task_name}
                            onValueChange={(value) => setFormData({ ...formData, task_name: value })}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select task" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ABS Load Line">ABS Load Line</SelectItem>
                              <SelectItem value="ABS Class Inspection">ABS Class Inspection</SelectItem>
                              <SelectItem value="ABS Dry Dock Exam">ABS Dry Dock Exam</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : formData.task_type === 'SIRE Compliance' ? (
                          <Select
                            value={formData.task_name}
                            onValueChange={(value) => setFormData({ ...formData, task_name: value })}
                            required
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select task" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SIRE annual inspection">SIRE annual inspection</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id="task_name"
                            value={formData.task_name}
                            onChange={(e) => setFormData({ ...formData, task_name: e.target.value })}
                            placeholder="e.g., Annual drydock inspection"
                            required
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="due_date">Due Date *</Label>
                        <Input
                          id="due_date"
                          type="date"
                          value={formData.due_date}
                          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) => setFormData({ ...formData, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="upcoming">Upcoming</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.status === 'completed' && (
                        <div className="space-y-2">
                          <Label htmlFor="completion_date">Completion Date</Label>
                          <Input
                            id="completion_date"
                            type="date"
                            value={formData.completion_date}
                            onChange={(e) => setFormData({ ...formData, completion_date: e.target.value })}
                          />
                        </div>
                      )}
                    </div>

                    {formData.task_type === 'Drydock Schedule' && (
                      <>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="drydock_out_of_water_date">Out of Water Date</Label>
                            <Input
                              id="drydock_out_of_water_date"
                              type="date"
                              value={formData.drydock_out_of_water_date}
                              onChange={(e) => {
                                const newOutOfWaterDate = e.target.value;
                                const backDate = formData.estimated_downtime_days && newOutOfWaterDate
                                  ? calculateBackInServiceDate(newOutOfWaterDate, formData.estimated_downtime_days)
                                  : '';
                                setFormData({
                                  ...formData,
                                  drydock_out_of_water_date: newOutOfWaterDate,
                                  drydock_back_in_water_date: backDate
                                });
                              }}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="facility">Location</Label>
                            <Input
                              id="facility"
                              value={formData.facility_location}
                              onChange={(e) => setFormData({ ...formData, facility_location: e.target.value })}
                              placeholder="e.g., LONG BEACH"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="downtime">Estimated Downtime Days</Label>
                            <Input
                              id="downtime"
                              type="number"
                              value={formData.estimated_downtime_days}
                              onChange={(e) => {
                                const newDowntimeDays = e.target.value;
                                const backDate = formData.drydock_out_of_water_date && newDowntimeDays
                                  ? calculateBackInServiceDate(formData.drydock_out_of_water_date, newDowntimeDays)
                                  : '';
                                setFormData({
                                  ...formData,
                                  estimated_downtime_days: newDowntimeDays,
                                  drydock_back_in_water_date: backDate
                                });
                              }}
                              placeholder="e.g., 30"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="back_date">Estimated Back in Service Date</Label>
                            <Input
                              id="back_date"
                              type="date"
                              value={formData.drydock_back_in_water_date}
                              readOnly
                              className="bg-slate-50"
                            />
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="status_code">Status Code</Label>
                            <Select
                              value={formData.status_code}
                              onValueChange={(value) => setFormData({ ...formData, status_code: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="DRY DOCK">DRY DOCK</SelectItem>
                                <SelectItem value="REGULATORY">REGULATORY</SelectItem>
                                <SelectItem value="MECHANICAL">MECHANICAL</SelectItem>
                                <SelectItem value="OTHER">OTHER</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="current_condition">Current Condition</Label>
                            <Select
                              value={formData.current_condition}
                              onValueChange={(value) => setFormData({ ...formData, current_condition: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="EXTENDED OUTAGE">EXTENDED OUTAGE</SelectItem>
                                <SelectItem value="MODERATE REPAIR">MODERATE REPAIR</SelectItem>
                                <SelectItem value="IN SERVICE">IN SERVICE</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* AFE Tracking Section */}
                        <div className="border-t border-slate-200 pt-4 space-y-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="is_afe_item"
                              checked={formData.is_afe_item}
                              onChange={(e) => setFormData({ ...formData, is_afe_item: e.target.checked })}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <Label htmlFor="is_afe_item" className="text-base font-semibold cursor-pointer">
                              Will this be an AFE item?
                            </Label>
                          </div>

                          {formData.is_afe_item && (
                            <div className="bg-blue-50 p-4 rounded-lg space-y-4 border border-blue-200">
                              <h4 className="font-semibold text-slate-900">AFE Information</h4>
                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="afe_request_number">AFE Request #</Label>
                                  <Input
                                    id="afe_request_number"
                                    value={formData.afe_request_number}
                                    onChange={(e) => setFormData({ ...formData, afe_request_number: e.target.value })}
                                    placeholder="e.g., AFE-2025-001"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="afe_po_number">AFE PO #</Label>
                                  <Input
                                    id="afe_po_number"
                                    value={formData.afe_po_number}
                                    onChange={(e) => setFormData({ ...formData, afe_po_number: e.target.value })}
                                    placeholder="e.g., PO-12345"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="vendor_name">Vendor Name</Label>
                                  <Input
                                    id="vendor_name"
                                    value={formData.vendor_name}
                                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                                    placeholder="e.g., Marine Services Inc."
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="budgeted_amount">Budgeted Amount ($)</Label>
                                  <Input
                                    id="budgeted_amount"
                                    type="number"
                                    value={formData.budgeted_amount}
                                    onChange={(e) => setFormData({ ...formData, budgeted_amount: e.target.value })}
                                    placeholder="e.g., 50000"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="final_charge">Final Charge ($)</Label>
                                  <Input
                                    id="final_charge"
                                    type="number"
                                    value={formData.final_charge}
                                    onChange={(e) => setFormData({ ...formData, final_charge: e.target.value })}
                                    placeholder="e.g., 48500"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Additional notes..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="bg-gradient-to-r from-indigo-600 to-indigo-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {editingTask ? 'Update' : 'Add'} Task
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>



        <Tabs defaultValue="rm" className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-4">
            <TabsTrigger value="rm">R&M Tracker</TabsTrigger>
            <TabsTrigger value="down">Vessels Down</TabsTrigger>
            <TabsTrigger value="scheduled">Schedule Dry Dock</TabsTrigger>
            <TabsTrigger value="lost-revenue" className="flex items-center gap-1">
              <TrendingDown className="w-4 h-4" />
              Lost Revenue
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rm" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {Object.entries(tasksByType).map(([type, typeTasks]) => (
                <Card key={type} className="shadow-md border-slate-200">
                  <CardHeader className="border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Wrench className="w-5 h-5" />
                        {type}
                      </CardTitle>
                      <Badge className={`${taskTypeColors[type]} border`}>
                        {typeTasks.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    {typeTasks.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No tasks</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {typeTasks.map((task) => {
                          const daysUntil = isValidDate(task.due_date) ? differenceInDays(new Date(task.due_date), new Date()) : null;
                          return (
                            <div
                              key={task.id}
                              onClick={() => handleEdit(task)}
                              className="p-3 border border-slate-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h4 className="font-bold text-slate-900">{task.vessel_name}</h4>
                                  <p className="text-sm text-slate-600">{task.task_name}</p>
                                </div>
                                <Badge className={`${statusColors[task.calculatedStatus]} border text-xs`}>
                                  {task.calculatedStatus.replace('_', ' ')}
                                </Badge>
                              </div>
                              <div className="text-sm space-y-1">
                                {isValidDate(task.due_date) && (
                                  <div className="flex items-center gap-2 text-slate-700">
                                    <CalendarIcon className="w-4 h-4" />
                                    <span>Due: {format(parseISO(task.due_date), 'MMM d, yyyy')}</span>
                                    {task.calculatedStatus !== 'completed' && daysUntil !== null && (
                                      <span className={`font-semibold ${
                                        daysUntil < 0 ? 'text-red-600' :
                                          daysUntil <= 30 ? 'text-orange-600' :
                                            'text-slate-600'
                                      }`}>
                                        ({daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` : `${daysUntil} days`})
                                      </span>
                                    )}
                                  </div>
                                )}
                                {task.notes && (
                                  <p className="text-slate-600 text-xs pt-1 border-t border-slate-100">{task.notes}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {Object.keys(tasksByType).length === 0 && (
              <Card className="shadow-md border-slate-200">
                <CardContent className="p-12 text-center">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No R&M Tasks</h3>
                  <p className="text-slate-600">All vessels are in good working order</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="down" className="space-y-6">
            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Vessels Currently Down
                  </CardTitle>
                  <Button
                    onClick={handleAddDrydock}
                    className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Add Vessel Down
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {vesselsDown.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">All vessels operational</p>
                    <p className="text-sm mt-2">Click "Add Vessel Down" to schedule a drydock or maintenance</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {vesselsDown.map((task) => {
                      const daysDown = isValidDate(task.drydock_back_in_water_date)
                        ? calculateDaysToService(task.drydock_back_in_water_date)
                        : null;

                      return (
                        <div key={task.id} className="p-4 border-2 border-red-200 rounded-lg bg-red-50">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center shadow-md">
                                <Ship className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h3 className="font-bold text-lg text-slate-900">{task.vessel_name}</h3>
                                <p className="text-sm text-slate-600 capitalize">{task.vessel_type}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Badge className="bg-red-100 text-red-800 border-red-200">
                                DOWN
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(task)}
                                className="hover:bg-red-100 h-8 w-8"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-slate-700">Status Code:</span>
                              <Badge className="ml-2 bg-slate-100 text-slate-800 border-slate-200">
                                {task.status_code}
                              </Badge>
                            </div>
                            {task.facility_location && (
                              <div>
                                <span className="font-medium text-slate-700">Location:</span>
                                <span className="ml-2 text-slate-900">{task.facility_location}</span>
                              </div>
                            )}
                            {isValidDate(task.drydock_out_of_water_date) && (
                              <div>
                                <span className="font-medium text-slate-700">Out of Water:</span>
                                <span className="ml-2 text-slate-900">
                                  {format(parseISO(task.drydock_out_of_water_date), 'MMM d, yyyy')}
                                </span>
                              </div>
                            )}
                            {isValidDate(task.drydock_back_in_water_date) && (
                              <div>
                                <span className="font-medium text-slate-700">Expected Back:</span>
                                <span className="ml-2 text-slate-900">
                                  {format(parseISO(task.drydock_back_in_water_date), 'MMM d, yyyy')}
                                </span>
                                {daysDown !== null && (
                                  <span className="ml-2 text-red-600 font-semibold">
                                    ({daysDown} {daysDown === 1 ? 'day' : 'days'})
                                  </span>
                                )}
                              </div>
                            )}
                            {task.notes && (
                              <div className="pt-2 border-t border-red-200 text-slate-700">
                                {task.notes}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 mt-4">
                            <Button
                              size="sm"
                              onClick={() => markBackInServiceMutation.mutate({ id: task.id, task })}
                              disabled={markBackInServiceMutation.isPending}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark Back in Service
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Vessel Down Entry?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the entry for {task.vessel_name}. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(task.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recently Returned to Service Section */}
            {recentlyReturned.length > 0 && (
              <Card className="shadow-md border-emerald-200 bg-emerald-50">
                <CardHeader className="border-b border-emerald-100">
                  <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    Recently Returned to Service (Last 30 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    {recentlyReturned.map((task) => {
                      const daysDown = (isValidDate(task.drydock_out_of_water_date) && isValidDate(task.drydock_back_in_water_date))
                        ? differenceInDays(
                            new Date(task.drydock_back_in_water_date),
                            new Date(task.drydock_out_of_water_date)
                          )
                        : null;

                      const daysAgo = isValidDate(task.completion_date)
                        ? differenceInDays(new Date(), new Date(task.completion_date))
                        : null;

                      return (
                        <div key={task.id} className="p-4 border-2 border-emerald-200 rounded-lg bg-white">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-md">
                                <Ship className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h3 className="font-bold text-lg text-slate-900">{task.vessel_name}</h3>
                                <p className="text-sm text-slate-600 capitalize">{task.vessel_type}</p>
                              </div>
                            </div>
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                              BACK IN SERVICE
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-slate-700">Status Code:</span>
                              <Badge className="ml-2 bg-slate-100 text-slate-800 border-slate-200">
                                {task.status_code}
                              </Badge>
                            </div>
                            {task.facility_location && (
                              <div>
                                <span className="font-medium text-slate-700">Location:</span>
                                <span className="ml-2 text-slate-900">{task.facility_location}</span>
                              </div>
                            )}
                            {daysDown !== null && (
                              <div>
                                <span className="font-medium text-slate-700">Total Downtime:</span>
                                <span className="ml-2 text-slate-900 font-semibold">
                                  {daysDown} {daysDown === 1 ? 'day' : 'days'}
                                </span>
                              </div>
                            )}
                            {isValidDate(task.completion_date) && (
                              <div>
                                <span className="font-medium text-slate-700">Returned:</span>
                                <span className="ml-2 text-slate-900">
                                  {format(parseISO(task.completion_date), 'MMM d, yyyy')}
                                </span>
                                {daysAgo !== null && (
                                  <span className="ml-2 text-emerald-600 font-semibold">
                                    ({daysAgo} {daysAgo === 1 ? 'day' : 'days'} ago)
                                  </span>
                                )}
                              </div>
                            )}
                            {task.notes && (
                              <div className="pt-2 border-t border-emerald-200 text-slate-700">
                                {task.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-6">
            {/* Scheduled Dry Docks Section */}
            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-blue-600" />
                    Schedule Dry Dock
                  </CardTitle>
                  <Button
                    onClick={() => {
                      setFormData({
                        vessel_type: 'barge',
                        vessel_id: '',
                        vessel_name: '',
                        task_type: 'Drydock Schedule',
                        task_name: '',
                        status_code: 'DRY DOCK',
                        current_condition: 'MODERATE REPAIR',
                        due_date: '',
                        status: 'scheduled',
                        completion_date: '',
                        drydock_out_of_water_date: '',
                        drydock_back_in_water_date: '',
                        facility_location: '',
                        estimated_downtime_days: '',
                        notes: '',
                        is_afe_item: false,
                        afe_request_number: '',
                        afe_po_number: '',
                        vendor_name: '',
                        budgeted_amount: '',
                        final_charge: ''
                      });
                      setEditingTask(null);
                      setShowForm(true);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Schedule Dry Dock
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {tasks.filter(t => t.status === 'scheduled' && t.task_type === 'Drydock Schedule').length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No scheduled dry docks</p>
                    <p className="text-sm mt-2">Click "Schedule Dry Dock" to add planned dry dock dates</p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {tasks.filter(t => t.status === 'scheduled' && t.task_type === 'Drydock Schedule').map((task) => {
                      const daysUntil = isValidDate(task.due_date) ? differenceInDays(new Date(task.due_date), new Date()) : null;
                      
                      return (
                        <div key={task.id} className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                                <Ship className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <h3 className="font-bold text-lg text-slate-900">{task.vessel_name}</h3>
                                <p className="text-sm text-slate-600 capitalize">{task.vessel_type}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                                SCHEDULED
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(task)}
                                className="hover:bg-blue-100 h-8 w-8"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-slate-700">Task Type:</span>
                              <Badge className={`ml-2 ${taskTypeColors[task.task_type]} border`}>
                                {task.task_type}
                              </Badge>
                            </div>
                            {task.task_name && (
                              <div>
                                <span className="font-medium text-slate-700">Task:</span>
                                <span className="ml-2 text-slate-900">{task.task_name}</span>
                              </div>
                            )}
                            {isValidDate(task.due_date) && (
                              <div>
                                <span className="font-medium text-slate-700">Scheduled Date:</span>
                                <span className="ml-2 text-slate-900">
                                  {format(parseISO(task.due_date), 'MMM d, yyyy')}
                                </span>
                                {daysUntil !== null && (
                                  <span className="ml-2 text-blue-600 font-semibold">
                                    ({daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : `in ${daysUntil} days`})
                                  </span>
                                )}
                              </div>
                            )}
                            {task.facility_location && (
                              <div>
                                <span className="font-medium text-slate-700">Location:</span>
                                <span className="ml-2 text-slate-900">{task.facility_location}</span>
                              </div>
                            )}
                            {task.drydock_out_of_water_date && isValidDate(task.drydock_out_of_water_date) && (
                              <div>
                                <span className="font-medium text-slate-700">Expected Out of Water:</span>
                                <span className="ml-2 text-slate-900">
                                  {format(parseISO(task.drydock_out_of_water_date), 'MMM d, yyyy')}
                                </span>
                              </div>
                            )}
                            {task.drydock_back_in_water_date && isValidDate(task.drydock_back_in_water_date) && (
                              <div>
                                <span className="font-medium text-slate-700">Expected Back in Water:</span>
                                <span className="ml-2 text-slate-900">
                                  {format(parseISO(task.drydock_back_in_water_date), 'MMM d, yyyy')}
                                </span>
                              </div>
                            )}
                            {task.notes && (
                              <div className="pt-2 border-t border-blue-200 text-slate-700">
                                {task.notes}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 mt-4">
                            <Button
                              size="sm"
                              onClick={() => handleEdit(task)}
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                              <Edit2 className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove Scheduled Dry Dock?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the scheduled dry dock for {task.vessel_name}. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(task.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lost-revenue" className="space-y-6">
            <LostRevenueTracker />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}