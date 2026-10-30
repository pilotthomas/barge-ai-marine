import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Users, Shield, Mail, Phone, Save, AlertCircle, Search, Filter, MapPin, Lock, Key, UserPlus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";

// All available pages in the system (must match actual page file names)
const availablePages = [
  "Dashboard",
  "SalesOrders",
  "Calendar",
  "TruckDispatch",
  "FuelDockDeliveries",
  "RecurringOrders",
  "Deliveries",
  "FuelDockDispatch",
  "TruckingDispatch",
  "RouteSheets",
  "TankermanDeliveries",
  "LoadingEvents",
  "Crewing",
  "CrewCompliance",
  "Inventory",
  "RollingInventory",
  "ReconciliationReport",
  "BargeTransfers",
  "Terminals",
  "StorageTanks",
  "Fleet",
  "Tugs",
  "Trailers",
  "Trucks",
  "DailyOps",
  "CapExBudget",
  "Reports",
  "MonthlyBargeReport",
  "DailyRecap",
  "Products",
  "CrewManagement",
  "EmailNotifications",
  "UserManagement",
  "FuelDockTanks"
];

// Display names for the pages (for UI)
const pageDisplayNames = {
  "Dashboard": "Dashboard",
  "SalesOrders": "Sales Orders",
  "Calendar": "Calendar",
  "TruckDispatch": "Truck Dispatch",
  "FuelDockDeliveries": "Fuel Dock Deliveries",
  "RecurringOrders": "Recurring Orders",
  "Deliveries": "Deliveries",
  "FuelDockDispatch": "Fuel Dock Dispatch",
  "TruckingDispatch": "Trucking Dispatch",
  "RouteSheets": "Route Sheets",
  "TankermanDeliveries": "My Deliveries",
  "LoadingEvents": "Loading Events",
  "Crewing": "Crewing",
  "CrewCompliance": "USCG Crew Compliance",
  "Inventory": "Tank Levels",
  "RollingInventory": "Rolling Inventory",
  "ReconciliationReport": "Reconciliation",
  "BargeTransfers": "Barge Transfers",
  "Terminals": "Terminals",
  "StorageTanks": "Storage Tanks",
  "Fleet": "Barges",
  "Tugs": "Tugs",
  "Trailers": "Trailers",
  "Trucks": "Trucks",
  "VesselComplianceDates": "Vessel Compliance Dates",
  "ScheduledInspections": "Scheduled Inspections",
  "Maintenance": "Maintenance",
  "ComplianceCalendarView": "Calendar View",
  "DailyOps": "Marine KPIs",
  "CapExBudget": "CapEx Budget",
  "Reports": "Reports",
  "MonthlyBargeReport": "Monthly Barge Report",
  "DailyRecap": "Daily Recap",
  "Products": "Products",
  "CrewManagement": "Crew Management",
  "EmailNotifications": "Email Notifications",
  "UserManagement": "Users",
  "CrewHoursCalendar": "Crew Hours",
  "FuelDockTanks": "Fuel Dock Tanks"
};

const positionColors = {
  dispatch: "bg-orange-100 text-orange-800 border-orange-200",
  management: "bg-red-100 text-red-800 border-red-200",
  billing: "bg-purple-100 text-purple-800 border-purple-200",
  supply_chain: "bg-emerald-100 text-emerald-800 border-emerald-200",
  vessel_crew: "bg-blue-100 text-blue-800 border-blue-200",
  drivers: "bg-teal-100 text-teal-800 border-teal-200",
  sales: "bg-green-100 text-green-800 border-green-200"
};

