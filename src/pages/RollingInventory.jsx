import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Calendar, Droplets, Ship, ChevronLeft, ChevronRight, Edit2, Save, X, Plus, AlertTriangle, Package, CheckCircle } from "lucide-react";
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// Safe date formatting helpers
const safeParseISO = (dateString) => {
  if (!dateString) return null;
  try {
    const parsed = parseISO(dateString);
    if (isNaN(parsed.getTime())) return null;
    return parsed;
  } catch (e) {
    console.error('Error parsing date:', dateString, e);
    return null;
  }
};

const safeFormat = (dateString, formatStr) => {
  const date = safeParseISO(dateString);
  if (!date) return '';
  try {
    return format(date, formatStr);
  } catch (e) {
    console.error('Error formatting date:', dateString, e);
    return '';
  }
};

const productColorStyles = {
  'CARB Diesel': 'bg-red-100 text-red-900 border-red-300',
  'RD99': 'bg-emerald-100 text-emerald-900 border-emerald-300',
  'MGO': 'bg-orange-100 text-orange-900 border-orange-300',
  'ULSD': 'bg-amber-100 text-amber-900 border-amber-300',
  'Diesel': 'bg-amber-100 text-amber-900 border-amber-300',
  'Marine Diesel': 'bg-amber-100 text-amber-900 border-amber-300',
  'default': 'bg-blue-100 text-blue-900 border-blue-300'
};

const getProductColor = (productType) => {
  if (!productType) return productColorStyles.default;
  if (productColorStyles[productType]) return productColorStyles[productType];
  
  const lowerProduct = productType.toLowerCase();
  if (lowerProduct.includes('rd99')) return productColorStyles['RD99'];
  if (lowerProduct.includes('carb')) return productColorStyles['CARB Diesel'];
  if (lowerProduct.includes('mgo')) return productColorStyles['MGO'];
  if (lowerProduct.includes('lube')) return 'bg-purple-100 text-purple-900 border-purple-300';
  if (lowerProduct.includes('diesel')) return productColorStyles['Diesel'];
  
  return productColorStyles.default;
};

