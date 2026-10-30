import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ship, Edit2, Save, Layers, Droplet, History, Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Clock, X, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Safe date formatting helper
const safeFormatDate = (dateString) => {
  if (!dateString) return null;
  try {
    const parsed = parseISO(dateString);
    if (isNaN(parsed.getTime())) return null;
    return format(parsed, 'MMM d, HH:mm');
  } catch (e) {
    console.error('Error formatting date:', dateString, e);
    return null;
  }
};

const safeFormatTime = (dateString) => {
  if (!dateString) return null;
  try {
    const parsed = parseISO(dateString);
    if (isNaN(parsed.getTime())) return null;
    return format(parsed, 'HH:mm');
  } catch (e) {
    console.error('Error formatting time:', dateString, e);
    return null;
  }
};

const tankColorStyles = {
  yellow: "bg-yellow-400 border-yellow-500",
  green: "bg-green-400 border-green-500",
  red: "bg-red-400 border-red-500",
  blue: "bg-blue-400 border-blue-500",
  none: "bg-slate-100 border-slate-300"
};

const productColorStyles = {
  'CARB Diesel': 'bg-red-100 text-red-900 border-red-300',
  'ULSD': 'bg-amber-100 text-amber-900 border-amber-300',
  'Marine Diesel': 'bg-amber-100 text-amber-900 border-amber-300',
  'Diesel': 'bg-amber-100 text-amber-900 border-amber-300',
  'RD99': 'bg-emerald-100 text-emerald-900 border-emerald-300',
  'MGO': 'bg-orange-100 text-orange-900 border-orange-300',
  'default': 'bg-blue-100 text-blue-900 border-blue-300'
};

const getProductColor = (productType) => {
  if (!productType) return productColorStyles.default;
  
  if (productColorStyles[productType]) {
    return productColorStyles[productType];
  }
  
  const lowerProduct = productType.toLowerCase();
  if (lowerProduct.includes('rd99') || lowerProduct === 'rd99') return productColorStyles['RD99'];
  if (lowerProduct.includes('carb')) return productColorStyles['CARB Diesel'];
  if (lowerProduct.includes('mgo')) return productColorStyles['MGO'];
  if (lowerProduct.includes('diesel')) return productColorStyles['Diesel'];

  return productColorStyles.default;
};

