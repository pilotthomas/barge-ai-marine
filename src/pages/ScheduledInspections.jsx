import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Ship, Edit2, CheckCircle, Calendar, FileText, Trash2, Plus, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO, differenceInDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const taskTypeColors = {
  "USCG Compliance": "bg-blue-100 text-blue-800 border-blue-200",
  "ABS Compliance": "bg-purple-100 text-purple-800 border-purple-200",
  "SIRE Compliance": "bg-orange-100 text-orange-800 border-orange-200",
  "Drydock Schedule": "bg-red-100 text-red-800 border-red-200",
  "Scheduled Maintenance": "bg-green-100 text-green-800 border-green-200",
  "Internal Inspection": "bg-teal-100 text-teal-800 border-teal-200",
  "Vessel Inspection": "bg-cyan-100 text-cyan-800 border-cyan-200"
};

export default function ScheduledInspections() {
  const [showCloseoutDialog, setShowCloseoutDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [closeoutTask, setCloseoutTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [formData, setFormData] = useState({
    new_expiration_date: '',
    inspection_pdf_url: ''
  });
  const [editFormData, setEditFormData] = useState({
    task_name: '',
    due_date: '',
    notes: ''
  });
  const [addFormData, setAddFormData] = useState({
    vessel_type: 'barge',
    vessel_id: '',
    vessel_name: '',
    task_type: 'USCG Inspection',
    task_name: '',
    due_date: '',
    notes: ''
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
  });

  const { data: tugs = [] } = useQuery({
    queryKey: ['tugs'],
    queryFn: () => base44.entities.Tug.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MaintenanceTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['barges'] });
      queryClient.invalidateQueries({ queryKey: ['tugs'] });
    },
  });

  const updateBargeMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Barge.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barges'] });
    },
  });

  const updateTugMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Tug.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tugs'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MaintenanceTask.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MaintenanceTask.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-tasks'] });
    },
  });

  const handleEdit = (task) => {
    setEditingTask(task);
    setEditFormData({
      task_name: task.task_name || '',
      due_date: task.due_date || '',
      notes: task.notes || ''
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    await updateMutation.mutateAsync({
      id: editingTask.id,
      data: {
        ...editingTask,
        ...editFormData
      }
    });
    setShowEditDialog(false);
    setEditingTask(null);
  };

  const handleDelete = (task) => {
    if (window.confirm(`Are you sure you want to delete the scheduled inspection for ${task.vessel_name}?`)) {
      deleteMutation.mutate(task.id);
    }
  };

  const handleVesselSelect = (vesselId) => {
    const vessel = addFormData.vessel_type === 'barge'
      ? barges.find(b => b.id === vesselId)
      : tugs.find(t => t.id === vesselId);

    setAddFormData({
      ...addFormData,
      vessel_id: vesselId,
      vessel_name: vessel?.name || ''
    });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    await createMutation.mutateAsync({
      ...addFormData,
      status: 'scheduled',
      status_code: 'REGULATORY',
      current_condition: 'IN SERVICE'
    });
    setShowAddDialog(false);
    setAddFormData({
      vessel_type: 'barge',
      vessel_id: '',
      vessel_name: '',
      task_type: 'USCG Inspection',
      task_name: '',
      due_date: '',
      notes: ''
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

  // Get scheduled inspection tasks for calendar
  const scheduledTasks = tasks.filter(t => {
    if (t.status !== 'scheduled') return false;
    if (t.task_type === 'Drydock Schedule') return false;
    return true;
  });

  // Get completed inspection tasks
  const completedTasks = tasks.filter(t => {
    if (t.status !== 'completed') return false;
    if (t.task_type === 'Drydock Schedule') return false;
    return true;
  }).sort((a, b) => {
    // Sort by completion date, newest first
    if (!a.completion_date || !b.completion_date) return 0;
    return new Date(b.completion_date) - new Date(a.completion_date);
  });

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Scheduled Inspections
            </h1>
            <p className="text-slate-600">Manage and close out scheduled vessel inspections</p>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Schedule Inspection
          </Button>
        </div>

        {/* Add Inspection Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Plus className="w-6 h-6 text-blue-600" />
                Schedule New Inspection
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddSubmit} className="space-y-4 mt-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vessel_type">Vessel Type *</Label>
                  <Select
                    value={addFormData.vessel_type}
                    onValueChange={(value) => setAddFormData({ ...addFormData, vessel_type: value, vessel_id: '', vessel_name: '' })}
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
                    value={addFormData.vessel_id}
                    onValueChange={handleVesselSelect}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vessel" />
                    </SelectTrigger>
                    <SelectContent>
                      {(addFormData.vessel_type === 'barge' ? barges : tugs).map((vessel) => (
                        <SelectItem key={vessel.id} value={vessel.id}>
                          {vessel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task_type">Inspection Type *</Label>
                  <Select
                    value={addFormData.task_type}
                    onValueChange={(value) => setAddFormData({ ...addFormData, task_type: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USCG Internal Exam">USCG Internal Exam</SelectItem>
                      <SelectItem value="USCG 5 Year Dry Dock Exam">USCG 5 Year Dry Dock Exam</SelectItem>
                      <SelectItem value="USCG Cargo Tank Exam">USCG Cargo Tank Exam</SelectItem>
                      <SelectItem value="ABS 2.5 Year Dry Dock Exam">ABS 2.5 Year Dry Dock Exam</SelectItem>
                      <SelectItem value="SIRE Expiration Date">SIRE Expiration Date</SelectItem>
                      <SelectItem value="ABS Load Line">ABS Load Line</SelectItem>
                      <SelectItem value="ABS Class">ABS Class</SelectItem>
                      <SelectItem value="USCG COI Expiration">USCG COI Expiration</SelectItem>
                      <SelectItem value="USCG COD Expiration">USCG COD Expiration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task_name">Task Name</Label>
                  <Input
                    id="task_name"
                    value={addFormData.task_name}
                    onChange={(e) => setAddFormData({...addFormData, task_name: e.target.value})}
                    placeholder="e.g., Additional details (optional)"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="add_due_date">Scheduled Date *</Label>
                  <Input
                    id="add_due_date"
                    type="date"
                    value={addFormData.due_date}
                    onChange={(e) => setAddFormData({...addFormData, due_date: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add_notes">Notes</Label>
                <Textarea
                  id="add_notes"
                  value={addFormData.notes}
                  onChange={(e) => setAddFormData({...addFormData, notes: e.target.value})}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddDialog(false);
                    setAddFormData({
                      vessel_type: 'barge',
                      vessel_id: '',
                      vessel_name: '',
                      task_type: 'Vessel Inspection',
                      task_name: '',
                      due_date: '',
                      notes: ''
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {createMutation.isPending ? 'Scheduling...' : 'Schedule Inspection'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <Edit2 className="w-6 h-6 text-blue-600" />
                Edit Scheduled Inspection
              </DialogTitle>
            </DialogHeader>
            {editingTask && (
              <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-4">
                  <div className="font-bold text-lg text-slate-900 mb-2">{editingTask.vessel_name}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600">
                    <div>Task Type: {editingTask.task_type}</div>
                    <div>Vessel Type: {editingTask.vessel_type}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task_name">Task Name *</Label>
                  <Input
                    id="task_name"
                    value={editFormData.task_name}
                    onChange={(e) => setEditFormData({...editFormData, task_name: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Scheduled Date *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={editFormData.due_date}
                    onChange={(e) => setEditFormData({...editFormData, due_date: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                    placeholder="Additional notes..."
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEditDialog(false);
                      setEditingTask(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="bg-gradient-to-r from-blue-600 to-blue-700"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Inspection Closeout Dialog */}
        <Dialog open={showCloseoutDialog} onOpenChange={setShowCloseoutDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
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
                
                // Update the vessel's compliance date field if new expiration provided
                if (formData.new_expiration_date && closeoutTask.vessel_type === 'barge') {
                  const vessel = barges.find(b => b.id === closeoutTask.vessel_id);
                  if (vessel) {
                    const updateData = { ...vessel };
                    
                    // Map inspection task type and name to barge field
                    const taskTypeLower = (closeoutTask.task_type || '').toLowerCase();
                    const taskNameLower = (closeoutTask.task_name || '').toLowerCase();
                    
                    // Check task type first, then task name
                    if (taskTypeLower.includes('sire') || taskNameLower.includes('sire')) {
                      updateData.sire_expiration = formData.new_expiration_date;
                    } else if (taskNameLower.includes('internal exam') || taskNameLower.includes('uscg internal')) {
                      updateData.uscg_internal_exam = formData.new_expiration_date;
                    } else if (taskNameLower.includes('5 year') || taskNameLower.includes('5-year')) {
                      updateData.uscg_5_year_drydock = formData.new_expiration_date;
                    } else if (taskNameLower.includes('cargo tank')) {
                      updateData.uscg_cargo_tank_exam = formData.new_expiration_date;
                    } else if (taskNameLower.includes('abs') && (taskNameLower.includes('2.5') || taskNameLower.includes('2-5'))) {
                      updateData.abs_2_5_year_drydock = formData.new_expiration_date;
                    } else if (taskNameLower.includes('load line')) {
                      updateData.abs_load_line = formData.new_expiration_date;
                    } else if (taskNameLower.includes('abs class')) {
                      updateData.abs_class = formData.new_expiration_date;
                    } else if (taskNameLower.includes('coi')) {
                      updateData.uscg_coi_expiration = formData.new_expiration_date;
                    } else if (taskNameLower.includes('cod')) {
                      updateData.uscg_cod_expiration = formData.new_expiration_date;
                    } else if (taskTypeLower.includes('uscg')) {
                      // Default USCG inspections to internal exam if not matched above
                      updateData.uscg_internal_exam = formData.new_expiration_date;
                    } else if (taskTypeLower.includes('abs')) {
                      // Default ABS inspections to 2.5 year if not matched above
                      updateData.abs_2_5_year_drydock = formData.new_expiration_date;
                    }
                    
                    await updateBargeMutation.mutateAsync({ id: vessel.id, data: updateData });
                  }
                }
                
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
                setFormData({ new_expiration_date: '', inspection_pdf_url: '' });
              }} className="space-y-6 mt-4">
                {/* Inspection Summary */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-lg text-slate-900 mb-2">{closeoutTask.vessel_name}</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600">
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
                      setFormData({ new_expiration_date: '', inspection_pdf_url: '' });
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

        {/* Scheduled Inspections Section */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Scheduled Inspections ({scheduledTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {scheduledTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No scheduled inspections</p>
                <p className="text-sm mt-2">Mark compliance items as "Scheduled for Inspection" to see them here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                          SCHEDULED
                        </Badge>
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

                      <div className="mt-4 space-y-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(task)}
                            className="flex-1"
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(task)}
                            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
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

        {/* Completed Inspections Section */}
        {completedTasks.length > 0 && (
          <Collapsible defaultOpen className="space-y-2">
            <Card className="shadow-md border-slate-200">
              <CollapsibleTrigger asChild>
                <CardHeader className="border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Completed Inspections ({completedTasks.length})
                    </CardTitle>
                    <ChevronDown className="w-5 h-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {completedTasks.map((task) => (
                      <div key={task.id} className="p-4 border-2 border-green-200 rounded-lg bg-green-50">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
                              <Ship className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-slate-900">{task.vessel_name}</h3>
                              <p className="text-sm text-slate-600 capitalize">{task.vessel_type}</p>
                            </div>
                          </div>
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            COMPLETED
                          </Badge>
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
                          {task.completion_date && (
                            <div>
                              <span className="font-medium text-slate-700">Completed:</span>
                              <span className="ml-2 text-green-700 font-semibold">
                                {format(parseISO(task.completion_date), 'MMM d, yyyy')}
                              </span>
                            </div>
                          )}
                          {task.new_expiration_date && (
                            <div>
                              <span className="font-medium text-slate-700">New Expiration:</span>
                              <span className="ml-2 text-slate-900">
                                {format(parseISO(task.new_expiration_date), 'MMM d, yyyy')}
                              </span>
                            </div>
                          )}
                          {task.inspection_pdf_url && (
                            <div className="pt-2 border-t border-green-200">
                              <a 
                                href={task.inspection_pdf_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700 underline flex items-center gap-1"
                              >
                                <FileText className="w-4 h-4" />
                                View Certificate
                              </a>
                            </div>
                          )}
                          {task.notes && (
                            <div className="pt-2 border-t border-green-200 text-slate-700">
                              {task.notes}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-col sm:flex-row gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(task)}
                            className="flex-1"
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(task)}
                            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
      </div>
    </div>
  );
}