// Role-based default page permissions (using actual page names)
const roleDefaultPages = {
  dispatch: [
    "Dashboard", "SalesOrders",
    "Calendar", "TruckDispatch", "FuelDockDeliveries", "RecurringOrders",
    "Deliveries", "FuelDockDispatch", "TankermanDeliveries", "LoadingEvents", "Crewing",
    "TruckingDispatch", "RouteSheets",
    "Inventory", "RollingInventory", "BargeTransfers", "FuelDockTanks",
    "Fleet", "Tugs", "Trucks", "Trailers",
    "VesselComplianceDates", "ScheduledInspections", "Maintenance", "ComplianceCalendarView",
    "DailyRecap"
  ],
  management: availablePages,
  billing: [
    "Dashboard", "SalesOrders",
    "Calendar", "TruckDispatch", "FuelDockDeliveries",
    "Deliveries", "FuelDockDispatch",
    "TruckingDispatch",
    "Inventory", "ReconciliationReport",
    "Fleet", "Tugs", "Trucks", "Trailers",
    "Reports", "MonthlyBargeReport"
  ],
  supply_chain: [
    "Dashboard", "SalesOrders",
    "Calendar", "TruckDispatch", "FuelDockDeliveries",
    "LoadingEvents",
    "Inventory", "RollingInventory", "ReconciliationReport", "BargeTransfers", "Terminals", "StorageTanks", "FuelDockTanks",
    "Fleet",
    "Reports",
    "Products"
  ],
  vessel_crew: [
    "Dashboard", "SalesOrders",
    "Calendar",
    "TankermanDeliveries", "Deliveries", "LoadingEvents",
    "Inventory",
    "Fleet",
    "VesselComplianceDates", "ScheduledInspections"
  ],
  drivers: [
    "Dashboard", "SalesOrders",
    "TruckDispatch",
    "RouteSheets",
    "Trucks"
  ],
  sales: [
    "Dashboard", "SalesOrders",
    "Calendar", "TruckDispatch", "FuelDockDeliveries",
    "Deliveries", "FuelDockDispatch",
    "TruckingDispatch",
    "RollingInventory",
    "Reports",
    "Products"
  ]
};

const marketColors = {
  "Long Beach": "bg-orange-100 text-orange-800 border-orange-200",
  "Oakland": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Portland": "bg-purple-100 text-purple-800 border-purple-200",
  "Seattle": "bg-blue-100 text-blue-800 border-blue-200"
};

