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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Warehouse, Plus, TruckIcon, ArrowDownToLine, ArrowUpFromLine, 
  History, Edit2, Droplet, Save, ChevronLeft, ChevronRight, Trash2, Download 
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import { ALL_MARKETS } from "@/lib/regions";
import TransactionRowActions from "@/components/tanks/TransactionRowActions";

const productColorStyles = {
  'CARB Diesel': 'bg-red-100 text-red-900 border-red-300',
  'RD99': 'bg-emerald-100 text-emerald-900 border-emerald-300',
  'MGO': 'bg-orange-100 text-orange-900 border-orange-300',
  'ULSD': 'bg-amber-100 text-amber-900 border-amber-300',
  'default': 'bg-blue-100 text-blue-900 border-blue-300'
};

const getProductColor = (productType) => {
  if (!productType) return productColorStyles.default;
  if (productColorStyles[productType]) return productColorStyles[productType];
  return productColorStyles.default;
};

export default function StorageTanks() {
  const [showAddTank, setShowAddTank] = useState(false);
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [showTransaction, setShowTransaction] = useState(false);
  const [showEditTank, setShowEditTank] = useState(false);
  const [editingTank, setEditingTank] = useState(null);
  const [selectedTank, setSelectedTank] = useState(null);
  const [transactionType, setTransactionType] = useState('truck_in');
  const [historyMonth, setHistoryMonth] = useState(new Date());
  const [tankFormData, setTankFormData] = useState({
    facility_name: 'Rancho Dominguez', market: '',
    tank_number: '',
    capacity_gallons: '',
    product_type: '',
    current_gallons: 0,
    notes: ''
  });
  const [transactionFormData, setTransactionFormData] = useState({
    transaction_date: format(new Date(), 'yyyy-MM-dd'),
    gallons: '',
    truck_number: '',
    bol_number: '',
    driver_name: '',
    customer: '',
    supplier: '',
    notes: '',
    used_carrier: false
  });

  const queryClient = useQueryClient();

  const { data: tanks = [] } = useQuery({
    queryKey: ['storage-tanks'],
    queryFn: () => base44.entities.StorageTank.list(),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['storage-tank-transactions'],
    queryFn: () => base44.entities.StorageTankTransaction.list('-transaction_date', 500),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const activeProducts = products.filter(p => p.is_active !== false);

  const createTankMutation = useMutation({
    mutationFn: (data) => base44.entities.StorageTank.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-tanks'] });
      setShowAddTank(false);
      setTankFormData({
        facility_name: 'Rancho Dominguez', market: '',
        tank_number: '',
        capacity_gallons: '',
        product_type: '',
        current_gallons: 0,
        notes: ''
      });
    },
  });

  const updateTankMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StorageTank.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-tanks'] });
      setShowEditTank(false);
      setEditingTank(null);
      setTankFormData({
        facility_name: 'Rancho Dominguez', market: '',
        tank_number: '',
        capacity_gallons: '',
        product_type: '',
        current_gallons: 0,
        notes: ''
      });
    },
  });

  const deleteTankMutation = useMutation({
    mutationFn: (id) => base44.entities.StorageTank.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-tanks'] });
    },
  });

  const handleDeleteTank = (tank) => {
    if (window.confirm(`Are you sure you want to delete ${tank.tank_number}? This cannot be undone.`)) {
      deleteTankMutation.mutate(tank.id);
    }
  };

  const createTransactionMutation = useMutation({
    mutationFn: async (data) => {
      // Create the transaction
      const transaction = await base44.entities.StorageTankTransaction.create(data);
      
      // Update tank level
      const newLevel = data.transaction_type === 'truck_in' 
        ? data.previous_gallons + data.gallons
        : data.previous_gallons - data.gallons;
      
      await base44.entities.StorageTank.update(data.tank_id, {
        current_gallons: newLevel,
        last_updated: new Date().toISOString()
      });
      
      return transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-tanks'] });
      queryClient.invalidateQueries({ queryKey: ['storage-tank-transactions'] });
      setShowTransaction(false);
      setSelectedTank(null);
      setTransactionFormData({
        transaction_date: format(new Date(), 'yyyy-MM-dd'),
        gallons: '',
        truck_number: '',
        bol_number: '',
        driver_name: '',
        customer: '',
        supplier: '',
        notes: '',
        used_carrier: false
      });
    },
  });

  const handleAddTank = (e) => {
    e.preventDefault();
    createTankMutation.mutate({
      ...tankFormData,
      capacity_gallons: parseFloat(tankFormData.capacity_gallons) || 0,
      current_gallons: parseFloat(tankFormData.current_gallons) || 0,
      last_updated: new Date().toISOString()
    });
  };

  const handleEditTank = (e) => {
    e.preventDefault();
    updateTankMutation.mutate({
      id: editingTank.id,
      data: {
        ...tankFormData,
        capacity_gallons: parseFloat(tankFormData.capacity_gallons) || 0,
        current_gallons: parseFloat(tankFormData.current_gallons) || 0,
        last_updated: new Date().toISOString()
      }
    });
  };

  const openEditTank = (tank) => {
    setEditingTank(tank);
    setTankFormData({
      facility_name: tank.facility_name || 'Rancho Dominguez',
      market: tank.market || '',
      tank_number: tank.tank_number || '',
      capacity_gallons: tank.capacity_gallons || '',
      product_type: tank.product_type || '',
      current_gallons: tank.current_gallons || 0,
      notes: tank.notes || ''
    });
    setShowEditTank(true);
  };

  const handleTransaction = (e) => {
    e.preventDefault();
    const gallons = parseFloat(transactionFormData.gallons) || 0;
    const previousGallons = selectedTank.current_gallons || 0;
    const newGallons = transactionType === 'truck_in' 
      ? previousGallons + gallons 
      : previousGallons - gallons;

    createTransactionMutation.mutate({
      tank_id: selectedTank.id,
      facility_name: selectedTank.facility_name,
      tank_number: selectedTank.tank_number,
      market: selectedTank.market,
      transaction_type: transactionType,
      transaction_date: transactionFormData.transaction_date,
      gallons: gallons,
      product_type: selectedTank.product_type,
      truck_number: transactionFormData.truck_number,
      bol_number: transactionFormData.bol_number,
      driver_name: transactionFormData.driver_name,
      customer: transactionFormData.customer,
      supplier: transactionFormData.supplier,
      used_carrier: transactionType === 'truck_out' ? transactionFormData.used_carrier : false,
      previous_gallons: previousGallons,
      new_gallons: newGallons,
      notes: transactionFormData.notes
    });
  };

  const openTransaction = (tank, type) => {
    setSelectedTank(tank);
    setTransactionType(type);
    setTransactionFormData({
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
      gallons: '',
      truck_number: '',
      bol_number: '',
      driver_name: '',
      customer: '',
      supplier: '',
      notes: '',
      used_carrier: false
    });
    setShowTransaction(true);
  };

  // All unique facilities for filter
  const allFacilities = [...new Set(tanks.map(t => t.facility_name || 'Unknown'))].sort();

  // Group tanks by facility (with filter applied)
  const filteredTanks = facilityFilter === 'all' ? tanks : tanks.filter(t => (t.facility_name || 'Unknown') === facilityFilter);
  const tanksByFacility = filteredTanks.reduce((acc, tank) => {
    const facility = tank.facility_name || 'Unknown';
    if (!acc[facility]) acc[facility] = [];
    acc[facility].push(tank);
    return acc;
  }, {});

  // Filter transactions for history view
  const monthStart = startOfMonth(historyMonth);
  const monthEnd = endOfMonth(historyMonth);
  const monthTransactions = transactions.filter(t => {
    const txDate = parseISO(t.transaction_date);
    return txDate >= monthStart && txDate <= monthEnd;
  });

  // Calculate running totals by tank for the month
  const getMonthSummary = (tankId) => {
    const tankTx = monthTransactions.filter(t => t.tank_id === tankId);
    const totalIn = tankTx.filter(t => t.transaction_type === 'truck_in').reduce((sum, t) => sum + (t.gallons || 0), 0);
    const totalOut = tankTx.filter(t => t.transaction_type === 'truck_out').reduce((sum, t) => sum + (t.gallons || 0), 0);
    return { totalIn, totalOut, net: totalIn - totalOut, count: tankTx.length };
  };

  // Export transactions to CSV
  const exportTransactionsToCSV = () => {
    const headers = [
      'Date',
      'Facility',
      'Tank',
      'Product',
      'Type',
      'Gallons',
      'Truck #',
      'BOL #',
      'Driver',
      'Customer/Supplier',
      'Used Carrier',
      'Previous Level',
      'New Level',
      'Notes'
    ];

    const rows = monthTransactions.map(tx => [
      format(parseISO(tx.transaction_date), 'yyyy-MM-dd'),
      tx.facility_name || '',
      tx.tank_number || '',
      tx.product_type || '',
      tx.transaction_type === 'truck_in' ? 'Truck In' : 'Truck Out',
      tx.gallons || 0,
      tx.truck_number || '',
      tx.bol_number || '',
      tx.driver_name || '',
      tx.transaction_type === 'truck_in' ? (tx.supplier || '') : (tx.customer || ''),
      tx.used_carrier ? 'Yes' : 'No',
      tx.previous_gallons || 0,
      tx.new_gallons || 0,
      tx.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const cellStr = String(cell);
        return cellStr.includes(',') ? `"${cellStr}"` : cellStr;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storage-tank-transactions-${format(historyMonth, 'yyyy-MM')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Storage Tanks
            </h1>
            <p className="text-slate-600">Track tank inventory and truck movements</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={facilityFilter} onValueChange={setFacilityFilter}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All Facilities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Facilities</SelectItem>
                {allFacilities.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => setShowAddTank(true)}
              className="bg-gradient-to-r from-purple-600 to-purple-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Tank
            </Button>
          </div>
        </div>

        {/* Edit Tank Dialog */}
        <Dialog open={showEditTank} onOpenChange={setShowEditTank}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Storage Tank</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditTank} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Market</Label>
                <Select
                  value={tankFormData.market}
                  onValueChange={(value) => setTankFormData({...tankFormData, market: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select market" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_MARKETS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Facility Name</Label>
                <Input
                  value={tankFormData.facility_name}
                  onChange={(e) => setTankFormData({...tankFormData, facility_name: e.target.value})}
                  placeholder="e.g., Rancho Dominguez"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tank Number/Name</Label>
                <Input
                  value={tankFormData.tank_number}
                  onChange={(e) => setTankFormData({...tankFormData, tank_number: e.target.value})}
                  placeholder="e.g., Tank 1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity (Gallons)</Label>
                <Input
                  type="number"
                  value={tankFormData.capacity_gallons}
                  onChange={(e) => setTankFormData({...tankFormData, capacity_gallons: e.target.value})}
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Product Type</Label>
                <Select
                  value={tankFormData.product_type}
                  onValueChange={(value) => setTankFormData({...tankFormData, product_type: value})}
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
                <Label>Current Level (Gallons)</Label>
                <Input
                  type="number"
                  value={tankFormData.current_gallons}
                  onChange={(e) => setTankFormData({...tankFormData, current_gallons: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={tankFormData.notes}
                  onChange={(e) => setTankFormData({...tankFormData, notes: e.target.value})}
                  placeholder="Optional notes..."
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowEditTank(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTankMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {updateTankMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Tank Dialog */}
        <Dialog open={showAddTank} onOpenChange={setShowAddTank}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Storage Tank</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddTank} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Market</Label>
                <Select
                  value={tankFormData.market}
                  onValueChange={(value) => setTankFormData({...tankFormData, market: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select market" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_MARKETS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Facility Name</Label>
                <Input
                  value={tankFormData.facility_name}
                  onChange={(e) => setTankFormData({...tankFormData, facility_name: e.target.value})}
                  placeholder="e.g., Rancho Dominguez"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Tank Number/Name</Label>
                <Input
                  value={tankFormData.tank_number}
                  onChange={(e) => setTankFormData({...tankFormData, tank_number: e.target.value})}
                  placeholder="e.g., Tank 1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Capacity (Gallons)</Label>
                <Input
                  type="number"
                  value={tankFormData.capacity_gallons}
                  onChange={(e) => setTankFormData({...tankFormData, capacity_gallons: e.target.value})}
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Product Type</Label>
                <Select
                  value={tankFormData.product_type}
                  onValueChange={(value) => setTankFormData({...tankFormData, product_type: value})}
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
                <Label>Current Level (Gallons)</Label>
                <Input
                  type="number"
                  value={tankFormData.current_gallons}
                  onChange={(e) => setTankFormData({...tankFormData, current_gallons: e.target.value})}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={tankFormData.notes}
                  onChange={(e) => setTankFormData({...tankFormData, notes: e.target.value})}
                  placeholder="Optional notes..."
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowAddTank(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTankMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {createTankMutation.isPending ? 'Saving...' : 'Add Tank'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Transaction Dialog */}
        <Dialog open={showTransaction} onOpenChange={setShowTransaction}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {transactionType === 'truck_in' ? (
                  <>
                    <ArrowDownToLine className="w-5 h-5 text-green-600" />
                    Truck In (Receiving)
                  </>
                ) : (
                  <>
                    <ArrowUpFromLine className="w-5 h-5 text-red-600" />
                    Truck Out (Shipping)
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedTank && (
              <form onSubmit={handleTransaction} className="space-y-4 mt-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-bold text-slate-900">{selectedTank.tank_number}</div>
                  <div className="text-sm text-slate-600">
                    {selectedTank.facility_name} • {selectedTank.product_type}
                  </div>
                  <div className="text-sm text-slate-600">
                    Current Level: {(selectedTank.current_gallons || 0).toLocaleString()} gal
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={transactionFormData.transaction_date}
                      onChange={(e) => setTransactionFormData({...transactionFormData, transaction_date: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gallons *</Label>
                    <Input
                      type="number"
                      value={transactionFormData.gallons}
                      onChange={(e) => setTransactionFormData({...transactionFormData, gallons: e.target.value})}
                      placeholder="0"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Truck #</Label>
                    <Input
                      value={transactionFormData.truck_number}
                      onChange={(e) => setTransactionFormData({...transactionFormData, truck_number: e.target.value})}
                      placeholder="Truck number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>BOL #</Label>
                    <Input
                      value={transactionFormData.bol_number}
                      onChange={(e) => setTransactionFormData({...transactionFormData, bol_number: e.target.value})}
                      placeholder="Bill of Lading"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Driver Name</Label>
                  <Input
                    value={transactionFormData.driver_name}
                    onChange={(e) => setTransactionFormData({...transactionFormData, driver_name: e.target.value})}
                    placeholder="Driver name"
                  />
                </div>

                {transactionType === 'truck_in' ? (
                  <div className="space-y-2">
                    <Label>Supplier</Label>
                    <Input
                      value={transactionFormData.supplier}
                      onChange={(e) => setTransactionFormData({...transactionFormData, supplier: e.target.value})}
                      placeholder="Supplier name"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Customer</Label>
                      <Input
                        value={transactionFormData.customer}
                        onChange={(e) => setTransactionFormData({...transactionFormData, customer: e.target.value})}
                        placeholder="Customer name"
                      />
                    </div>
                    <div className="flex items-center space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <Checkbox
                        id="used_carrier"
                        checked={transactionFormData.used_carrier}
                        onCheckedChange={(checked) => setTransactionFormData({...transactionFormData, used_carrier: checked})}
                      />
                      <Label htmlFor="used_carrier" className="cursor-pointer text-sm font-medium text-amber-900">
                        Used Carrier (3rd party hauler)
                      </Label>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={transactionFormData.notes}
                    onChange={(e) => setTransactionFormData({...transactionFormData, notes: e.target.value})}
                    placeholder="Optional notes..."
                    rows={2}
                  />
                </div>

                {transactionFormData.gallons && (
                  <div className={`p-3 rounded-lg border-2 ${
                    transactionType === 'truck_in' 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="text-sm font-medium">
                      New Tank Level: {(
                        transactionType === 'truck_in'
                          ? (selectedTank.current_gallons || 0) + parseFloat(transactionFormData.gallons || 0)
                          : (selectedTank.current_gallons || 0) - parseFloat(transactionFormData.gallons || 0)
                      ).toLocaleString()} gal
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowTransaction(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTransactionMutation.isPending}
                    className={transactionType === 'truck_in' 
                      ? 'bg-gradient-to-r from-green-600 to-green-700' 
                      : 'bg-gradient-to-r from-red-600 to-red-700'
                    }
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {createTransactionMutation.isPending ? 'Saving...' : 'Record Transaction'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="tanks" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="tanks" className="flex items-center gap-2">
              <Warehouse className="w-4 h-4" />
              Tank Levels
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Transaction History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tanks" className="space-y-6">
            {Object.keys(tanksByFacility).length === 0 ? (
              <Card className="shadow-md border-slate-200">
                <CardContent className="p-12 text-center">
                  <Warehouse className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">No Storage Tanks</h3>
                  <p className="text-slate-600 mb-6">Add your first storage tank to start tracking</p>
                  <Button onClick={() => setShowAddTank(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Tank
                  </Button>
                </CardContent>
              </Card>
            ) : (
              Object.entries(tanksByFacility).map(([facility, facilityTanks]) => (
                <Card key={facility} className="shadow-lg border-2 border-purple-200">
                  <CardHeader className="border-b border-purple-100 bg-purple-50">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                        <Warehouse className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-slate-900">{facility}</CardTitle>
                        <p className="text-sm text-slate-600">{facilityTanks.length} tanks</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="grid md:grid-cols-3 gap-6">
                      {facilityTanks.map((tank) => {
                        const fillPercentage = tank.capacity_gallons 
                          ? Math.round((tank.current_gallons / tank.capacity_gallons) * 100) 
                          : 0;
                        const summary = getMonthSummary(tank.id);

                        return (
                          <Card key={tank.id} className="border-2 border-slate-200 hover:shadow-lg transition-shadow">
                            <CardContent className="p-5">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h3 className="font-bold text-xl text-slate-900">{tank.tank_number}</h3>
                                  {tank.product_type && (
                                    <Badge className={`${getProductColor(tank.product_type)} border mt-1`}>
                                      {tank.product_type}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditTank(tank)}
                                    className="h-8 w-8"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteTank(tank)}
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-3 mb-4">
                                <div className="flex items-center gap-2">
                                  <Droplet className="w-5 h-5 text-blue-600" />
                                  <span className="text-2xl font-bold text-slate-900">
                                    {(tank.current_gallons || 0).toLocaleString()}
                                  </span>
                                  <span className="text-slate-500">gal</span>
                                </div>

                                <div className="w-full bg-slate-200 rounded-full h-3">
                                  <div 
                                    className={`h-3 rounded-full transition-all duration-300 ${
                                      fillPercentage > 80 ? 'bg-emerald-500' :
                                      fillPercentage > 50 ? 'bg-blue-500' :
                                      fillPercentage > 20 ? 'bg-yellow-500' :
                                      'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(fillPercentage, 100)}%` }}
                                  />
                                </div>
                                <p className="text-xs text-slate-500">
                                  {fillPercentage}% of {(tank.capacity_gallons || 0).toLocaleString()} gal capacity
                                </p>
                              </div>

                              {summary.count > 0 && (
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-4 text-sm">
                                  <div className="font-semibold text-slate-700 mb-1">This Month:</div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="text-green-700">In: +{summary.totalIn.toLocaleString()}</div>
                                    <div className="text-red-700">Out: -{summary.totalOut.toLocaleString()}</div>
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => openTransaction(tank, 'truck_in')}
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                  <ArrowDownToLine className="w-4 h-4 mr-1" />
                                  In
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => openTransaction(tank, 'truck_out')}
                                  className="flex-1 bg-red-600 hover:bg-red-700"
                                >
                                  <ArrowUpFromLine className="w-4 h-4 mr-1" />
                                  Out
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setHistoryMonth(subMonths(historyMonth, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-lg font-semibold text-slate-900 min-w-[200px] text-center">
                  {format(historyMonth, 'MMMM yyyy')}
                </span>
                <Button variant="outline" size="icon" onClick={() => setHistoryMonth(addMonths(historyMonth, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <Button
                onClick={exportTransactionsToCSV}
                disabled={monthTransactions.length === 0}
                className="bg-gradient-to-r from-emerald-600 to-emerald-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>

            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-xl font-bold text-slate-900">
                  Transactions ({monthTransactions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {monthTransactions.length === 0 ? (
                  <div className="p-12 text-center">
                    <History className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">No Transactions</h3>
                    <p className="text-slate-600">No truck movements recorded for this month</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {monthTransactions.map((tx) => (
                      <div key={tx.id} className="p-4 hover:bg-slate-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              tx.transaction_type === 'truck_in' 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-red-100 text-red-600'
                            }`}>
                              {tx.transaction_type === 'truck_in' 
                                ? <ArrowDownToLine className="w-5 h-5" /> 
                                : <ArrowUpFromLine className="w-5 h-5" />
                              }
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">
                                {tx.tank_number} - {tx.transaction_type === 'truck_in' ? 'Received' : 'Shipped'}
                              </div>
                              <div className="text-sm text-slate-600">
                                {format(parseISO(tx.transaction_date), 'MMM d, yyyy')}
                                {tx.truck_number && ` • Truck ${tx.truck_number}`}
                                {tx.bol_number && ` • BOL ${tx.bol_number}`}
                              </div>
                              {(tx.customer || tx.supplier) && (
                                <div className="text-sm text-slate-500">
                                  {tx.transaction_type === 'truck_in' ? tx.supplier : tx.customer}
                                  {tx.used_carrier && (
                                    <Badge className="ml-2 bg-amber-100 text-amber-800 border-amber-200">
                                      Carrier
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-xl font-bold ${
                              tx.transaction_type === 'truck_in' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {tx.transaction_type === 'truck_in' ? '+' : '-'}{(tx.gallons || 0).toLocaleString()}
                            </div>
                            <div className="text-sm text-slate-500">gallons</div>
                            <Badge className={`${getProductColor(tx.product_type)} border mt-1`}>
                              {tx.product_type}
                            </Badge>
                            <TransactionRowActions tx={tx} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}