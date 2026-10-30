import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, CheckCircle, Calendar as CalendarIcon, Ship, Edit2, ChevronLeft, ChevronRight, Upload, FileText } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isWithinInterval, addMonths, subMonths, isToday } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const taskTypeColors = {
  "USCG Compliance": "bg-blue-100 text-blue-800 border-blue-200",
  "ABS Compliance": "bg-purple-100 text-purple-800 border-purple-200",
  "SIRE Compliance": "bg-orange-100 text-orange-800 border-orange-200",
  "Drydock Schedule": "bg-red-100 text-red-800 border-red-200",
  "Scheduled Maintenance": "bg-green-100 text-green-800 border-green-200",
  "Internal Inspection": "bg-teal-100 text-teal-800 border-teal-200",
  "Vessel Inspection": "bg-cyan-100 text-cyan-800 border-cyan-200"
};

export default function ComplianceCalendar() {
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCalendarItem, setSelectedCalendarItem] = useState(null);
  const [showCalendarDetail, setShowCalendarDetail] = useState(false);
  const [showCloseoutDialog, setShowCloseoutDialog] = useState(false);
  const [closeoutTask, setCloseoutTask] = useState(null);
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [formData, setFormData] = useState({
    vessel_type: 'barge',
    vessel_id: '',
    vessel_name: '',
    task_type: 'USCG Compliance',
    task_name: '',
    status_code: 'REGULATORY',
    current_condition: 'IN SERVICE',
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
    final_charge: '',
    new_expiration_date: '',
    inspection_pdf_url: ''
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

  const resetForm = () => {
    setFormData({
      vessel_type: 'barge',
      vessel_id: '',
      vessel_name: '',
      task_type: 'USCG Compliance',
      task_name: '',
      status_code: 'REGULATORY',
      current_condition: 'IN SERVICE',
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
      final_charge: '',
      new_expiration_date: '',
      inspection_pdf_url: ''
    });
    setShowForm(false);
    setEditingTask(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const submitData = { ...formData };
    
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

  const isValidDate = (dateString) => {
    if (!dateString) return false;
    try {
      const date = new Date(dateString + 'T00:00:00.000Z');
      return date instanceof Date && !isNaN(date.getTime());
    } catch {
      return false;
    }
  };

  // Get compliance tasks that are expiring (not completed, within 60 days)
  const complianceTasks = tasks.filter(t => {
    if (t.status === 'completed') return false;
    if (!['USCG Compliance', 'ABS Compliance', 'SIRE Compliance'].includes(t.task_type)) return false;
    if (!t.due_date || !isValidDate(t.due_date)) return false;
    
    const daysUntil = differenceInDays(new Date(t.due_date), new Date());
    return daysUntil >= 0 && daysUntil <= 60;
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
    
    return complianceTasks.filter(task => {
      if (!task.due_date || !isValidDate(task.due_date)) return false;
      try {
        const taskDate = new Date(task.due_date + 'T00:00:00.000Z');
        return format(taskDate, 'yyyy-MM-dd') === dayStr;
      } catch {
        return false;
      }
    });
  };
  
  const getScheduledInspectionsForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return scheduledTasks.filter(task => {
      if (!task.due_date || !isValidDate(task.due_date)) return false;
      try {
        const taskDate = new Date(task.due_date + 'T00:00:00.000Z');
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

  const handleEditFromDetail = () => {
    if (selectedCalendarItem && selectedCalendarItem.id) {
      handleEdit(selectedCalendarItem);
      setShowCalendarDetail(false);
    }
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Compliance Calendar
            </h1>
            <p className="text-slate-600">Track compliance expiration dates, scheduled inspections, and maintenance</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Compliance Item
          </Button>
        </div>

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
                    {editingTask ? 'Edit Compliance Item' : 'Add Compliance Item'}
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
                        <Label htmlFor="task_type">Compliance Type *</Label>
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
                            placeholder="e.g., Annual inspection"
                            required
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="due_date">Expiration Date *</Label>
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
                            <SelectItem value="scheduled">Scheduled for Inspection</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

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
                        {editingTask ? 'Update' : 'Add'} Item
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inspection Closeout Dialog */}
        <Dialog open={showCloseoutDialog} onOpenChange={setShowCloseoutDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-600" />
                Close Out Inspection
              </DialogTitle>
            </DialogHeader>
            {closeoutTask && (
              <form onSubmit={async (e) => {
                e.preventDefault();
                
                // Update the current task to completed
                await updateMutation.mutateAsync({ 
                  id: closeoutTask.id, 
                  data: { 
                    ...closeoutTask,
                    status: 'completed',
                    completion_date: format(new Date(), 'yyyy-MM-dd'),
                    new_expiration_date: formData.new_expiration_date || null,
                    inspection_pdf_url: formData.inspection_pdf_url || null
                  } 
                });
                
                // If new expiration date provided, create a new compliance task
                if (formData.new_expiration_date) {
                  await createMutation.mutateAsync({
                    vessel_type: closeoutTask.vessel_type,
                    vessel_id: closeoutTask.vessel_id,
                    vessel_name: closeoutTask.vessel_name,
                    task_type: closeoutTask.task_type,
                    task_name: closeoutTask.task_name,
                    status_code: closeoutTask.status_code,
                    current_condition: 'IN SERVICE',
                    due_date: formData.new_expiration_date,
                    status: 'upcoming',
                    notes: `Created from inspection closed out on ${format(new Date(), 'MMM d, yyyy')}`
                  });
                }
                
                setShowCloseoutDialog(false);
                setCloseoutTask(null);
                setFormData({ ...formData, new_expiration_date: '', inspection_pdf_url: '' });
              }} className="space-y-6 mt-4">
                {/* Inspection Summary */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-lg text-slate-900 mb-2">{closeoutTask.vessel_name}</div>
                  <div className="grid md:grid-cols-2 gap-2 text-sm text-slate-600">
                    <div>Task Type: {closeoutTask.task_type}</div>
                    <div>Task: {closeoutTask.task_name}</div>
                    <div>Scheduled Date: {format(parseISO(closeoutTask.due_date), 'MMM d, yyyy')}</div>
                    <div>Vessel Type: {closeoutTask.vessel_type}</div>
                  </div>
                </div>

                {/* New Expiration Date */}
                <div className="space-y-2">
                  <Label htmlFor="new_expiration_date">New Expiration Date *</Label>
                  <Input
                    id="new_expiration_date"
                    type="date"
                    value={formData.new_expiration_date}
                    onChange={(e) => setFormData({...formData, new_expiration_date: e.target.value})}
                    placeholder="Enter new expiration/due date"
                    required
                  />
                  <p className="text-sm text-slate-500">This will be the next inspection due date</p>
                </div>

                {/* PDF Upload */}
                <div className="space-y-2">
                  <Label htmlFor="inspection_pdf">Upload Certificate/Inspection Document (PDF)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="inspection_pdf"
                      type="file"
                      accept=".pdf"
                      disabled={uploadingPDF}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadingPDF(true);
                          try {
                            const result = await base44.integrations.Core.UploadFile({ file });
                            setFormData({...formData, inspection_pdf_url: result.file_url});
                          } catch (error) {
                            alert('Failed to upload PDF. Please try again.');
                          } finally {
                            setUploadingPDF(false);
                          }
                        }
                      }}
                      className="flex-1"
                    />
                    {uploadingPDF && <div className="text-sm text-slate-500 flex items-center">Uploading...</div>}
                  </div>
                  {formData.inspection_pdf_url && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <FileText className="w-4 h-4" />
                      <span>PDF uploaded successfully</span>
                      <a href={formData.inspection_pdf_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                        View
                      </a>
                    </div>
                  )}
                  <p className="text-sm text-slate-500">Upload the certificate for compliance records</p>
                </div>

                {/* Completion Info */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">What happens when you close out:</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Inspection marked as completed on {format(new Date(), 'MMM d, yyyy')}</li>
                    <li>• New expiration date will be recorded</li>
                    <li>• Certificate will be stored for compliance records</li>
                    <li>• A new compliance item will be created with the new expiration date</li>
                  </ul>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCloseoutDialog(false);
                      setCloseoutTask(null);
                      setFormData({ ...formData, new_expiration_date: '', inspection_pdf_url: '' });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="bg-gradient-to-r from-green-600 to-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {updateMutation.isPending ? 'Closing Out...' : 'Complete Inspection'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Calendar Detail Dialog */}
        <Dialog open={showCalendarDetail} onOpenChange={setShowCalendarDetail}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <CalendarIcon className="w-6 h-6 text-blue-600" />
                Item Details
              </DialogTitle>
            </DialogHeader>
            {selectedCalendarItem && selectedCalendarItem.id && (
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
                  <Button onClick={handleEditFromDetail} className="bg-indigo-600 hover:bg-indigo-700">
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Expiring Compliance Section */}
        {complianceTasks.length > 0 && (
          <Card className="shadow-md border-yellow-200 bg-yellow-50">
            <CardHeader className="border-b border-yellow-100">
              <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                Expiring Soon (Next 60 Days)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 gap-4">
                {complianceTasks.map((task) => {
                  const daysUntil = isValidDate(task.due_date) ? differenceInDays(new Date(task.due_date), new Date()) : null;
                  const taskColor = task.task_type === 'USCG Compliance' 
                    ? 'border-blue-300 bg-blue-50'
                    : task.task_type === 'ABS Compliance'
                      ? 'border-purple-300 bg-purple-50'
                      : 'border-amber-300 bg-amber-50';
                  
                  return (
                    <div key={task.id} className={`p-4 border-2 rounded-lg ${taskColor}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center shadow-md">
                            <AlertTriangle className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-slate-900">{task.vessel_name}</h3>
                            <p className="text-sm text-slate-600 capitalize">{task.vessel_type}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(task)}
                          className="hover:bg-yellow-100 h-8 w-8"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium text-slate-700">Type:</span>
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
                            <span className="font-medium text-slate-700">Expiration:</span>
                            <span className="ml-2 text-slate-900">
                              {format(parseISO(task.due_date), 'MMM d, yyyy')}
                            </span>
                            {daysUntil !== null && (
                              <span className="ml-2 text-yellow-600 font-semibold">
                                ({daysUntil} days)
                              </span>
                            )}
                          </div>
                        )}
                        {task.notes && (
                          <div className="pt-2 border-t border-yellow-200 text-slate-700">
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

        {/* Scheduled Inspections Section */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              Scheduled Inspections
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {scheduledTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <CalendarIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No scheduled inspections</p>
                <p className="text-sm mt-2">Add compliance items with "Scheduled for Inspection" status</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {scheduledTasks.map((task) => {
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
                          <span className="font-medium text-slate-700">Type:</span>
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
                            <span className="font-medium text-slate-700">Scheduled:</span>
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
                        {task.notes && (
                          <div className="pt-2 border-t border-blue-200 text-slate-700">
                            {task.notes}
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        <Button
                          size="sm"
                          onClick={() => {
                            setCloseoutTask(task);
                            setShowCloseoutDialog(true);
                          }}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Close Out Inspection
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

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
            <div className="mb-4 flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-orange-100 border border-orange-200"></div>
                <span className="text-slate-600">Vessel Down</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-cyan-100 border border-cyan-200"></div>
                <span className="text-slate-600">Scheduled Inspection</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200"></div>
                <span className="text-slate-600">Expiring Soon</span>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center font-semibold text-sm text-slate-600 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
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
                      min-h-28 p-2 border rounded-lg transition-all duration-200
                      ${isCurrentMonth ? 'bg-white' : 'bg-slate-50'}
                      ${isTodayDate ? 'border-blue-500 border-2' : 'border-slate-200'}
                      ${allEvents.length > 0 ? 'shadow-sm' : ''}
                    `}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isCurrentMonth ? 'text-slate-900' : 'text-slate-400'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {/* Show drydocks */}
                      {dayDrydocks.slice(0, 1).map((task) => (
                        <div
                          key={task.id}
                          className="text-xs p-1 rounded bg-orange-100 text-orange-900 border border-orange-200 cursor-pointer hover:bg-orange-200 transition-colors"
                          onClick={() => handleCalendarItemClick(task)}
                        >
                          <Ship className="w-3 h-3 inline mr-1" />
                          {task.vessel_name}
                          <div className="text-xs text-orange-700 truncate">Drydock</div>
                        </div>
                      ))}
                      {/* Show compliance expiring */}
                      {dayCompliance.slice(0, 1).map((task, idx) => (
                        <div
                          key={`comp-${idx}`}
                          className="text-xs p-1 rounded bg-yellow-100 text-yellow-900 border border-yellow-200 cursor-pointer hover:bg-yellow-200 transition-colors"
                          onClick={() => handleCalendarItemClick(task)}
                        >
                          <AlertTriangle className="w-3 h-3 inline mr-1" />
                          {task.vessel_name}
                          <div className="text-xs truncate font-semibold text-yellow-700">{task.task_name}</div>
                        </div>
                      ))}
                      {/* Show scheduled inspections */}
                      {dayScheduled.slice(0, 1).map((task, idx) => (
                        <div
                          key={`sched-${idx}`}
                          className="text-xs p-1 rounded bg-cyan-100 text-cyan-900 border border-cyan-200 cursor-pointer hover:bg-cyan-200 transition-colors"
                          onClick={() => handleCalendarItemClick(task)}
                        >
                          <CalendarIcon className="w-3 h-3 inline mr-1" />
                          {task.vessel_name}
                          <div className="text-xs truncate text-cyan-700">
                            {task.task_name || 'Scheduled'}
                          </div>
                        </div>
                      ))}
                      {allEvents.length > 3 && (
                        <div className="text-xs text-slate-500 font-medium">
                          +{allEvents.length - 3} more
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