export default function RollingInventory() {
  const [selectedBarge, setSelectedBarge] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [editingSnapshot, setEditingSnapshot] = useState(null);
  const [snapshotFormData, setSnapshotFormData] = useState({});
  const [showAddProduct, setShowAddProduct] = useState(null);
  const [newProductType, setNewProductType] = useState('');
  const [resolvingVariance, setResolvingVariance] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const queryClient = useQueryClient();

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  React.useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);
      if (user.default_market && barges.length > 0) {
        const userMarketBarge = barges.find(b => b.market === user.default_market);
        if (userMarketBarge) {
          setSelectedBarge(userMarketBarge.id);
        }
      }
    }).catch(() => {});
  }, [barges]);

  const { data: inventory = [] } = useQuery({
    queryKey: ['barge-inventory'],
    queryFn: () => base44.entities.BargeInventory.list(),
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['dispatches'],
    queryFn: () => base44.entities.Dispatch.list('-start_date'),
  });

  const { data: loadingEvents = [] } = useQuery({
    queryKey: ['loading-events'],
    queryFn: () => base44.entities.LoadingEvent.list('-scheduled_date'),
  });

  const { data: monthlySnapshots = [] } = useQuery({
    queryKey: ['monthly-inventory-snapshots'],
    queryFn: () => base44.entities.MonthlyInventorySnapshot.list(),
  });

  const { data: cargoTypes = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const { data: bargeTransfers = [] } = useQuery({
    queryKey: ['barge-transfers'],
    queryFn: () => base44.entities.BargeTransfer.list('-transfer_date'),
  });

  const { data: inventoryHistory = [] } = useQuery({
    queryKey: ['inventory-history'],
    queryFn: () => base44.entities.InventoryHistory.list('-snapshot_date', 1000),
  });

  const { data: resolvedVariances = [] } = useQuery({
    queryKey: ['resolved-variances'],
    queryFn: () => base44.entities.ResolvedVariance.list(),
  });

  const createSnapshotMutation = useMutation({
    mutationFn: (data) => base44.entities.MonthlyInventorySnapshot.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-inventory-snapshots'] });
      // Reset form state after mutation, assuming invalidation triggers refetch which then updates UI
      setEditingSnapshot(null);
      setSnapshotFormData({});
      setShowAddProduct(null);
      setNewProductType('');
    },
  });

  const updateSnapshotMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MonthlyInventorySnapshot.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-inventory-snapshots'] });
      setEditingSnapshot(null);
      setSnapshotFormData({});
    },
  });

  const resolveVarianceMutation = useMutation({
    mutationFn: (data) => base44.entities.ResolvedVariance.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resolved-variances'] });
      setResolvingVariance(null);
      setResolutionNotes('');
    },
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const monthYearStr = format(currentMonth, 'yyyy-MM');

  const filteredBarges = selectedBarge === "all" 
    ? barges 
    : barges.filter(b => b.id === selectedBarge);

  // Get active cargo IDs (products that haven't been deleted)
  const activeCargoIds = new Set((cargoTypes || []).map(c => c.id));
  
  // Filter products based on barge capabilities
  const getAvailableProductsForBarge = (barge) => {
    const allProducts = (cargoTypes || []).filter(c => c.is_active !== false);
    
    // ONLY Global Long Beach cannot carry lubricants - all other barges can
    const bargeNameLower = barge.name?.toLowerCase() || '';
    const isGlobalLongBeach = bargeNameLower === 'global long beach';
    
    // Filter based on barge capabilities
    return allProducts.filter(product => {
      const productName = product.name?.toLowerCase() || '';
      const isLube = product.category === 'Lubes';
      const isCARB = productName.includes('carb');
      
      // ALWAYS exclude packaged lubricants (we only track bulk)
      if (productName.includes('packaged') || productName.includes('package')) {
        return false;
      }
      
      // ONLY Global Long Beach cannot carry lubricants
      if (isGlobalLongBeach && isLube) {
        return false;
      }
      
      // Northern California (Oakland): No CARB diesel
      if (barge.market === 'Oakland' && isCARB) {
        return false;
      }
      
      return true;
    });
  };

  // Check if barge can carry lubricants
  const canCarryLubricants = (barge) => {
    const bargeNameLower = barge.name?.toLowerCase() || '';
    const isGlobalLongBeach = bargeNameLower === 'global long beach';
    return !isGlobalLongBeach;
  };

  // Calculate monthly inventory by product type for each barge
  const calculateMonthlyInventoryByProduct = (barge) => {
    const bargeTanks = inventory.filter(t => t.barge_id === barge.id);
    
    // Get unique product types from tanks, deliveries, loading events, transfers, AND monthly snapshots
    const productTypes = new Set();
    bargeTanks.forEach(t => { if (t.product_type) productTypes.add(t.product_type); });
    deliveries.filter(d => d.barge_id === barge.id && d.cargo_type).forEach(d => productTypes.add(d.cargo_type));
    loadingEvents.filter(l => l.barge_id === barge.id && l.product_type).forEach(l => productTypes.add(l.product_type));
    // Add products from transfers OUT (source product)
    bargeTransfers.filter(t => t.from_barge_id === barge.id && t.product_type)
      .forEach(t => productTypes.add(t.product_type));
    // Add products from transfers IN (resulting product type)
    bargeTransfers.filter(t => t.to_barge_id === barge.id && (t.resulting_product_type || t.product_type))
      .forEach(t => productTypes.add(t.resulting_product_type || t.product_type));
    // Also include products from monthly snapshots for this barge and month
    monthlySnapshots.filter(s => s.barge_id === barge.id && s.month_year === monthYearStr && s.product_type)
      .forEach(s => productTypes.add(s.product_type));
    
    // Filter out packaged products from display AND deleted products
    const filteredProductTypes = Array.from(productTypes).filter(productType => {
      const productName = productType?.toLowerCase() || '';
      // Exclude packaged products - we only track bulk inventory
      if (productName.includes('package') || productName.includes('packaged')) {
        return false;
      }
      // Exclude deleted products - check if product still exists in cargo list
      const productExists = (cargoTypes || []).some(c => c.name === productType);
      return productExists;
    });
    
    const productDataMap = {};
    
    filteredProductTypes.forEach(productType => {
      // Get snapshot for this barge, month, and product
      const snapshot = monthlySnapshots.find(s => 
        s.barge_id === barge.id && 
        s.month_year === monthYearStr && 
        s.product_type === productType
      );
      
      // Current inventory from tanks
      const currentInventory = bargeTanks
        .filter(t => t.product_type === productType)
        .reduce((sum, t) => sum + (t.current_gallons || 0), 0);
      
      const beginningInventory = snapshot?.beginning_inventory || 0;
      
      const dailyData = monthDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        
        // Deliveries of this product on this day - with safe date parsing
        const dayDeliveries = deliveries.filter(d => {
          if (d.barge_id !== barge.id) return false;
          if (d.cargo_type !== productType) return false;
          if (d.status !== 'delivered') return false;
          if (!d.start_date) return false;
          
          const formattedDate = safeFormat(d.start_date, 'yyyy-MM-dd');
          return formattedDate === dayStr;
        });
        
        // Loadings of this product on this day - with safe date parsing
        const dayLoadings = loadingEvents.filter(l => {
          if (l.barge_id !== barge.id) return false;
          if (l.product_type !== productType) return false;
          if (l.status !== 'completed') return false;
          if (!l.scheduled_date) return false;
          
          const formattedDate = safeFormat(l.scheduled_date, 'yyyy-MM-dd');
          return formattedDate === dayStr;
        });

        // Transfers OUT from this barge on this day - with safe date parsing
        const dayTransfersOut = bargeTransfers.filter(t => {
          if (t.from_barge_id !== barge.id) return false;
          if (t.product_type !== productType) return false;
          if (!t.transfer_date) return false;
          
          const formattedDate = safeFormat(t.transfer_date, 'yyyy-MM-dd');
          return formattedDate === dayStr;
        });

        // Transfers IN to this barge on this day - with safe date parsing
        const dayTransfersIn = bargeTransfers.filter(t => {
          if (t.to_barge_id !== barge.id) return false;
          if ((t.resulting_product_type || t.product_type) !== productType) return false;
          if (!t.transfer_date) return false;
          
          const formattedDate = safeFormat(t.transfer_date, 'yyyy-MM-dd');
          return formattedDate === dayStr;
        });
        
        const gallonsDelivered = dayDeliveries.reduce((sum, d) => sum + (d.gallons_delivered || 0), 0);
        const gallonsLoaded = dayLoadings.reduce((sum, l) => sum + (l.gallons_to_load || 0), 0);
        const gallonsTransferredOut = dayTransfersOut.reduce((sum, t) => sum + (t.gallons_transferred || 0), 0);
        const gallonsTransferredIn = dayTransfersIn.reduce((sum, t) => sum + (t.gallons_transferred || 0), 0);
        
        return {
          date: day,
          dateStr: dayStr,
          gallonsDelivered,
          gallonsLoaded,
          gallonsTransferredOut,
          gallonsTransferredIn,
          deliveryCount: dayDeliveries.length,
          loadingCount: dayLoadings.length,
          transferOutCount: dayTransfersOut.length,
          transferInCount: dayTransfersIn.length,
          deliveries: dayDeliveries,
          loadings: dayLoadings,
          transfersOut: dayTransfersOut,
          transfersIn: dayTransfersIn
        };
      });
      
      // Calculate running balance (including transfers)
      let runningBalance = beginningInventory;
      dailyData.forEach(day => {
        day.beginningBalance = runningBalance;
        // Transfers out reduce inventory (like deliveries), transfers in increase inventory (like loadings)
        day.endingBalance = runningBalance - day.gallonsDelivered + day.gallonsLoaded - day.gallonsTransferredOut + day.gallonsTransferredIn;
        runningBalance = day.endingBalance;
      });
      
      productDataMap[productType] = {
        productType,
        dailyData,
        currentInventory,
        beginningInventory,
        monthTotalDelivered: dailyData.reduce((sum, d) => sum + d.gallonsDelivered, 0),
        monthTotalLoaded: dailyData.reduce((sum, d) => sum + d.gallonsLoaded, 0),
        monthTotalTransferredOut: dailyData.reduce((sum, d) => sum + d.gallonsTransferredOut, 0),
        monthTotalTransferredIn: dailyData.reduce((sum, d) => sum + d.gallonsTransferredIn, 0),
        snapshot,
        hasSnapshot: !!snapshot
      };
    });
    
    return productDataMap;
  };

  // Calculate reconciliation discrepancies
  const calculateReconciliationDiscrepancies = (barge, productData) => {
    const discrepancies = [];
    
    // Track last known physical reading to carry forward
    let lastKnownPhysicalReading = null;
    
    productData.dailyData.forEach(day => {
      const dateKey = format(day.date, 'yyyy-MM-dd');
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Only check past dates (not today or future)
      if (dateKey >= today) return;
      
      // Check if this variance has been resolved
      const isResolved = resolvedVariances.some(rv => 
        rv.barge_id === barge.id && 
        rv.product_type === productData.productType && 
        rv.variance_date === dateKey
      );
      
      if (isResolved) return; // Skip resolved variances
      
      // Get all tank readings from InventoryHistory for this barge and date
      // IMPORTANT: We don't filter by product_type here - we want total physical inventory for the barge
      const dayHistoryRecords = inventoryHistory.filter(h => {
        if (h.barge_id !== barge.id) return false;
        if (!h.snapshot_date) return false;
        
        const recordDateKey = safeFormat(h.snapshot_date, 'yyyy-MM-dd');
        return recordDateKey === dateKey;
      });
      
      let physicalTotal = null;
      
      if (dayHistoryRecords.length > 0) {
        // We have readings for this day - use them
      
        const tankReadings = {};
        dayHistoryRecords.forEach(record => {
          const tankKey = `${record.tank_number}-${record.tank_position}`;
          const recordDate = safeParseISO(record.snapshot_date);
          if (!recordDate) return;
          const recordTime = recordDate.getTime();
          
          const existingDate = tankReadings[tankKey] ? safeParseISO(tankReadings[tankKey].snapshot_date) : null;
          const existingTime = existingDate ? existingDate.getTime() : 0;
          
          if (!tankReadings[tankKey] || recordTime > existingTime) {
            tankReadings[tankKey] = record;
          }
        });
        
        // Sum all tanks for this barge on this date, then filter for the specific product
        const productSpecificTotal = Object.values(tankReadings)
          .filter(record => record.product_type === productData.productType)
          .reduce((sum, record) => sum + (record.new_gallons || 0), 0);
        
        physicalTotal = productSpecificTotal;
        lastKnownPhysicalReading = { date: dateKey, total: physicalTotal };
      } else if (lastKnownPhysicalReading) {
        // No reading for this day - carry forward the last known reading
        physicalTotal = lastKnownPhysicalReading.total;
      } else {
        // No readings at all yet - skip comparison
        return;
      }
      
      if (physicalTotal === null) return;
      
      // Compare with calculated ending balance from rolling inventory
      const calculatedTotal = day.endingBalance || 0;
      const difference = Math.abs(calculatedTotal - physicalTotal);
      const percentageVariance = Math.abs((difference / Math.max(calculatedTotal, physicalTotal)) * 100);
      
      // Only flag if variance exceeds 2%
      if (percentageVariance > 2) {
        // Check if there are unclosed deliveries for this day
        const scheduledDeliveries = deliveries.filter(d => {
          if (d.barge_id !== barge.id) return false;
          if (d.cargo_type !== productData.productType) return false;
          if (d.status !== 'scheduled' && d.status !== 'in_transit') return false;
          if (!d.start_date) return false;
          
          const deliveryDateKey = safeFormat(d.start_date, 'yyyy-MM-dd');
          return deliveryDateKey === dateKey;
        });
        
        discrepancies.push({
          date: day.date,
          dateStr: dateKey,
          calculatedTotal,
          physicalTotal,
          difference,
          hasUnclosedDeliveries: scheduledDeliveries.length > 0,
          unclosedDeliveryCount: scheduledDeliveries.length
        });
      }
    });
    
    return discrepancies;
  };

  const bargeInventoryData = filteredBarges.map(barge => {
    const bargeTanks = inventory.filter(t => t.barge_id === barge.id);
    
    // Calculate total capacity correctly - sum each tank once based on its individual capacity
    const totalCapacity = bargeTanks.reduce((sum, tank) => {
      // Only count each unique tank number once for capacity
      // Check if this is the first occurrence of this tank number
      const isFirstOccurrence = !bargeTanks.slice(0, bargeTanks.indexOf(tank))
        .some(t => t.tank_number === tank.tank_number && t.tank_position === tank.tank_position);
      
      if (isFirstOccurrence) {
        return sum + (tank.capacity_gallons || 0);
      }
      return sum;
    }, 0);
    
    const maxSafeCapacity = Math.round(totalCapacity * 0.9);
    const currentTotalInventory = bargeTanks.reduce((sum, t) => sum + (t.current_gallons || 0), 0);
    
    const productData = calculateMonthlyInventoryByProduct(barge);
    
    // Calculate reconciliation discrepancies for each product
    const reconciliationData = {};
    Object.keys(productData).forEach(productType => {
      reconciliationData[productType] = calculateReconciliationDiscrepancies(barge, productData[productType]);
    });
    
    return {
      barge,
      currentTotalInventory,
      maxSafeCapacity,
      productData,
      reconciliationData
    };
  });

  const handlePreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleCurrentMonth = () => setCurrentMonth(startOfMonth(new Date()));

  const handleEditSnapshot = (bargeData, productType, productData) => {
    if (productData.snapshot) {
      setEditingSnapshot(`${bargeData.barge.id}-${productType}`);
      setSnapshotFormData({
        id: productData.snapshot.id,
        barge_id: bargeData.barge.id,
        product_type: productType,
        beginning_inventory: productData.snapshot.beginning_inventory,
        notes: productData.snapshot.notes || ''
      });
    } else {
      setEditingSnapshot(`new-${bargeData.barge.id}-${productType}`);
      setSnapshotFormData({
        barge_id: bargeData.barge.id,
        barge_name: bargeData.barge.name,
        month_year: monthYearStr,
        product_type: productType,
        beginning_inventory: '', // Start with empty field instead of pre-filling
        notes: ''
      });
    }
  };

  const handleSaveSnapshot = (bargeData, productType, productData) => {
    const inventoryValue = parseFloat(snapshotFormData.beginning_inventory);
    
    // Validate the input
    if (isNaN(inventoryValue)) {
      alert('Please enter a valid number for beginning inventory');
      return;
    }
    
    if (productData.hasSnapshot) {
      updateSnapshotMutation.mutate({
        id: productData.snapshot.id,
        data: {
          beginning_inventory: inventoryValue,
          notes: snapshotFormData.notes || ''
        }
      });
    } else {
      createSnapshotMutation.mutate({
        barge_id: bargeData.barge.id,
        barge_name: bargeData.barge.name,
        month_year: monthYearStr,
        product_type: productType,
        beginning_inventory: inventoryValue,
        notes: snapshotFormData.notes || ''
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingSnapshot(null);
    setSnapshotFormData({});
  };

  const handleAddProduct = (bargeId) => {
    if (newProductType) {
      createSnapshotMutation.mutate({
        barge_id: bargeId,
        barge_name: barges.find(b => b.id === bargeId)?.name || '',
        month_year: monthYearStr,
        product_type: newProductType,
        beginning_inventory: 0,
        notes: ''
      });
    }
  };

  const handleResolveVariance = (barge, productType, discrepancy) => {
    setResolvingVariance({ barge, productType, discrepancy });
  };

  const handleSaveResolution = () => {
    if (!resolvingVariance || !currentUser) return;

    const { barge, productType, discrepancy } = resolvingVariance;

    resolveVarianceMutation.mutate({
      barge_id: barge.id,
      barge_name: barge.name,
      product_type: productType,
      variance_date: discrepancy.dateStr,
      calculated_total: discrepancy.calculatedTotal,
      physical_total: discrepancy.physicalTotal,
      difference: discrepancy.difference,
      resolution_notes: resolutionNotes,
      resolved_by_name: currentUser.full_name,
      resolved_by_email: currentUser.email
    });
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Rolling Inventory Tracker
            </h1>
            <p className="text-slate-600">Monthly inventory flow by barge and product type</p>
          </div>
          <Select value={selectedBarge} onValueChange={setSelectedBarge}>
            <SelectTrigger className="w-64">
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

        <Card className="shadow-md border-slate-200 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-800">
                <TrendingUp className="w-5 h-5" />
                <p className="text-sm font-medium">
                  Track inventory by product type! Set beginning inventory for each product, then see daily changes from deliveries, loadings, and transfers.
                </p>
              </div>
              <div className="text-xs text-blue-700 pl-7">
                <strong>Product Guidelines:</strong> All barges can carry MGO, RD99, and Bulk Lubricants. Southern CA: add CARB. Northern CA (Oakland): no CARB. ONLY Global Long Beach: fuel only (no lubes).
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Month Navigation */}
        <Card className="shadow-md border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handlePreviousMonth}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Month
              </Button>
              
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900">
                  {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCurrentMonth}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Jump to Current Month
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={handleNextMonth}
                className="flex items-center gap-2"
              >
                Next Month
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rolling Inventory by Product */}
        {bargeInventoryData.map((bargeData) => {
          const utilizationPercent = bargeData.maxSafeCapacity > 0 
            ? Math.round((bargeData.currentTotalInventory / bargeData.maxSafeCapacity) * 100)
            : 0;

          const productTypes = Object.keys(bargeData.productData);
          const availableProducts = getAvailableProductsForBarge(bargeData.barge);
          
          // Separate lubricant and fuel products by checking product name against Lubes category
          const lubeProducts = productTypes.filter(p => {
            const productName = p?.toLowerCase() || '';
            return productName.includes('lube');
          });
          
          const fuelProducts = productTypes.filter(p => {
            const productName = p?.toLowerCase() || '';
            return !productName.includes('lube');
          });
          
          const hasLubes = canCarryLubricants(bargeData.barge);

          return (
            <Card key={bargeData.barge.id} className="shadow-lg border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md">
                      <Ship className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-slate-900">
                        {bargeData.barge.name}
                      </CardTitle>
                      <p className="text-sm text-slate-600">
                        Total: {bargeData.currentTotalInventory.toLocaleString()} gal 
                        <span className="mx-2">•</span>
                        {utilizationPercent}% full
                        <span className="mx-2">•</span>
                        Max Safe: {bargeData.maxSafeCapacity.toLocaleString()} gal
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {bargeData.barge.market}
                        {bargeData.barge.name?.toLowerCase() === 'global long beach' && 
                         ' • Fuel Only (No Lubes)'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddProduct(bargeData.barge.id)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Product
                  </Button>
                </div>

                {/* Add Product Form */}
                {showAddProduct === bargeData.barge.id && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Select value={newProductType} onValueChange={setNewProductType}>
                          <SelectTrigger className="w-64">
                            <SelectValue placeholder="Select product type" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProducts.length === 0 ? (
                              <div className="p-2 text-sm text-slate-500 text-center">
                                No products available for this barge
                              </div>
                            ) : (
                              availableProducts.map(cargo => (
                                <SelectItem key={cargo.id} value={cargo.name}>
                                  {cargo.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={() => handleAddProduct(bargeData.barge.id)}
                          disabled={!newProductType || createSnapshotMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {createSnapshotMutation.isPending ? 'Adding...' : 'Add'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowAddProduct(null);
                            setNewProductType('');
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="text-xs text-slate-600">
                        {!hasLubes && (
                          <p className="text-orange-600 font-medium">• Global Long Beach: Fuel products only (no lubricants)</p>
                        )}
                        {hasLubes && (
                          <p>• This barge can carry fuel products and bulk lubricants</p>
                        )}
                        {bargeData.barge.market === 'Oakland' && (
                          <p>• Oakland market: No CARB diesel allowed</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="p-6 space-y-8">
                {productTypes.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Droplets className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No products tracked yet</p>
                    <p className="text-sm mt-1">Click "Add Product" to start tracking inventory for this barge</p>
                  </div>
                ) : (
                  <>
                    {/* Bulk Lubricants Summary Box */}
                    {hasLubes && lubeProducts.length > 0 && (
                      <div className="border-2 border-purple-300 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 overflow-hidden">
                        <div className="bg-purple-600 text-white p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                              <Package className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold">Bulk Lubricants Summary</h3>
                              <p className="text-sm text-purple-100">All lubricant products for {bargeData.barge.name}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-6">
                          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {lubeProducts.map(productType => {
                              const productData = bargeData.productData[productType];
                              return (
                                <Card key={productType} className="shadow-md border-purple-200 bg-white">
                                  <CardContent className="p-4">
                                    <div className="space-y-3">
                                      <div>
                                        <Badge className="bg-purple-100 text-purple-900 border-purple-300 font-bold mb-2">
                                          {productType}
                                        </Badge>
                                      </div>
                                      
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Beginning:</span>
                                          <span className="font-bold text-slate-900">
                                            {productData.beginningInventory.toLocaleString()} gal
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Current:</span>
                                          <span className="font-bold text-slate-900">
                                            {productData.currentInventory.toLocaleString()} gal
                                          </span>
                                        </div>
                                        <div className="border-t border-slate-200 pt-2">
                                          <div className="flex justify-between text-red-700">
                                            <span>Delivered:</span>
                                            <span className="font-bold">-{productData.monthTotalDelivered.toLocaleString()}</span>
                                          </div>
                                          <div className="flex justify-between text-emerald-700">
                                            <span>Loaded:</span>
                                            <span className="font-bold">+{productData.monthTotalLoaded.toLocaleString()}</span>
                                          </div>
                                        </div>
                                        <div className="border-t border-slate-200 pt-2">
                                          <div className="flex justify-between items-center">
                                            <span className="font-semibold text-slate-900">Net Change:</span>
                                            <span className={`font-bold ${
                                              (productData.monthTotalLoaded - productData.monthTotalDelivered) >= 0 
                                                ? 'text-emerald-600' 
                                                : 'text-red-600'
                                            }`}>
                                              {(productData.monthTotalLoaded - productData.monthTotalDelivered) >= 0 ? '+' : ''}
                                              {(productData.monthTotalLoaded - productData.monthTotalDelivered).toLocaleString()} gal
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fuel Products - Full Detail Tables */}
                    {fuelProducts.map(productType => {
                      const productData = bargeData.productData[productType];
                      const isEditing = editingSnapshot === `${bargeData.barge.id}-${productType}` || 
                                       editingSnapshot === `new-${bargeData.barge.id}-${productType}`;
                      
                      const discrepancies = bargeData.reconciliationData[productType] || [];

                      return (
                        <div key={productType} className="border-2 border-slate-200 rounded-lg overflow-hidden">
                          
                          {/* Reconciliation Alerts */}
                          {discrepancies.length > 0 && (
                            <div className="bg-yellow-50 border-b-2 border-yellow-300 p-4">
                              <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <h4 className="font-bold text-yellow-900 mb-2">
                                    Reconciliation Alert - Discrepancies Detected
                                  </h4>
                                  <div className="space-y-2 text-sm text-yellow-800">
                                    {discrepancies.map((disc, idx) => (
                                      <div key={idx} className="p-2 bg-white rounded border border-yellow-200">
                                        <div className="flex items-start justify-between mb-1">
                                          <div className="font-semibold">
                                            {format(disc.date, 'EEEE, MMMM d, yyyy')}
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleResolveVariance(bargeData.barge, productType, disc)}
                                            className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300"
                                          >
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            Mark Resolved
                                          </Button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                          <div>
                                            <span className="font-medium">Rolling Inventory:</span>{' '}
                                            {disc.calculatedTotal.toLocaleString()} gal
                                          </div>
                                          <div>
                                            <span className="font-medium">Physical Tank Levels:</span>{' '}
                                            {disc.physicalTotal.toLocaleString()} gal
                                          </div>
                                          <div className="col-span-2">
                                            <span className="font-medium text-red-700">Difference:</span>{' '}
                                            <span className="font-bold text-red-700">{disc.difference.toLocaleString()} gallons</span>
                                          </div>
                                          {disc.hasUnclosedDeliveries && (
                                            <div className="col-span-2 text-orange-700 font-semibold">
                                              ⚠️ {disc.unclosedDeliveryCount} unclosed deliver{disc.unclosedDeliveryCount > 1 ? 'ies' : 'y'} on this date
                                            </div>
                                          )}
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-yellow-200 text-xs italic">
                                          {disc.hasUnclosedDeliveries 
                                            ? "→ Please close out all deliveries in the Deliveries page"
                                            : "→ Please verify physical tank gauging in Tank Levels History"}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Product Header */}
                          <div className="bg-slate-50 p-4 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge className={`${getProductColor(productType)} border text-sm font-bold px-3 py-1`}>
                                  {productType}
                                </Badge>
                                <div className="text-sm text-slate-600">
                                  Current: <span className="font-bold text-slate-900">{productData.currentInventory.toLocaleString()} gal</span>
                                  <span className="mx-2">•</span>
                                  Delivered: <span className="font-bold text-red-600">-{productData.monthTotalDelivered.toLocaleString()}</span>
                                  <span className="mx-2">•</span>
                                  Loaded: <span className="font-bold text-emerald-600">+{productData.monthTotalLoaded.toLocaleString()}</span>
                                  {(productData.monthTotalTransferredOut > 0 || productData.monthTotalTransferredIn > 0) && (
                                    <>
                                      {productData.monthTotalTransferredOut > 0 && (
                                        <>
                                          <span className="mx-2">•</span>
                                          Transferred Out: <span className="font-bold text-orange-600">-{productData.monthTotalTransferredOut.toLocaleString()}</span>
                                        </>
                                      )}
                                      {productData.monthTotalTransferredIn > 0 && (
                                        <>
                                          <span className="mx-2">•</span>
                                          Transferred In: <span className="font-bold text-cyan-600">+{productData.monthTotalTransferredIn.toLocaleString()}</span>
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Beginning Inventory Input */}
                            <div className="mt-3">
                              <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                                Beginning Inventory for {format(currentMonth, 'MMMM yyyy')}
                              </Label>
                              {isEditing ? (
                                <div className="flex items-center gap-3">
                                  <Input
                                    type="number"
                                    value={snapshotFormData.beginning_inventory || ''}
                                    onChange={(e) => setSnapshotFormData({
                                      ...snapshotFormData,
                                      beginning_inventory: e.target.value
                                    })}
                                    placeholder="Enter beginning inventory"
                                    className="w-48"
                                  />
                                  <Input
                                    type="text"
                                    value={snapshotFormData.notes || ''}
                                    onChange={(e) => setSnapshotFormData({
                                      ...snapshotFormData,
                                      notes: e.target.value
                                    })}
                                    placeholder="Notes (optional)"
                                    className="flex-1"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveSnapshot(bargeData, productType, productData)}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    disabled={snapshotFormData.beginning_inventory === '' || snapshotFormData.beginning_inventory === null || snapshotFormData.beginning_inventory === undefined}
                                  >
                                    <Save className="w-4 h-4 mr-1" />
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div>
                                    {productData.hasSnapshot ? (
                                      <>
                                        <span className="text-lg font-bold text-slate-900">
                                          {productData.beginningInventory.toLocaleString()} gal
                                        </span>
                                        {productData.snapshot.notes && (
                                          <p className="text-sm text-slate-600 mt-1">{productData.snapshot.notes}</p>
                                        )}
                                      </>
                                    ) : (
                                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                                        Not Set - Click to set beginning inventory
                                      </Badge>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditSnapshot(bargeData, productType, productData)}
                                  >
                                    <Edit2 className="w-4 h-4 mr-1" />
                                    {productData.hasSnapshot ? 'Edit' : 'Set'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Daily Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="border-b-2 border-slate-300 bg-white">
                                  <th className="text-left py-2 px-3 font-bold text-slate-700 whitespace-nowrap">Date</th>
                                  <th className="text-right py-2 px-3 font-bold text-slate-700 whitespace-nowrap">Beginning</th>
                                  <th className="text-right py-2 px-3 font-bold text-red-700 whitespace-nowrap">Delivered</th>
                                  <th className="text-right py-2 px-3 font-bold text-emerald-700 whitespace-nowrap">Loaded</th>
                                  <th className="text-right py-2 px-3 font-bold text-orange-700 whitespace-nowrap">Trans. Out</th>
                                  <th className="text-right py-2 px-3 font-bold text-cyan-700 whitespace-nowrap">Trans. In</th>
                                  <th className="text-right py-2 px-3 font-bold text-slate-700 whitespace-nowrap">Ending</th>
                                  <th className="text-center py-2 px-3 font-bold text-slate-700 whitespace-nowrap">Activity</th>
                                  <th className="text-right py-2 px-3 font-bold text-blue-700 whitespace-nowrap">Physical</th>
                                  <th className="text-right py-2 px-3 font-bold text-purple-700 whitespace-nowrap">Variance</th>
                                  </tr>
                                  </thead>
                                  <tbody>
                                  {productData.dailyData.map((day) => {
                                  // Get physical count for this day
                                  const dayHistoryRecords = inventoryHistory.filter(h => {
                                   if (h.barge_id !== bargeData.barge.id) return false;
                                   if (!h.snapshot_date) return false;
                                   const recordDateKey = safeFormat(h.snapshot_date, 'yyyy-MM-dd');
                                   return recordDateKey === day.dateStr;
                                  });

                                  let physicalCount = null;
                                  if (dayHistoryRecords.length > 0) {
                                   const tankReadings = {};
                                   dayHistoryRecords.forEach(record => {
                                     const tankKey = `${record.tank_number}-${record.tank_position}`;
                                     const recordDate = safeParseISO(record.snapshot_date);
                                     if (!recordDate) return;
                                     const recordTime = recordDate.getTime();
                                     const existingDate = tankReadings[tankKey] ? safeParseISO(tankReadings[tankKey].snapshot_date) : null;
                                     const existingTime = existingDate ? existingDate.getTime() : 0;
                                     if (!tankReadings[tankKey] || recordTime > existingTime) {
                                       tankReadings[tankKey] = record;
                                     }
                                   });
                                   physicalCount = Object.values(tankReadings)
                                     .filter(record => record.product_type === productType)
                                     .reduce((sum, record) => sum + (record.new_gallons || 0), 0);
                                  }

                                  const variance = physicalCount !== null ? physicalCount - day.endingBalance : null;
                                  const percentageVariance = variance !== null && physicalCount !== null && physicalCount !== 0
                                   ? Math.abs((variance / physicalCount) * 100)
                                   : null;
                                  const hasSignificantVariance = percentageVariance !== null && percentageVariance > 2;
                                  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                                  const isToday = format(new Date(), 'yyyy-MM-dd') === day.dateStr;
                                  
                                  return (
                                    <tr 
                                      key={day.dateStr} 
                                      className={`border-b border-slate-200 ${
                                        isToday ? 'bg-blue-50' :
                                        isWeekend ? 'bg-slate-50' : 
                                        'hover:bg-slate-50'
                                      } transition-colors`}
                                    >
                                      <td className="py-2 px-3 font-medium text-slate-900 text-xs">
                                        {format(day.date, 'EEE, MMM d')}
                                        {isToday && (
                                          <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                                            Today
                                          </span>
                                        )}
                                      </td>
                                      <td className="text-right py-2 px-3 font-medium text-slate-900">
                                        {day.beginningBalance?.toLocaleString() || '0'}
                                      </td>
                                      <td className="text-right py-2 px-3">
                                        {day.gallonsDelivered > 0 ? (
                                          <span className="font-bold text-red-600">
                                            -{day.gallonsDelivered.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400">-</span>
                                        )}
                                      </td>
                                      <td className="text-right py-2 px-3">
                                        {day.gallonsLoaded > 0 ? (
                                          <span className="font-bold text-emerald-600">
                                            +{day.gallonsLoaded.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400">-</span>
                                        )}
                                      </td>
                                      <td className="text-right py-2 px-3">
                                        {day.gallonsTransferredOut > 0 ? (
                                          <span className="font-bold text-orange-600">
                                            -{day.gallonsTransferredOut.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400">-</span>
                                        )}
                                      </td>
                                      <td className="text-right py-2 px-3">
                                        {day.gallonsTransferredIn > 0 ? (
                                          <span className="font-bold text-cyan-600">
                                            +{day.gallonsTransferredIn.toLocaleString()}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400">-</span>
                                        )}
                                      </td>
                                      <td className="text-right py-2 px-3 font-bold text-slate-900">
                                        {day.endingBalance?.toLocaleString() || '0'}
                                      </td>
                                      <td className="text-center py-2 px-3">
                                        <div className="flex items-center justify-center gap-1 flex-wrap">
                                          {day.deliveryCount > 0 && (
                                            <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                                              <TrendingDown className="w-3 h-3" />
                                              {day.deliveryCount}
                                            </span>
                                          )}
                                          {day.loadingCount > 0 && (
                                            <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                                              <TrendingUp className="w-3 h-3" />
                                              {day.loadingCount}
                                            </span>
                                          )}
                                          {day.transferOutCount > 0 && (
                                            <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                                              OUT {day.transferOutCount}
                                            </span>
                                          )}
                                          {day.transferInCount > 0 && (
                                            <span className="inline-flex items-center gap-1 text-xs bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full">
                                              IN {day.transferInCount}
                                            </span>
                                          )}
                                          {day.deliveryCount === 0 && day.loadingCount === 0 && day.transferOutCount === 0 && day.transferInCount === 0 && (
                                           <span className="text-slate-400 text-xs">-</span>
                                          )}
                                          </div>
                                          </td>
                                          <td className="text-right py-2 px-3">
                                          {physicalCount !== null ? (
                                          <span className="font-medium text-blue-900">
                                           {physicalCount.toLocaleString()}
                                          </span>
                                          ) : (
                                          <span className="text-slate-400">—</span>
                                          )}
                                          </td>
                                          <td className="text-right py-2 px-3">
                                          {variance !== null ? (
                                            <span className={`font-bold ${
                                              hasSignificantVariance 
                                                ? 'text-red-700 bg-red-50 px-2 py-1 rounded' 
                                                : variance > 0 
                                                ? 'text-emerald-600' 
                                                : variance < 0
                                                ? 'text-orange-600'
                                                : 'text-slate-600'
                                            }`}>
                                           {variance > 0 ? '+' : ''}{variance.toLocaleString()}
                                           {percentageVariance !== null && percentageVariance > 0 && (
                                             <span className="text-xs ml-1">({percentageVariance.toFixed(1)}%)</span>
                                           )}
                                          </span>
                                          ) : (
                                          <span className="text-slate-400">—</span>
                                          )}
                                          </td>
                                          </tr>
                                          );
                                          })}
                                {/* Month Total Row */}
                                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                                  <td className="py-2 px-3 text-slate-900 text-xs">Month Total</td>
                                  <td className="text-right py-2 px-3 text-slate-900">
                                    {productData.beginningInventory.toLocaleString()}
                                  </td>
                                  <td className="text-right py-2 px-3 text-red-600">
                                    -{productData.monthTotalDelivered.toLocaleString()}
                                  </td>
                                  <td className="text-right py-2 px-3 text-emerald-600">
                                    +{productData.monthTotalLoaded.toLocaleString()}
                                  </td>
                                  <td className="text-right py-2 px-3 text-orange-600">
                                    {productData.monthTotalTransferredOut > 0 ? `-${productData.monthTotalTransferredOut.toLocaleString()}` : '-'}
                                  </td>
                                  <td className="text-right py-2 px-3 text-cyan-600">
                                    {productData.monthTotalTransferredIn > 0 ? `+${productData.monthTotalTransferredIn.toLocaleString()}` : '-'}
                                  </td>
                                  <td className="text-right py-2 px-3 text-slate-900">
                                    {productData.dailyData[productData.dailyData.length - 1]?.endingBalance?.toLocaleString() || '0'}
                                  </td>
                                  <td className="text-center py-2 px-3 text-slate-400">-</td>
                                  <td className="text-right py-2 px-3 text-slate-400">-</td>
                                  <td className="text-right py-2 px-3 text-slate-400">-</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Net Change */}
                          <div className="p-3 bg-slate-50 border-t border-slate-200">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-700">Month Net Change:</span>
                              <div className="flex items-center gap-2">
                                {(productData.monthTotalLoaded + productData.monthTotalTransferredIn - productData.monthTotalDelivered - productData.monthTotalTransferredOut) >= 0 ? (
                                  <>
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    <span className="text-lg font-bold text-emerald-600">
                                      +{(productData.monthTotalLoaded + productData.monthTotalTransferredIn - productData.monthTotalDelivered - productData.monthTotalTransferredOut).toLocaleString()} gal
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <TrendingDown className="w-4 h-4 text-red-600" />
                                    <span className="text-lg font-bold text-red-600">
                                      {(productData.monthTotalLoaded + productData.monthTotalTransferredIn - productData.monthTotalDelivered - productData.monthTotalTransferredOut).toLocaleString()} gal
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Lubricants - Show in summary box only */}
                    {lubeProducts.map(productType => {
                      const productData = bargeData.productData[productType];
                      const isEditing = editingSnapshot === `${bargeData.barge.id}-${productType}` || 
                                       editingSnapshot === `new-${bargeData.barge.id}-${productType}`;

                      return (
                        <div key={productType} className="border-2 border-purple-200 rounded-lg overflow-hidden bg-purple-50">
                          {/* Product Header - Compact for Lubes */}
                          <div className="bg-purple-100 p-4 border-b border-purple-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Badge className="bg-purple-600 text-white border-purple-700 text-sm font-bold px-3 py-1">
                                  {productType}
                                </Badge>
                              </div>
                            </div>

                            {/* Beginning Inventory Input */}
                            <div className="mt-3">
                              <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                                Beginning Inventory for {format(currentMonth, 'MMMM yyyy')}
                              </Label>
                              {isEditing ? (
                                <div className="flex items-center gap-3">
                                  <Input
                                    type="number"
                                    value={snapshotFormData.beginning_inventory || ''}
                                    onChange={(e) => setSnapshotFormData({
                                      ...snapshotFormData,
                                      beginning_inventory: e.target.value
                                    })}
                                    placeholder="Enter beginning inventory"
                                    className="w-48"
                                  />
                                  <Input
                                    type="text"
                                    value={snapshotFormData.notes || ''}
                                    onChange={(e) => setSnapshotFormData({
                                      ...snapshotFormData,
                                      notes: e.target.value
                                    })}
                                    placeholder="Notes (optional)"
                                    className="flex-1"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveSnapshot(bargeData, productType, productData)}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    disabled={snapshotFormData.beginning_inventory === '' || snapshotFormData.beginning_inventory === null || snapshotFormData.beginning_inventory === undefined}
                                  >
                                    <Save className="w-4 h-4 mr-1" />
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div>
                                    {productData.hasSnapshot ? (
                                      <>
                                        <span className="text-lg font-bold text-slate-900">
                                          {productData.beginningInventory.toLocaleString()} gal
                                        </span>
                                        {productData.snapshot.notes && (
                                          <p className="text-sm text-slate-600 mt-1">{productData.snapshot.notes}</p>
                                        )}
                                      </>
                                    ) : (
                                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                                        Not Set - Click to set beginning inventory
                                      </Badge>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditSnapshot(bargeData, productType, productData)}
                                  >
                                    <Edit2 className="w-4 h-4 mr-1" />
                                    {productData.hasSnapshot ? 'Edit' : 'Set'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Lubricant Note */}
                          <div className="p-3 bg-purple-50 border-t border-purple-200 text-xs text-purple-800 italic">
                            <Package className="w-4 h-4 inline mr-2" />
                            Lubricants are tracked in the summary box above. See individual details in Tank Levels for specific readings.
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}

        {barges.length === 0 && (
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-12 text-center">
              <Ship className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Barges Yet</h3>
              <p className="text-slate-600">Add barges to start tracking rolling inventory</p>
            </CardContent>
          </Card>
        )}

        {/* Resolve Variance Dialog */}
        <Dialog open={!!resolvingVariance} onOpenChange={(open) => !open && setResolvingVariance(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark Variance as Resolved</DialogTitle>
            </DialogHeader>
            {resolvingVariance && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                  <div className="font-semibold text-slate-900 mb-2">
                    {resolvingVariance.barge.name} - {resolvingVariance.productType}
                  </div>
                  <div className="text-slate-700">
                    Date: {format(resolvingVariance.discrepancy.date, 'MMMM d, yyyy')}
                  </div>
                  <div className="text-red-700 font-semibold mt-2">
                    Difference: {resolvingVariance.discrepancy.difference.toLocaleString()} gallons
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="resolution_notes">Resolution Notes (Optional)</Label>
                  <Textarea
                    id="resolution_notes"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Explain how this variance was resolved (e.g., tank gauging corrected, delivery records updated, etc.)"
                    rows={4}
                  />
                  <p className="text-xs text-slate-600">
                    This variance will be hidden from the alerts once marked as resolved.
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setResolvingVariance(null);
                  setResolutionNotes('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveResolution}
                disabled={resolveVarianceMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {resolveVarianceMutation.isPending ? 'Saving...' : 'Mark as Resolved'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}