export default function Inventory() {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTank, setEditingTank] = useState(null);
  const [selectedBarge, setSelectedBarge] = useState("all");
  const [historySelectedBarge, setHistorySelectedBarge] = useState("all");
  const [historyMonth, setHistoryMonth] = useState(new Date());
  const [expandedCells, setExpandedCells] = useState({});
  const [editingHistoryRecord, setEditingHistoryRecord] = useState(null);
  const [historyEditFormData, setHistoryEditFormData] = useState({
    new_gallons: '',
    product_type: '',
    notes: '',
    snapshot_date: ''
  });
  const [editFormData, setEditFormData] = useState({
    current_gallons: '',
    product_type: '',
    notes: ''
  });
  const [showAddMissedReading, setShowAddMissedReading] = useState(false);
  const [missedReadingFormData, setMissedReadingFormData] = useState({
    barge_id: '',
    reading_date: '',
    tank_readings: [] // Will be populated when barge is selected
  });

  const queryClient = useQueryClient();

  const { data: tanks = [] } = useQuery({
    queryKey: ['barge-inventory'],
    queryFn: () => base44.entities.BargeInventory.list(),
  });

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  const { data: inventoryHistory = [] } = useQuery({
    queryKey: ['inventory-history'],
    queryFn: () => base44.entities.InventoryHistory.list('-snapshot_date', 1000),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const activeProducts = products.filter(p => p.is_active !== false);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, oldTank }) => {
      const updatedTank = await base44.entities.BargeInventory.update(id, {
        ...oldTank,
        current_gallons: data.current_gallons,
        product_type: data.product_type,
        last_updated: new Date().toISOString()
      });

      if (oldTank.current_gallons !== data.current_gallons || oldTank.product_type !== data.product_type) {
        const previousGallons = oldTank.current_gallons || 0;
        const newGallons = data.current_gallons || 0;
        
        await base44.entities.InventoryHistory.create({
          barge_id: oldTank.barge_id,
          barge_name: oldTank.barge_name,
          tank_number: oldTank.tank_number,
          tank_position: oldTank.tank_position,
          tank_color: oldTank.tank_color || 'none',
          product_type: data.product_type || '',
          previous_gallons: previousGallons,
          new_gallons: newGallons,
          change_gallons: newGallons - previousGallons,
          capacity_gallons: oldTank.capacity_gallons,
          snapshot_date: new Date().toISOString(),
          change_type: 'manual_update',
          notes: data.notes || ''
        });
      }

      return updatedTank;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barge-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
      setShowEditDialog(false);
      setEditingTank(null);
      setEditFormData({ current_gallons: '', product_type: '', notes: '' });
    },
  });

  const deleteHistoryMutation = useMutation({
    mutationFn: async (historyRecordId) => {
      return await base44.entities.InventoryHistory.delete(historyRecordId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barge-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
      setEditingHistoryRecord(null);
      alert('Reading deleted successfully');
    },
    onError: (error) => {
      console.error("Failed to delete history record:", error);
      alert('Failed to delete reading. Please try again.');
    }
  });

  const updateHistoryMutation = useMutation({
    mutationFn: async ({ historyRecord, newGallons, newProductType, newNotes, newDate }) => {
      let updatedHistoryItem;
      
      // Check if this is a new record (no ID) or existing record
      if (!historyRecord.id) {
        // This is a new record for an empty cell - create it
        // Find the previous reading for this tank
        const previousRecords = inventoryHistory
          .filter(h => 
            h.barge_id === historyRecord.barge_id && 
            h.tank_number === historyRecord.tank_number && 
            h.tank_position === historyRecord.tank_position &&
            parseISO(h.snapshot_date) < parseISO(newDate)
          )
          .sort((a, b) => parseISO(b.snapshot_date).getTime() - parseISO(a.snapshot_date).getTime());
        
        const previousGallons = previousRecords.length > 0 ? previousRecords[0].new_gallons : 0;
        
        updatedHistoryItem = await base44.entities.InventoryHistory.create({
          barge_id: historyRecord.barge_id,
          barge_name: historyRecord.barge_name,
          tank_number: historyRecord.tank_number,
          tank_position: historyRecord.tank_position,
          tank_color: historyRecord.tank_color || 'none',
          product_type: newProductType,
          previous_gallons: previousGallons,
          new_gallons: newGallons,
          change_gallons: newGallons - previousGallons,
          capacity_gallons: historyRecord.capacity_gallons,
          snapshot_date: newDate,
          change_type: 'manual_update',
          notes: newNotes || 'Added retroactively'
        });
      } else {
        // Update existing record
        updatedHistoryItem = await base44.entities.InventoryHistory.update(historyRecord.id, {
          new_gallons: newGallons,
          change_gallons: newGallons - (historyRecord.previous_gallons || 0),
          product_type: newProductType,
          notes: newNotes,
          snapshot_date: newDate
        });
      }

      // 2. Determine if this updated record is the LATEST for its tank
      // Sort existing history to find the actual latest for the tank
      const tankLatestRecord = inventoryHistory
        .filter(h => 
          h.barge_id === historyRecord.barge_id && 
          h.tank_number === historyRecord.tank_number && 
          h.tank_position === historyRecord.tank_position
        )
        .sort((a, b) => parseISO(b.snapshot_date).getTime() - parseISO(a.snapshot_date).getTime())[0];

      // If the record being edited is indeed the latest one for this tank (by ID)
      if (tankLatestRecord && tankLatestRecord.id === historyRecord.id) {
        const tankToUpdate = tanks.find(t => 
          t.barge_id === historyRecord.barge_id && 
          t.tank_number === historyRecord.tank_number && 
          t.tank_position === historyRecord.tank_position
        );
        
        if (tankToUpdate) {
          await base44.entities.BargeInventory.update(tankToUpdate.id, {
            current_gallons: newGallons,
            product_type: newProductType,
            last_updated: historyRecord.snapshot_date // Use original snapshot date for live tank last_updated
          });
        }
      }
      return updatedHistoryItem; // Return the updated history item
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['barge-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
      setEditingHistoryRecord(null);
      setHistoryEditFormData({ new_gallons: '', product_type: '', notes: '', snapshot_date: '' });
    },
    onError: (error) => {
        console.error("Failed to update history record:", error);
        // Optionally show a toast or error message
    }
  });

  const addMissedReadingMutation = useMutation({
    mutationFn: async ({ bargeId, readingDate, tankReadings }) => {
      const bargeTanks = tanks.filter(t => t.barge_id === bargeId);
      const results = [];
      const errors = [];
      
      // Process each tank reading
      for (const reading of tankReadings) {
        try {
          // Skip if no gallons entered or no product type
          if (reading.new_gallons === '' || reading.new_gallons === null || reading.new_gallons === undefined) {
            console.log(`Skipping tank ${reading.tank_number}${reading.tank_position} - no gallons entered`);
            continue;
          }
          if (!reading.product_type) {
            console.log(`Skipping tank ${reading.tank_number}${reading.tank_position} - no product type selected`);
            continue;
          }
          
          const tank = bargeTanks.find(t => t.id === reading.tank_id);
          if (!tank) {
            console.log(`Tank not found for reading:`, reading);
            continue;
          }
          
          // Find the previous reading for this tank before the missed date
          const previousRecords = inventoryHistory
            .filter(h => 
              h.barge_id === tank.barge_id && 
              h.tank_number === tank.tank_number && 
              h.tank_position === tank.tank_position &&
              parseISO(h.snapshot_date) < parseISO(readingDate)
            )
            .sort((a, b) => parseISO(b.snapshot_date).getTime() - parseISO(a.snapshot_date).getTime());
          
          const previousGallons = previousRecords.length > 0 ? previousRecords[0].new_gallons : 0;
          
          console.log(`Creating history record for tank ${tank.tank_number}${tank.tank_position}: ${reading.new_gallons} gallons of ${reading.product_type}`);
          
          // Create the history record with the specified date
          const historyRecord = await base44.entities.InventoryHistory.create({
            barge_id: tank.barge_id,
            barge_name: tank.barge_name,
            tank_number: tank.tank_number,
            tank_position: tank.tank_position,
            tank_color: tank.tank_color || 'none',
            product_type: reading.product_type,
            previous_gallons: previousGallons,
            new_gallons: parseFloat(reading.new_gallons),
            change_gallons: parseFloat(reading.new_gallons) - previousGallons,
            capacity_gallons: tank.capacity_gallons,
            snapshot_date: readingDate,
            change_type: 'manual_update',
            notes: reading.notes || 'Missed reading added retroactively'
          });

          // Check if this reading is the most recent for this tank by comparing dates
          // Find the most recent existing record (excluding the one we just created)
          const existingRecords = inventoryHistory
            .filter(h => 
              h.barge_id === tank.barge_id && 
              h.tank_number === tank.tank_number && 
              h.tank_position === tank.tank_position
            )
            .sort((a, b) => parseISO(b.snapshot_date).getTime() - parseISO(a.snapshot_date).getTime());
          
          const mostRecentExisting = existingRecords[0];
          
          // If this new reading is more recent than any existing reading, update the live tank
          if (!mostRecentExisting || parseISO(readingDate) >= parseISO(mostRecentExisting.snapshot_date)) {
            console.log(`Updating live tank ${tank.tank_number}${tank.tank_position} to ${reading.new_gallons} gallons`);
            await base44.entities.BargeInventory.update(tank.id, {
              current_gallons: parseFloat(reading.new_gallons),
              product_type: reading.product_type,
              last_updated: readingDate
            });
          }

          results.push(historyRecord);
        } catch (error) {
          console.error(`Error processing tank ${reading.tank_number}${reading.tank_position}:`, error);
          errors.push({ tank: `${reading.tank_number}${reading.tank_position}`, error: error.message });
        }
      }

      if (errors.length > 0) {
        console.error('Errors occurred while adding missed readings:', errors);
      }

      return { results, errors };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['barge-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
      
      if (data.errors && data.errors.length > 0) {
        console.error('Some tanks failed to update:', data.errors);
        alert(`Added ${data.results.length} readings, but ${data.errors.length} failed. Check console for details.`);
      }
      
      setShowAddMissedReading(false);
      setMissedReadingFormData({
        barge_id: '',
        reading_date: '',
        tank_readings: []
      });
    },
  });

  // Define helper function BEFORE using it
  const getTanksForBarge = (bargeId) => {
    return tanks.filter(t => t.barge_id === bargeId);
  };

  const handleEdit = (tank) => {
    setEditingTank(tank);
    setEditFormData({
      current_gallons: tank.current_gallons || 0,
      product_type: tank.product_type || '',
      notes: ''
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    
    const submitData = {
      current_gallons: parseFloat(editFormData.current_gallons) || 0,
      product_type: editFormData.product_type,
      notes: editFormData.notes
    };
    
    updateMutation.mutate({ 
      id: editingTank.id, 
      data: submitData,
      oldTank: editingTank
    });
  };

  const handleEditHistoryRecord = (record) => {
    setEditingHistoryRecord(record);
    const dateOnly = record.snapshot_date ? record.snapshot_date.split('T')[0] : '';
    setHistoryEditFormData({
      new_gallons: record.new_gallons !== null && record.new_gallons !== undefined ? record.new_gallons : 0,
      product_type: record.product_type || '',
      notes: record.notes || '',
      snapshot_date: dateOnly
    });
  };

  const handleHistoryEditSubmit = (e) => {
    e.preventDefault();
    
    // Combine date with current time or use original time
    let finalDate;
    if (historyEditFormData.snapshot_date) {
      // If date changed, use the new date but keep the original time
      const originalTime = editingHistoryRecord.snapshot_date ? editingHistoryRecord.snapshot_date.split('T')[1] : '12:00:00.000Z';
      finalDate = `${historyEditFormData.snapshot_date}T${originalTime}`;
    } else {
      // Use original date
      finalDate = editingHistoryRecord.snapshot_date;
    }
    
    updateHistoryMutation.mutate({
      historyRecord: editingHistoryRecord,
      newGallons: parseFloat(historyEditFormData.new_gallons) || 0,
      newProductType: historyEditFormData.product_type,
      newNotes: historyEditFormData.notes,
      newDate: finalDate
    });
  };

  const filteredTanks = selectedBarge === "all" 
    ? tanks 
    : tanks.filter(t => t.barge_id === selectedBarge);

  // Group tanks by barge
  const tanksByBarge = filteredTanks.reduce((acc, tank) => {
    if (!acc[tank.barge_name]) {
      acc[tank.barge_name] = [];
    }
    acc[tank.barge_name].push(tank);
    return acc;
  }, {});

  // Get tanks for the selected barge in history view
  const historyBargeTanks = historySelectedBarge === "all"
    ? []
    : getTanksForBarge(historySelectedBarge).sort((a, b) => {
        if (a.tank_number !== b.tank_number) return a.tank_number - b.tank_number;
        return a.tank_position === 'port' ? -1 : 1;
      });

  // Get days in the selected month
  const monthStart = startOfMonth(historyMonth);
  const monthEnd = endOfMonth(historyMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Filter history for selected barge and month
  const filteredHistory = inventoryHistory.filter(h => {
    if (historySelectedBarge !== "all" && h.barge_id !== historySelectedBarge) return false;
    
    const recordDate = parseISO(h.snapshot_date);
    return recordDate >= monthStart && recordDate <= monthEnd;
  });

  // Group history by date and tank - KEEP ALL RECORDS
  const historyByDateAndTank = {};
  filteredHistory.forEach(record => {
    const dateKey = format(parseISO(record.snapshot_date), 'yyyy-MM-dd');
    const tankKey = `${record.tank_number}-${record.tank_position}`;
    
    if (!historyByDateAndTank[dateKey]) {
      historyByDateAndTank[dateKey] = {};
    }
    
    if (!historyByDateAndTank[dateKey][tankKey]) {
      historyByDateAndTank[dateKey][tankKey] = [];
    }
    
    historyByDateAndTank[dateKey][tankKey].push(record);
  });

  // Sort records within each cell by timestamp (most recent first)
  Object.keys(historyByDateAndTank).forEach(dateKey => {
    Object.keys(historyByDateAndTank[dateKey]).forEach(tankKey => {
      historyByDateAndTank[dateKey][tankKey].sort((a, b) => 
        parseISO(b.snapshot_date).getTime() - parseISO(a.snapshot_date).getTime()
      );
    });
  });

  const handlePreviousMonth = () => {
    setHistoryMonth(subMonths(historyMonth, 1));
  };

  const handleNextMonth = () => {
    setHistoryMonth(addMonths(historyMonth, 1));
  };

  const toggleCellExpanded = (dateKey, tankKey) => {
    const cellKey = `${dateKey}-${tankKey}`;
    setExpandedCells(prev => ({
      ...prev,
      [cellKey]: !prev[cellKey]
    }));
  };

  const handleAddMissedReadingSubmit = (e) => {
    e.preventDefault();
    
    if (!missedReadingFormData.barge_id || !missedReadingFormData.reading_date) return;

    // Validate: Check if any tank has gallons but no product type
    const tanksWithGallonsButNoProduct = missedReadingFormData.tank_readings.filter(reading => 
      (reading.new_gallons !== '' && reading.new_gallons !== null && reading.new_gallons !== undefined) && 
      !reading.product_type
    );

    if (tanksWithGallonsButNoProduct.length > 0) {
      const tankNames = tanksWithGallonsButNoProduct
        .map(r => `Tank ${r.tank_number}${r.tank_position === 'port' ? 'Port' : 'Star'}`)
        .join(', ');
      alert(`Please select a product type for: ${tankNames}`);
      return;
    }

    // Combine date with a default time (noon)
    const fullDateTime = `${missedReadingFormData.reading_date}T12:00:00.000Z`;
    
    addMissedReadingMutation.mutate({
      bargeId: missedReadingFormData.barge_id,
      readingDate: fullDateTime,
      tankReadings: missedReadingFormData.tank_readings
    });
  };

  const handleBargeSelectForMissedReading = (bargeId) => {
    const bargeTanks = tanks.filter(t => t.barge_id === bargeId).sort((a, b) => {
      if (a.tank_number !== b.tank_number) return a.tank_number - b.tank_number;
      return a.tank_position === 'port' ? -1 : 1;
    });
    
    // If a date is selected, try to populate with previous day's readings
    let initialReadings = bargeTanks.map(tank => ({
      tank_id: tank.id,
      tank_number: tank.tank_number,
      tank_position: tank.tank_position,
      tank_color: tank.tank_color,
      new_gallons: '',
      product_type: '',
      notes: '',
      hasMissedReading: false
    }));

    if (missedReadingFormData.reading_date) {
      const selectedDate = parseISO(missedReadingFormData.reading_date);
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // For each tank, find the most recent reading before the selected date
      // AND check if there's a reading on the selected date
      initialReadings = bargeTanks.map(tank => {
        // Check if this tank has a reading on the selected date
        const hasReadingOnDate = inventoryHistory.some(h => 
          h.barge_id === bargeId && 
          h.tank_number === tank.tank_number && 
          h.tank_position === tank.tank_position &&
          format(parseISO(h.snapshot_date), 'yyyy-MM-dd') === selectedDateStr
        );

        const previousRecords = inventoryHistory
          .filter(h => 
            h.barge_id === bargeId && 
            h.tank_number === tank.tank_number && 
            h.tank_position === tank.tank_position &&
            parseISO(h.snapshot_date) < selectedDate
          )
          .sort((a, b) => parseISO(b.snapshot_date).getTime() - parseISO(a.snapshot_date).getTime());
        
        const previousReading = previousRecords[0];
        
        return {
          tank_id: tank.id,
          tank_number: tank.tank_number,
          tank_position: tank.tank_position,
          tank_color: tank.tank_color,
          new_gallons: previousReading ? previousReading.new_gallons : '',
          product_type: previousReading ? previousReading.product_type : '',
          notes: '',
          hasMissedReading: !hasReadingOnDate
        };
      });
    }
    
    setMissedReadingFormData({
      barge_id: bargeId,
      reading_date: missedReadingFormData.reading_date,
      tank_readings: initialReadings
    });
  };

  const handleDateChangeForMissedReading = (date) => {
    setMissedReadingFormData({
      ...missedReadingFormData,
      reading_date: date
    });

    // If barge is already selected, refresh readings with previous day's data
    if (missedReadingFormData.barge_id && date) {
      const bargeTanks = tanks.filter(t => t.barge_id === missedReadingFormData.barge_id).sort((a, b) => {
        if (a.tank_number !== b.tank_number) return a.tank_number - b.tank_number;
        return a.tank_position === 'port' ? -1 : 1;
      });

      const selectedDate = parseISO(date);
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const updatedReadings = bargeTanks.map(tank => {
        // Check if this tank has a reading on the selected date
        const hasReadingOnDate = inventoryHistory.some(h => 
          h.barge_id === missedReadingFormData.barge_id && 
          h.tank_number === tank.tank_number && 
          h.tank_position === tank.tank_position &&
          format(parseISO(h.snapshot_date), 'yyyy-MM-dd') === selectedDateStr
        );

        const previousRecords = inventoryHistory
          .filter(h => 
            h.barge_id === missedReadingFormData.barge_id && 
            h.tank_number === tank.tank_number && 
            h.tank_position === tank.tank_position &&
            parseISO(h.snapshot_date) < selectedDate
          )
          .sort((a, b) => parseISO(b.snapshot_date).getTime() - parseISO(a.snapshot_date).getTime());
        
        const previousReading = previousRecords[0];
        
        return {
          tank_id: tank.id,
          tank_number: tank.tank_number,
          tank_position: tank.tank_position,
          tank_color: tank.tank_color,
          new_gallons: previousReading ? previousReading.new_gallons : '',
          product_type: previousReading ? previousReading.product_type : '',
          notes: '',
          hasMissedReading: !hasReadingOnDate
        };
      });

      setMissedReadingFormData({
        ...missedReadingFormData,
        reading_date: date,
        tank_readings: updatedReadings
      });
    }
  };

  const updateTankReading = (index, field, value) => {
    const newReadings = [...missedReadingFormData.tank_readings];
    newReadings[index][field] = value;
    setMissedReadingFormData({
      ...missedReadingFormData,
      tank_readings: newReadings
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
              Tank Levels
            </h1>
            <p className="text-sm md:text-base text-slate-600">Daily tank readings and inventory tracking</p>
          </div>
        </div>

        {/* Quick Update Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900">
                Update Tank Reading
              </DialogTitle>
            </DialogHeader>
            {editingTank && (
              <div className="space-y-4 mt-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {editingTank.tank_color && editingTank.tank_color !== 'none' && (
                      <div className={`w-5 h-5 rounded-full border-2 ${tankColorStyles[editingTank.tank_color]}`} />
                    )}
                    <span className="font-bold text-slate-900">
                      {editingTank.barge_name} - Tank {editingTank.tank_number}{editingTank.tank_position === 'port' ? 'Port' : 'Star'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">
                    <div>Current: {editingTank.current_gallons?.toLocaleString() || 0} gallons</div>
                    <div>Capacity: {editingTank.capacity_gallons?.toLocaleString()} gallons</div>
                    {editingTank.product_type && (
                      <div>Product: {editingTank.product_type}</div>
                    )}
                  </div>
                </div>

                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new_gallons">New Reading (Gallons) *</Label>
                    <Input
                      id="new_gallons"
                      type="number"
                      value={editFormData.current_gallons}
                      onChange={(e) => setEditFormData({...editFormData, current_gallons: e.target.value})}
                      placeholder="Enter tank reading"
                      required
                      autoFocus
                    />
                    {editFormData.current_gallons && editingTank.current_gallons !== parseFloat(editFormData.current_gallons) && (
                      <p className="text-sm text-slate-600">
                        Change: {editFormData.current_gallons > editingTank.current_gallons ? '+' : ''}
                        {(parseFloat(editFormData.current_gallons) - editingTank.current_gallons).toLocaleString()} gallons
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product_type">Product Type *</Label>
                    <Select
                      value={editFormData.product_type}
                      onValueChange={(value) => setEditFormData({...editFormData, product_type: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeProducts.map((product) => (
                          <SelectItem key={product.id} value={product.name}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                      placeholder="Any notes about this reading..."
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="bg-gradient-to-r from-emerald-600 to-emerald-700"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateMutation.isPending ? 'Saving...' : 'Save Reading'}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit History Record Dialog */}
        <Dialog open={!!editingHistoryRecord} onOpenChange={(open) => !open && setEditingHistoryRecord(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900">
                Edit Historical Reading
              </DialogTitle>
            </DialogHeader>
            {editingHistoryRecord && (
              <div className="space-y-4 mt-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="font-bold text-slate-900">
                      {editingHistoryRecord.barge_name} - Tank {editingHistoryRecord.tank_number}{editingHistoryRecord.tank_position === 'port' ? 'Port' : 'Star'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">
                    <div>Recorded: {safeFormatDate(editingHistoryRecord.snapshot_date)}</div>
                    <div>Original: {editingHistoryRecord.new_gallons !== null && editingHistoryRecord.new_gallons !== undefined 
                      ? editingHistoryRecord.new_gallons.toLocaleString() 
                      : '0'} gallons</div>
                  </div>
                </div>

                <form onSubmit={handleHistoryEditSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="history_date">Reading Date *</Label>
                    <Input
                      id="history_date"
                      type="date"
                      value={historyEditFormData.snapshot_date}
                      onChange={(e) => setHistoryEditFormData({...historyEditFormData, snapshot_date: e.target.value})}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="history_gallons">Corrected Reading (Gallons) *</Label>
                    <Input
                      id="history_gallons"
                      type="number"
                      value={historyEditFormData.new_gallons}
                      onChange={(e) => setHistoryEditFormData({...historyEditFormData, new_gallons: e.target.value})}
                      placeholder="Enter corrected reading"
                      required
                      autoFocus
                    />
                    {historyEditFormData.new_gallons && editingHistoryRecord.new_gallons !== parseFloat(historyEditFormData.new_gallons) && (
                      <p className="text-sm text-amber-700">
                        Correction: {historyEditFormData.new_gallons > editingHistoryRecord.new_gallons ? '+' : ''}
                        {(parseFloat(historyEditFormData.new_gallons) - editingHistoryRecord.new_gallons).toLocaleString()} gallons
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="history_product_type">Product Type *</Label>
                    <Select
                      value={historyEditFormData.product_type}
                      onValueChange={(value) => setHistoryEditFormData({...historyEditFormData, product_type: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeProducts.map((product) => (
                          <SelectItem key={product.id} value={product.name}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="history_notes">Notes (Optional)</Label>
                    <Textarea
                      id="history_notes"
                      value={historyEditFormData.notes}
                      onChange={(e) => setHistoryEditFormData({...historyEditFormData, notes: e.target.value})}
                      placeholder="Any notes about this reading..."
                      rows={3}
                    />
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                    <p className="font-semibold mb-1">Note:</p>
                    <p>If this is the most recent reading for this tank, the current tank level will also be updated.</p>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button 
                      type="button" 
                      variant="destructive"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this reading? This action cannot be undone.')) {
                          if (editingHistoryRecord.id) {
                            deleteHistoryMutation.mutate(editingHistoryRecord.id);
                          } else {
                            setEditingHistoryRecord(null);
                          }
                        }
                      }}
                      disabled={deleteHistoryMutation.isPending}
                    >
                      <X className="w-4 h-4 mr-2" />
                      {deleteHistoryMutation.isPending ? 'Deleting...' : 'Delete Reading'}
                    </Button>
                    <div className="flex gap-3">
                      <Button type="button" variant="outline" onClick={() => setEditingHistoryRecord(null)}>
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={updateHistoryMutation.isPending}
                        className="bg-gradient-to-r from-amber-600 to-amber-700"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {updateHistoryMutation.isPending ? 'Saving...' : 'Save Correction'}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Missed Reading Dialog */}
        <Dialog open={showAddMissedReading} onOpenChange={setShowAddMissedReading}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900">
                Add Missed Readings
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <p>Enter tank readings for all tanks on the missed date. Leave empty for tanks that weren't read.</p>
              </div>

              <form onSubmit={handleAddMissedReadingSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="missed_barge">Barge *</Label>
                    <Select
                      value={missedReadingFormData.barge_id}
                      onValueChange={handleBargeSelectForMissedReading}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select barge" />
                      </SelectTrigger>
                      <SelectContent>
                        {barges.map((barge) => (
                          <SelectItem key={barge.id} value={barge.id}>
                            {barge.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="missed_date">Reading Date *</Label>
                    <Input
                      id="missed_date"
                      type="date"
                      value={missedReadingFormData.reading_date}
                      onChange={(e) => handleDateChangeForMissedReading(e.target.value)}
                      required
                    />
                    {missedReadingFormData.barge_id && missedReadingFormData.reading_date && (
                      <p className="text-xs text-blue-600">
                        ℹ️ Form auto-filled with previous day's readings. Adjust as needed or submit as-is if no changes.
                      </p>
                    )}
                  </div>
                </div>

                {missedReadingFormData.tank_readings.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-200">
                    <h3 className="font-semibold text-slate-900">Tank Readings</h3>
                    <div className="grid gap-3">
                      {missedReadingFormData.tank_readings.map((reading, index) => (
                        <div 
                          key={reading.tank_id} 
                          className={`p-4 rounded-lg border-2 ${
                            reading.hasMissedReading 
                              ? 'bg-amber-50 border-amber-400 shadow-md' 
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            {reading.tank_color && reading.tank_color !== 'none' && (
                              <div className={`w-5 h-5 rounded-full border-2 ${tankColorStyles[reading.tank_color]}`} />
                            )}
                            <span className="font-bold text-slate-900">
                              Tank {reading.tank_number}{reading.tank_position === 'port' ? 'Port' : 'Star'}
                            </span>
                            {reading.hasMissedReading && (
                              <Badge className="bg-amber-600 text-white border-amber-700 text-xs">
                                Missing Reading
                              </Badge>
                            )}
                          </div>
                          <div className="grid md:grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor={`tank_${index}_gallons`}>Gallons</Label>
                              <Input
                                id={`tank_${index}_gallons`}
                                type="number"
                                value={reading.new_gallons}
                                onChange={(e) => updateTankReading(index, 'new_gallons', e.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`tank_${index}_product`}>Product</Label>
                              <Select
                                value={reading.product_type}
                                onValueChange={(value) => updateTankReading(index, 'product_type', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {activeProducts.map((product) => (
                                    <SelectItem key={product.id} value={product.name}>
                                      {product.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`tank_${index}_notes`}>Notes</Label>
                              <Input
                                id={`tank_${index}_notes`}
                                value={reading.notes}
                                onChange={(e) => updateTankReading(index, 'notes', e.target.value)}
                                placeholder="Optional"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <Button type="button" variant="outline" onClick={() => setShowAddMissedReading(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={addMissedReadingMutation.isPending || !missedReadingFormData.barge_id}
                    className="bg-gradient-to-r from-blue-600 to-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {addMissedReadingMutation.isPending ? 'Saving...' : 'Add Readings'}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="live" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="live" className="flex items-center gap-2">
              <Droplet className="w-4 h-4" />
              Live View
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-6">
            <div className="flex gap-3">
              <Select value={selectedBarge} onValueChange={setSelectedBarge}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barges</SelectItem>
                  {barges.map((barge) => (
                    <SelectItem key={barge.id} value={barge.id}>
                      {barge.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {Object.keys(tanksByBarge).map((bargeName) => {
              const bargeTanks = tanksByBarge[bargeName];
              
              const uniqueTankNumbers = [...new Set(bargeTanks.map(t => t.tank_number))];
              
              const totalCapacity = bargeTanks.reduce((sum, tank) => {
                const isFirstOccurrence = !bargeTanks.slice(0, bargeTanks.indexOf(tank))
                  .some(t => t.tank_number === tank.tank_number && t.tank_position === tank.tank_position);
                
                if (isFirstOccurrence) {
                  return sum + (tank.capacity_gallons || 0);
                }
                return sum;
              }, 0);
              
              const maxSafeCapacity = Math.round(totalCapacity * 0.9);
              const totalCurrent = bargeTanks.reduce((sum, t) => sum + (t.current_gallons || 0), 0);
              const fillPercentage = maxSafeCapacity > 0 ? Math.round((totalCurrent / maxSafeCapacity) * 100) : 0;

              const tankNumbers = uniqueTankNumbers.sort((a, b) => a - b);

              return (
                <Card key={bargeName} className="shadow-md border-slate-200">
                  <CardHeader className="border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
                          <Ship className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-slate-900">{bargeName}</CardTitle>
                          <p className="text-sm text-slate-600">
                            {totalCurrent.toLocaleString()} / {maxSafeCapacity.toLocaleString()} gallons ({fillPercentage}% full)
                          </p>
                          <p className="text-xs text-slate-500">
                            Max safe capacity (90% of {totalCapacity.toLocaleString()} gal total) • {tankNumbers.length} tanks
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Port row (top) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        {tankNumbers.map((tankNum) => {
                          const tank = bargeTanks.find(t => t.tank_number === tankNum && t.tank_position === 'port');
                          if (!tank) return <div key={`${tankNum}-port-empty`} />;
                          
                          const tankMaxSafeCapacity = Math.round((tank.capacity_gallons || 0) * 0.9);
                          const tankFillPercentage = tankMaxSafeCapacity > 0 
                            ? Math.round((tank.current_gallons / tankMaxSafeCapacity) * 100) 
                            : 0;
                          
                          const tankDisplayName = `${tank.tank_number}Port`;
                          const formattedDate = safeFormatDate(tank.last_updated);
                          
                          return (
                            <Card key={tank.id} className="border-slate-200 hover:shadow-md transition-shadow duration-200">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center gap-2">
                                    {tank.tank_color && tank.tank_color !== 'none' && (
                                      <div className={`w-6 h-6 rounded-full border-2 ${tankColorStyles[tank.tank_color]} shadow-sm`} />
                                    )}
                                    <div>
                                      <h4 className="font-bold text-lg text-slate-900">{tankDisplayName}</h4>
                                      {formattedDate && (
                                        <p className="text-xs text-slate-500">{formattedDate}</p>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(tank)}
                                    className="h-8 w-8"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Droplet className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-medium text-slate-900">
                                      {tank.current_gallons?.toLocaleString() || 0} gal
                                    </span>
                                  </div>
                                  
                                  <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full transition-all duration-300 ${
                                        tankFillPercentage > 80 ? 'bg-emerald-500' :
                                        tankFillPercentage > 50 ? 'bg-blue-500' :
                                        tankFillPercentage > 20 ? 'bg-yellow-500' :
                                        'bg-red-500'
                                      }`}
                                      style={{ width: `${Math.min(tankFillPercentage, 100)}%` }}
                                    />
                                  </div>
                                  
                                  <p className="text-xs text-slate-500">
                                    {tankFillPercentage}% of {tankMaxSafeCapacity.toLocaleString()} gal (max safe)
                                  </p>
                                  
                                  {tank.product_type && (
                                    <div className="pt-2 border-t border-slate-100">
                                      <Badge className={`${getProductColor(tank.product_type)} border text-xs font-semibold`}>
                                        {tank.product_type}
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  {tank.notes && (
                                    <div className="pt-2">
                                      <p className="text-xs text-slate-600">{tank.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>

                      {/* Starboard row (bottom) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        {tankNumbers.map((tankNum) => {
                          const tank = bargeTanks.find(t => t.tank_number === tankNum && t.tank_position === 'starboard');
                          if (!tank) return <div key={`${tankNum}-star-empty`} />;
                          
                          const tankMaxSafeCapacity = Math.round((tank.capacity_gallons || 0) * 0.9);
                          const tankFillPercentage = tankMaxSafeCapacity > 0 
                            ? Math.round((tank.current_gallons / tankMaxSafeCapacity) * 100) 
                            : 0;
                          
                          const tankDisplayName = `${tank.tank_number}Star`;
                          const formattedDate = safeFormatDate(tank.last_updated);
                          
                          return (
                            <Card key={tank.id} className="border-slate-200 hover:shadow-md transition-shadow duration-200">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center gap-2">
                                    {tank.tank_color && tank.tank_color !== 'none' && (
                                      <div className={`w-6 h-6 rounded-full border-2 ${tankColorStyles[tank.tank_color]} shadow-sm`} />
                                    )}
                                    <div>
                                      <h4 className="font-bold text-lg text-slate-900">{tankDisplayName}</h4>
                                      {formattedDate && (
                                        <p className="text-xs text-slate-500">{formattedDate}</p>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(tank)}
                                    className="h-8 w-8"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                </div>
                                
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Droplet className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-medium text-slate-900">
                                      {tank.current_gallons?.toLocaleString() || 0} gal
                                    </span>
                                  </div>
                                  
                                  <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div 
                                      className={`h-2 rounded-full transition-all duration-300 ${
                                        tankFillPercentage > 80 ? 'bg-emerald-500' :
                                        tankFillPercentage > 50 ? 'bg-blue-500' :
                                        tankFillPercentage > 20 ? 'bg-yellow-500' :
                                        'bg-red-500'
                                      }`}
                                      style={{ width: `${Math.min(tankFillPercentage, 100)}%` }}
                                    />
                                  </div>
                                  
                                  <p className="text-xs text-slate-500">
                                    {tankFillPercentage}% of {tankMaxSafeCapacity.toLocaleString()} gal (max safe)
                                  </p>
                                  
                                  {tank.product_type && (
                                    <div className="pt-2 border-t border-slate-100">
                                      <Badge className={`${getProductColor(tank.product_type)} border text-xs font-semibold`}>
                                        {tank.product_type}
                                      </Badge>
                                    </div>
                                  )}
                                  
                                  {tank.notes && (
                                    <div className="pt-2">
                                      <p className="text-xs text-slate-600">{tank.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {tanks.length === 0 && (
              <Card className="shadow-md border-slate-200">
                <CardContent className="p-12 text-center">
                  <Layers className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No Tanks Configured</h3>
                  <p className="text-slate-600 mb-6">Add tanks to your barges in Fleet → Barges to start tracking</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Select value={historySelectedBarge} onValueChange={setHistorySelectedBarge}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select barge" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Select a Barge</SelectItem>
                    {barges.map((barge) => (
                      <SelectItem key={barge.id} value={barge.id}>
                        {barge.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {historySelectedBarge !== "all" && (
                  <Button
                    onClick={() => setShowAddMissedReading(true)}
                    className="bg-gradient-to-r from-blue-600 to-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Missed Reading
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-lg font-semibold text-slate-900 min-w-[200px] text-center">
                  {format(historyMonth, 'MMMM yyyy')}
                </span>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {historySelectedBarge === "all" ? (
              <Card className="shadow-md border-slate-200">
                <CardContent className="p-12 text-center">
                  <History className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">Select a Barge</h3>
                  <p className="text-slate-600">Choose a barge to view its tank history</p>
                </CardContent>
              </Card>
            ) : historyBargeTanks.length === 0 ? (
              <Card className="shadow-md border-slate-200">
                <CardContent className="p-12 text-center">
                  <Layers className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No Tanks Configured</h3>
                  <p className="text-slate-600">Add tanks to this barge in Fleet → Barges</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-md border-slate-200">
                <CardHeader className="border-b border-slate-100">
                  <CardTitle className="text-xl font-bold text-slate-900">
                    {barges.find(b => b.id === historySelectedBarge)?.name} - Tank History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 px-4 py-3 text-left text-sm font-bold text-slate-700 sticky left-0 bg-slate-100 z-10">
                            DATE
                          </th>
                          {historyBargeTanks.map((tank) => (
                            <th
                              key={tank.id}
                              className="border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-700 min-w-[140px]"
                            >
                              <div className="flex items-center justify-center gap-2">
                                {tank.tank_color && tank.tank_color !== 'none' && (
                                  <div className={`w-4 h-4 rounded-full border-2 ${tankColorStyles[tank.tank_color]}`} />
                                )}
                                <span>{tank.tank_number}{tank.tank_position === 'port' ? 'Port' : 'Star'}</span>
                              </div>
                              <div className="text-xs font-normal text-slate-500 mt-1">
                                {tank.capacity_gallons?.toLocaleString()} gal
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {daysInMonth.map((day) => {
                          const dateKey = format(day, 'yyyy-MM-dd');
                          const dayRecords = historyByDateAndTank[dateKey] || {};
                          const hasAnyData = Object.keys(dayRecords).length > 0;

                          if (!hasAnyData) return null;

                          return (
                            <tr key={dateKey} className="hover:bg-slate-50">
                              <td className="border border-slate-300 px-4 py-3 font-semibold text-sm text-slate-900 sticky left-0 bg-white z-10">
                                {format(day, 'MMM d, yyyy')}
                              </td>
                              {historyBargeTanks.map((tank) => {
                                const tankKey = `${tank.tank_number}-${tank.tank_position}`;
                                const records = dayRecords[tankKey] || [];
                                const cellKey = `${dateKey}-${tankKey}`;
                                const isExpanded = expandedCells[cellKey];

                                if (records.length === 0) {
                                  return (
                                    <td key={tank.id} className="border border-slate-300 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                                      <div className="flex items-center justify-center">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => {
                                            // Create a temporary record for this empty cell
                                            const tempRecord = {
                                              barge_id: tank.barge_id,
                                              barge_name: tank.barge_name,
                                              tank_number: tank.tank_number,
                                              tank_position: tank.tank_position,
                                              tank_color: tank.tank_color,
                                              new_gallons: 0,
                                              previous_gallons: 0,
                                              product_type: '',
                                              notes: '',
                                              snapshot_date: `${dateKey}T12:00:00.000Z`,
                                              capacity_gallons: tank.capacity_gallons
                                            };
                                            handleEditHistoryRecord(tempRecord);
                                          }}
                                          className="h-8 w-8 hover:bg-blue-100 text-slate-400 hover:text-blue-600"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </td>
                                  );
                                }

                                const latestRecord = records[0];
                                const hasMultiple = records.length > 1;
                                
                                const changeColor = latestRecord.change_gallons > 0 
                                  ? 'text-emerald-600' 
                                  : latestRecord.change_gallons < 0 
                                  ? 'text-red-600' 
                                  : 'text-slate-600';

                                return (
                                  <td key={tank.id} className="border border-slate-300 px-4 py-3">
                                    <div className="space-y-1">
                                      {/* Latest Reading with Edit Button */}
                                      <div className="flex items-center justify-between">
                                        <div className="text-lg font-bold text-slate-900">
                                          {latestRecord.new_gallons !== null && latestRecord.new_gallons !== undefined 
                                            ? latestRecord.new_gallons.toLocaleString() 
                                            : '0'}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleEditHistoryRecord(latestRecord)}
                                          className="h-6 w-6 hover:bg-blue-100"
                                        >
                                          <Edit2 className="w-3 h-3 text-blue-600" />
                                        </Button>
                                      </div>
                                      {latestRecord.change_gallons !== 0 && (
                                        <div className={`text-xs font-semibold text-center ${changeColor}`}>
                                          {latestRecord.change_gallons > 0 ? '+' : ''}{latestRecord.change_gallons?.toLocaleString() || 0}
                                        </div>
                                      )}
                                      <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
                                        <Clock className="w-3 h-3" />
                                        {safeFormatTime(latestRecord.snapshot_date)}
                                      </div>
                                      
                                      {latestRecord.product_type && (
                                        <div className="flex justify-center mt-1">
                                          <Badge className={`${getProductColor(latestRecord.product_type)} border text-xs`}>
                                            {latestRecord.product_type}
                                          </Badge>
                                        </div>
                                      )}
                                      
                                      {hasMultiple && (
                                        <Collapsible open={isExpanded} onOpenChange={() => toggleCellExpanded(dateKey, tankKey)}>
                                            <CollapsibleTrigger asChild>
                                                <button
                                                  className="w-full mt-2 py-1 px-2 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-colors"
                                                >
                                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                  {records.length} readings
                                                </button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="CollapsibleContent">
                                              <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                                                {records.map((record, idx) => {
                                                  // Skip the latest record as it's already displayed above
                                                  if (idx === 0) return null; 

                                                  const recordChangeColor = record.change_gallons > 0 
                                                    ? 'text-emerald-600' 
                                                    : record.change_gallons < 0 
                                                    ? 'text-red-600' 
                                                    : 'text-slate-600';
                                                  
                                                  return (
                                                    <div key={idx} className="p-2 bg-slate-50 rounded text-xs space-y-1 border border-slate-200">
                                                      <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1 text-slate-600">
                                                          <Clock className="w-3 h-3" />
                                                          <span className="font-semibold">{safeFormatTime(record.snapshot_date)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-900">
                                                                {record.new_gallons !== null && record.new_gallons !== undefined 
                                                                  ? record.new_gallons.toLocaleString() 
                                                                  : '0'}
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEditHistoryRecord(record)}
                                                                className="h-5 w-5 hover:bg-blue-100"
                                                            >
                                                                <Edit2 className="w-2.5 h-2.5 text-blue-600" />
                                                            </Button>
                                                        </div>
                                                      </div>
                                                      {record.change_gallons !== 0 && (
                                                        <div className={`${recordChangeColor} font-semibold text-center`}>
                                                          {record.change_gallons > 0 ? '+' : ''}{record.change_gallons?.toLocaleString() || 0}
                                                        </div>
                                                      )}
                                                      {record.product_type && (
                                                        <Badge className={`${getProductColor(record.product_type)} border text-xs w-full justify-center`}>
                                                          {record.product_type}
                                                        </Badge>
                                                      )}
                                                      {record.notes && (
                                                        <div className="text-slate-600 italic pt-1 border-t border-slate-200">
                                                          {record.notes}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                      )}
                                      
                                      {/* Show notes for single reading or latest if not expanded */}
                                      {!hasMultiple && latestRecord.notes && (
                                        <div className="text-xs text-slate-500 text-center mt-1 italic">
                                          {latestRecord.notes}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {Object.keys(historyByDateAndTank).length === 0 && (
                    <div className="p-12 text-center">
                      <History className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                      <h3 className="text-xl font-semibold text-slate-900 mb-2">No History for {format(historyMonth, 'MMMM yyyy')}</h3>
                      <p className="text-slate-600">Tank readings for this month will appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}