// Helper function to capitalize names - handles periods, underscores, and spaces
const capitalizeName = (name) => {
  if (!name) return '';
  // Replace periods and underscores with spaces, then capitalize
  return name
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function UserManagement() {
  const [currentUser, setCurrentUser] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [marketFilter, setMarketFilter] = useState('all');
  const [editingPermissionsUser, setEditingPermissionsUser] = useState(null);
  const [selectedPages, setSelectedPages] = useState([]);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, position, market, role }) => {
      return base44.entities.User.update(userId, { position, market, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUserId(null);
      setSelectedPosition('');
      setSelectedMarket('');
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: ({ userId, allowed_pages }) => base44.entities.User.update(userId, { allowed_pages }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingPermissionsUser(null);
      setSelectedPages([]);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }) => base44.entities.User.update(userId, { password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setResetPasswordUser(null);
      setNewPassword('');
      setConfirmPassword('');
    },
  });

  const handleEditPosition = (user) => {
    setEditingUserId(user.id);
    setSelectedPosition(user.position || '');
    setSelectedMarket(user.market || '');
    setSelectedRole(user.role || 'user');
  };

  const handleSavePosition = (userId) => {
    updateUserMutation.mutate({ userId, position: selectedPosition, market: selectedMarket, role: selectedRole });
  };

  const handleCancel = () => {
    setEditingUserId(null);
    setSelectedPosition('');
    setSelectedMarket('');
    setSelectedRole('');
  };

  // Map from old display names to proper page keys (for migration)
  const legacyPageNameMap = {
    "Sales Orders": "SalesOrders",
    "Truck Dispatch": "TruckDispatch",
    "Fuel Dock Deliveries": "FuelDockDeliveries",
    "Fuel Dock Dispatch": "FuelDockDispatch",
    "Trucking Dispatch": "TruckingDispatch",
    "Route Sheets": "RouteSheets",
    "My Deliveries": "TankermanDeliveries",
    "My Loading Events": "LoadingEvents",
    "Loading Events": "LoadingEvents",
    "Tank Levels": "Inventory",
    "Rolling Inventory": "RollingInventory",
    "Reconciliation": "ReconciliationReport",
    "Barge Transfers": "BargeTransfers",
    "Storage Tanks": "StorageTanks",
    "Barges": "Fleet",
    "Vessel Compliance Dates": "VesselComplianceDates",
    "Scheduled Inspections": "ScheduledInspections",
    "Calendar View": "ComplianceCalendarView",
    "Marine KPIs": "DailyOps",
    "CapEx Budget": "CapExBudget",
    "Monthly Barge Report": "MonthlyBargeReport",
    "Daily Recap": "DailyRecap",
    "Crew Management": "CrewManagement",
    "Email Notifications": "EmailNotifications",
    "Users": "UserManagement",
  };

  const normalizePagesArray = (pages) => {
    if (!pages) return [];
    const normalized = pages.map(p => legacyPageNameMap[p] || p);
    // Deduplicate
    return [...new Set(normalized)].filter(p => availablePages.includes(p));
  };

  const handleOpenPermissions = (user) => {
    setEditingPermissionsUser(user);
    setSelectedPages(normalizePagesArray(user.allowed_pages));
  };

  const handleTogglePage = (pageName) => {
    if (selectedPages.includes(pageName)) {
      setSelectedPages(selectedPages.filter(p => p !== pageName));
    } else {
      setSelectedPages([...selectedPages, pageName]);
    }
  };

  const handleApplyRoleDefaults = () => {
    const position = editingPermissionsUser?.position;
    if (position && roleDefaultPages[position]) {
      setSelectedPages([...roleDefaultPages[position]]);
    }
  };

  const handleSavePermissions = () => {
    updatePermissionsMutation.mutate({
      userId: editingPermissionsUser.id,
      allowed_pages: selectedPages
    });
  };

  const handleSelectAllPages = () => {
    setSelectedPages([...availablePages]);
  };

  const handleClearAllPages = () => {
    setSelectedPages([]);
  };

  const handleOpenResetPassword = (user) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleResetPassword = () => {
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }
    resetPasswordMutation.mutate({
      userId: resetPasswordUser.id,
      password: newPassword
    });
  };

  // Filter users based on search and filters
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesPosition = positionFilter === 'all' || user.position === positionFilter;
    const matchesMarket = marketFilter === 'all' || user.market === marketFilter;
    
    return matchesSearch && matchesRole && matchesPosition && matchesMarket;
  });

  // Check if current user is admin
  if (!currentUser) {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
        <Card className="max-w-md shadow-lg border-slate-200">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h3>
            <p className="text-slate-600">Only administrators can access user management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              User Management
            </h1>
            <p className="text-slate-600">Assign positions, markets, and page permissions</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => { setInviteEmail(''); setInviteRole('user'); setShowInviteDialog(true); }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </Button>
            <Badge className="bg-red-100 text-red-800 border-red-200">
              <Shield className="w-4 h-4 mr-1" />
              Admin Only
            </Badge>
          </div>
        </div>

        {/* Invite User Dialog */}
        <Dialog open={showInviteDialog} onOpenChange={(open) => !open && setShowInviteDialog(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Invite User
              </DialogTitle>
              <DialogDescription>
                Send an invitation email to add a new user to the app.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="invite_email">Email Address *</Label>
                <Input
                  id="invite_email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite_role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
                <Button
                  disabled={!inviteEmail || inviting}
                  onClick={async () => {
                    setInviting(true);
                    try {
                      await base44.users.inviteUser(inviteEmail.trim().toLowerCase(), inviteRole);
                      alert(`Invitation sent to ${inviteEmail}`);
                      setShowInviteDialog(false);
                      queryClient.invalidateQueries({ queryKey: ['users'] });
                    } catch (err) {
                      alert('Failed to send invite: ' + (err?.message || 'Unknown error'));
                    } finally {
                      setInviting(false);
                    }
                  }}
                  className="bg-gradient-to-r from-blue-600 to-blue-700"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {inviting ? 'Sending...' : 'Send Invite'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Permissions Dialog */}
        <Dialog open={!!editingPermissionsUser} onOpenChange={(open) => !open && setEditingPermissionsUser(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900">
                Page Access for {editingPermissionsUser && capitalizeName(editingPermissionsUser.full_name)}
              </DialogTitle>
            </DialogHeader>
            {editingPermissionsUser && (
              <div className="space-y-4 mt-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Select which pages this user can access. Admins always have full access. Sales Orders and Calendar are always accessible.
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllPages}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAllPages}
                  >
                    Clear All
                  </Button>
                  {editingPermissionsUser?.position && roleDefaultPages[editingPermissionsUser.position] && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleApplyRoleDefaults}
                      className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    >
                      Apply {editingPermissionsUser.position.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Defaults
                    </Button>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                {availablePages.map((pageName) => (
                  <div key={pageName} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded">
                    <Checkbox
                      id={pageName}
                      checked={selectedPages.includes(pageName)}
                      onCheckedChange={() => handleTogglePage(pageName)}
                    />
                    <Label
                      htmlFor={pageName}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {pageDisplayNames[pageName] || pageName}
                    </Label>
                  </div>
                ))}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setEditingPermissionsUser(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSavePermissions}
                    disabled={updatePermissionsMutation.isPending}
                    className="bg-gradient-to-r from-blue-600 to-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updatePermissionsMutation.isPending ? 'Saving...' : 'Save Permissions'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={!!resetPasswordUser} onOpenChange={(open) => !open && setResetPasswordUser(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-6 h-6 text-orange-600" />
                Reset Password
              </DialogTitle>
              <DialogDescription>
                Set a new password for {resetPasswordUser && capitalizeName(resetPasswordUser.full_name)}
              </DialogDescription>
            </DialogHeader>
            {resetPasswordUser && (
              <div className="space-y-4 mt-4">
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>Security Note:</strong> Choose a strong password (minimum 6 characters). The user will be able to change it after logging in.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password *</Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm Password *</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    minLength={6}
                  />
                </div>

                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                    Passwords do not match
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResetPasswordUser(null);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleResetPassword}
                    disabled={
                      resetPasswordMutation.isPending || 
                      !newPassword || 
                      !confirmPassword || 
                      newPassword !== confirmPassword ||
                      newPassword.length < 6
                    }
                    className="bg-gradient-to-r from-orange-600 to-orange-700"
                  >
                    <Key className="w-4 h-4 mr-2" />
                    {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 py-6 text-lg border-slate-200"
            />
          </div>
          
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full md:w-48 py-6">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-400" />
                <SelectValue placeholder="All Roles" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>

          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-full md:w-48 py-6">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-400" />
                <SelectValue placeholder="All Positions" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Positions</SelectItem>
              <SelectItem value="dispatch">Dispatch</SelectItem>
              <SelectItem value="management">Management</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="supply_chain">Supply Chain</SelectItem>
              <SelectItem value="vessel_crew">Vessel Crew</SelectItem>
              <SelectItem value="drivers">Drivers</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
            </SelectContent>
          </Select>

          <Select value={marketFilter} onValueChange={setMarketFilter}>
            <SelectTrigger className="w-full md:w-48 py-6">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-slate-400" />
                <SelectValue placeholder="All Markets" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Markets</SelectItem>
              <SelectItem value="Long Beach">Long Beach</SelectItem>
              <SelectItem value="Oakland">Oakland</SelectItem>
              <SelectItem value="Portland">Portland</SelectItem>
              <SelectItem value="Seattle">Seattle</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900">
              Team Members ({filteredUsers.length} {filteredUsers.length !== users.length && `of ${users.length}`})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No users match the current filters</p>
                  {(searchTerm || roleFilter !== 'all' || positionFilter !== 'all' || marketFilter !== 'all') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        setSearchTerm('');
                        setRoleFilter('all');
                        setPositionFilter('all');
                        setMarketFilter('all');
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isEditing = editingUserId === user.id;
                  const isCurrentUser = user.id === currentUser.id;
                  const pageCount = user.allowed_pages?.length || 0;

                  return (
                    <div
                      key={user.id}
                      className="p-4 hover:bg-slate-50 transition-colors duration-200"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                            <span className="text-white font-semibold text-lg">
                              {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-xl text-slate-900">
                                {capitalizeName(user.full_name)}
                              </h3>
                              {isCurrentUser && (
                                <Badge variant="outline" className="text-xs">You</Badge>
                              )}
                            </div>
                            
                            {/* Role, Position, and Market Badges */}
                            <div className="flex flex-wrap gap-2 mb-2">
                              <Badge className={`border capitalize ${
                                user.role === 'admin'
                                  ? 'bg-red-100 text-red-800 border-red-200'
                                  : 'bg-slate-100 text-slate-800 border-slate-200'
                              }`}>
                                <Shield className="w-3 h-3 mr-1" />
                                {user.role}
                              </Badge>

                              {user.position && (
                                <Badge className={`${positionColors[user.position]} border`}>
                                  {user.position.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Badge>
                              )}

                              {user.market && (
                                <Badge className={`${marketColors[user.market]} border`}>
                                  <MapPin className="w-3 h-3 mr-1" />
                                  {user.market}
                                </Badge>
                              )}

                              <Badge variant="outline" className="border-slate-300">
                                <Lock className="w-3 h-3 mr-1" />
                                {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                              </Badge>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Mail className="w-4 h-4" />
                                <span className="truncate">{user.email}</span>
                              </div>
                              {user.phone && (
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                  <Phone className="w-4 h-4" />
                                  <span>{user.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 flex-shrink-0 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenPermissions(user)}
                            className="flex items-center gap-2"
                          >
                            <Lock className="w-4 h-4" />
                            Page Access
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenResetPassword(user)}
                            className="flex items-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                          >
                            <Key className="w-4 h-4" />
                            Reset Password
                          </Button>

                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to permanently delete ${capitalizeName(user.full_name)}? This action cannot be undone.`)) {
                                base44.entities.User.delete(user.id)
                                  .then(() => queryClient.invalidateQueries({ queryKey: ['users'] }))
                                  .catch((err) => alert('Failed to delete user: ' + err.message));
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>

                          {isEditing ? (
                            <div className="space-y-2 w-full">
                              <Select
                                value={selectedRole}
                                onValueChange={setSelectedRole}
                              >
                                <SelectTrigger className="w-40 h-9">
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>

                              <Select
                                value={selectedPosition}
                                onValueChange={setSelectedPosition}
                              >
                                <SelectTrigger className="w-40 h-9">
                                  <SelectValue placeholder="Select position" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="dispatch">Dispatch</SelectItem>
                                  <SelectItem value="management">Management</SelectItem>
                                  <SelectItem value="billing">Billing</SelectItem>
                                  <SelectItem value="supply_chain">Supply Chain</SelectItem>
                                  <SelectItem value="vessel_crew">Vessel Crew</SelectItem>
                                  <SelectItem value="drivers">Drivers</SelectItem>
                                  <SelectItem value="sales">Sales</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              <Select
                                value={selectedMarket}
                                onValueChange={setSelectedMarket}
                              >
                                <SelectTrigger className="w-40 h-9">
                                  <SelectValue placeholder="Select market" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={null}>All Markets</SelectItem>
                                  <SelectItem value="Long Beach">Long Beach</SelectItem>
                                  <SelectItem value="Oakland">Oakland</SelectItem>
                                  <SelectItem value="Portland">Portland</SelectItem>
                                  <SelectItem value="Seattle">Seattle</SelectItem>
                                </SelectContent>
                              </Select>

                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSavePosition(user.id)}
                                  disabled={updateUserMutation.isPending}
                                  className="bg-gradient-to-r from-blue-600 to-blue-700 w-full"
                                >
                                  <Save className="w-4 h-4 mr-1" />
                                  Save
                                </Button>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancel}
                                disabled={updateUserMutation.isPending}
                                className="w-full"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditPosition(user)}
                            >
                              Edit Details
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-slate-200 bg-blue-50">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-3">Access Control:</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <p>• <strong>Admins</strong> always have full access to all pages</p>
              <p>• <strong>Other users</strong> can only access pages you've granted them permission to</p>
              <p>• Click "Page Access" to customize which pages each user can view</p>
              <p>• Click "Reset Password" to set a new password for any user</p>
              <p>• Sales Orders and Calendar are always accessible to all users</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}