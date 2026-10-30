import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Droplet, LayoutDashboard, Ship, FileText, Calendar, Menu, Package, Layers, Users, Droplets, Anchor, UserCheck, Wrench, TrendingUp, Briefcase, BarChart3, Settings, Mail, Warehouse, Truck, Calendar as CalendarIcon, AlertTriangle, CheckCircle, LogOut, RefreshCw, Clock, Fuel } from "lucide-react";
import RegionSwitcher from "@/components/region/RegionSwitcher";
import { useRegion } from "@/lib/RegionContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const navigationGroups = [
  {
    label: "Calendars",
    icon: CalendarIcon,
    items: [
      { title: "Barge Calendar", url: createPageUrl("Calendar"), icon: Ship, pageName: "Calendar" },
      { title: "Trucking Calendar", url: createPageUrl("TruckDispatch"), icon: Truck, pageName: "TruckDispatch" },
      { title: "Fuel Dock Calendar", url: createPageUrl("FuelDockDeliveries"), icon: Warehouse, pageName: "FuelDockDeliveries" },
      { title: "Recurring Orders", url: createPageUrl("RecurringOrders"), icon: RefreshCw, pageName: "RecurringOrders" },
    ]
  },
  {
    label: "Staffing",
    icon: Users,
    items: [
      { title: "Crewing", url: createPageUrl("Crewing"), icon: UserCheck, pageName: "Crewing" },
      { title: "USCG Crew Compliance", url: createPageUrl("CrewCompliance"), icon: AlertTriangle, pageName: "CrewCompliance" },
    ]
  },
  {
    label: "Marine Ops",
    icon: Briefcase,
    items: [
      { title: "Barge Dispatch", url: createPageUrl("Deliveries"), icon: Anchor, pageName: "Deliveries" },
      { title: "Fuel Dock Dispatch", url: createPageUrl("FuelDockDispatch"), icon: Warehouse, pageName: "FuelDockDispatch" },
      { title: "My Deliveries", url: createPageUrl("TankermanDeliveries"), icon: Ship, pageName: "TankermanDeliveries" },
      { title: "Loading Events", url: createPageUrl("LoadingEvents"), icon: Droplets, pageName: "LoadingEvents" },
    ]
  },
  {
    label: "Trucking Ops",
    icon: Package,
    items: [
      { title: "Dispatch", url: createPageUrl("TruckingDispatch"), icon: Truck, pageName: "TruckingDispatch" },
      { title: "Route Sheets", url: createPageUrl("RouteSheets"), icon: FileText, pageName: "RouteSheets" },
    ]
  },
  {
    label: "Inventory",
    icon: Layers,
    items: [
      { title: "Tank Levels", url: createPageUrl("Inventory"), icon: Layers, pageName: "Inventory" },
      { title: "Rolling Inventory", url: createPageUrl("RollingInventory"), icon: TrendingUp, pageName: "RollingInventory" },
      { title: "Reconciliation", url: createPageUrl("ReconciliationReport"), icon: FileText, pageName: "ReconciliationReport" },
      { title: "Barge Transfers", url: createPageUrl("BargeTransfers"), icon: Ship, pageName: "BargeTransfers" },
      { title: "Terminals", url: createPageUrl("Terminals"), icon: Droplets, pageName: "Terminals" },
      { title: "Storage Tanks", url: createPageUrl("StorageTanks"), icon: Droplets, pageName: "StorageTanks" },
      { title: "Fuel Dock Tanks", url: createPageUrl("FuelDockTanks"), icon: Fuel, pageName: "FuelDockTanks" },
    ]
  },
  {
    label: "Fleet",
    icon: Ship,
    items: [
      { title: "Barges", url: createPageUrl("Fleet"), icon: Ship, pageName: "Fleet" },
      { title: "Tugs", url: createPageUrl("Tugs"), icon: Anchor, pageName: "Tugs" },
      { title: "Trucks", url: createPageUrl("Trucks"), icon: Truck, pageName: "Trucks" },
      { title: "Trailers", url: createPageUrl("Trailers"), icon: Truck, pageName: "Trailers" },
    ]
  },
  {
    label: "Analytics",
    icon: BarChart3,
    items: [
      { title: "Marine KPIs", url: createPageUrl("DailyOps"), icon: TrendingUp, pageName: "DailyOps" },
      { title: "CapEx Budget", url: createPageUrl("CapExBudget"), icon: TrendingUp, pageName: "CapExBudget" },
      { title: "Reports", url: createPageUrl("Reports"), icon: FileText, pageName: "Reports" },
      { title: "Monthly Barge Report", url: createPageUrl("MonthlyBargeReport"), icon: FileText, pageName: "MonthlyBargeReport" },
      { title: "Daily Recap", url: createPageUrl("DailyRecap"), icon: Mail, pageName: "DailyRecap" },
    ]
  },
  {
    label: "Settings",
    icon: Settings,
    items: [
      { title: "Products", url: createPageUrl("Products"), icon: Package, pageName: "Products" },
      { title: "Crew Management", url: createPageUrl("CrewManagement"), icon: UserCheck, pageName: "CrewManagement" },
      { title: "Email Notifications", url: createPageUrl("EmailNotifications"), icon: Mail, pageName: "EmailNotifications" },
      { title: "Users", url: createPageUrl("UserManagement"), icon: Users, pageName: "UserManagement" },
    ]
  }
];

export default function Layout({ children, currentPageName }) {
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  const [currentPath, setCurrentPath] = React.useState(window.location.pathname);
  const { region } = useRegion();

  React.useEffect(() => {
    document.documentElement.setAttribute('data-region-theme', region || 'all');
  }, [region]);

  React.useEffect(() => {
    document.title = "MyBarge";
    base44.auth.me().then(setUser).catch(() => {});
    
    // Track path changes
    const handlePathChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);

  // Legacy page name map for backwards compatibility
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

  // Check if user has access to a specific page
  const hasPageAccess = (pageName) => {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admins have access to everything
    
    const allowedPages = user.allowed_pages || [];
    // Normalize legacy names to current page keys
    const normalizedPages = allowedPages.map(p => legacyPageNameMap[p] || p);
    return normalizedPages.includes(pageName);
  };

  // Check if user has access to current page
  React.useEffect(() => {
    if (user && currentPageName && !hasPageAccess(currentPageName)) {
      // Find first page user has access to
      const allowedPages = user.allowed_pages || [];
      if (allowedPages.length > 0) {
        // Redirect to first allowed page
        const firstAllowedPage = allowedPages[0];
        navigate(createPageUrl(firstAllowedPage));
      } else {
        // No access to any pages - show error or logout
        alert('You do not have access to any pages. Please contact an administrator.');
        base44.auth.logout();
      }
    }
  }, [user, currentPageName, navigate]);

  // Filter navigation items based on user permissions
  const filteredNavigationGroups = navigationGroups.map(group => ({
    ...group,
    items: group.items.filter(item => hasPageAccess(item.pageName))
  })).filter(group => group.items.length > 0); // Remove empty groups

  return (
    <>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-gradient-to-br from-brand-soft to-brand-muted transition-colors duration-500">
          <Sidebar className="border-r border-brand-muted bg-white">
            <SidebarHeader className="border-b border-brand-muted p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-brand to-brand-strong rounded-xl flex items-center justify-center shadow-lg">
                  <Droplet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">MyBarge</h2>
                  <p className="text-xs text-slate-500">Delivery Management</p>
                </div>
              </div>
              <div className="mt-4">
                <RegionSwitcher />
              </div>
            </SidebarHeader>
            
            <SidebarContent className="p-3">
              {/* Dashboard */}
              {hasPageAccess('Dashboard') && (
                <SidebarGroup>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton 
                          asChild 
                          className={`hover:bg-brand-soft hover:text-brand-text transition-all duration-200 rounded-xl mb-1 ${
                            currentPath === createPageUrl("Dashboard") ? 'bg-brand-soft text-brand-text font-medium shadow-sm' : 'text-slate-700'
                          }`}
                        >
                          <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3 px-4 py-3">
                            <LayoutDashboard className="w-5 h-5" />
                            <span>Dashboard</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}

              {/* Sales Orders */}
              {hasPageAccess('SalesOrders') && (
                <SidebarGroup>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton 
                          asChild 
                          className={`hover:bg-brand-soft hover:text-brand-text transition-all duration-200 rounded-xl mb-1 ${
                            currentPath === createPageUrl("SalesOrders") ? 'bg-brand-soft text-brand-text font-medium shadow-sm' : 'text-slate-700'
                          }`}
                        >
                          <Link to={createPageUrl("SalesOrders")} className="flex items-center gap-3 px-4 py-3">
                            <FileText className="w-5 h-5" />
                            <span>Sales Orders</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}

              {/* Collapsible Groups - Filtered by permissions */}
              {filteredNavigationGroups.map((group) => (
                <Collapsible key={group.label} defaultOpen className="group/collapsible">
                  <SidebarGroup>
                    <SidebarGroupLabel asChild>
                      <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 hover:text-slate-700 transition-colors">
                        <div className="flex items-center gap-2">
                          <group.icon className="w-4 h-4" />
                          {group.label}
                        </div>
                        <ChevronDown className="w-4 h-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                      </CollapsibleTrigger>
                    </SidebarGroupLabel>
                    <CollapsibleContent>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {group.items.map((item) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton 
                                asChild 
                                className={`hover:bg-brand-soft hover:text-brand-text transition-all duration-200 rounded-xl mb-1 ${
                                  currentPath === item.url ? 'bg-brand-soft text-brand-text font-medium shadow-sm' : 'text-slate-700'
                                }`}
                              >
                                <Link to={item.url} className="flex items-center gap-3 px-4 py-2">
                                  <item.icon className="w-4 h-4" />
                                  <span className="text-sm">{item.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </CollapsibleContent>
                  </SidebarGroup>
                </Collapsible>
              ))}

            </SidebarContent>

            <SidebarFooter className="border-t border-brand-muted p-4">
              {user && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-brand to-brand-strong rounded-full flex items-center justify-center shadow-md">
                      <span className="text-white font-semibold text-sm">
                        {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm truncate">{user.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.position || user.role}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full text-sm"
                    onClick={() => base44.auth.logout()}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              )}
            </SidebarFooter>
          </Sidebar>

          <main className="flex-1 flex flex-col">
            <header className="bg-white border-b border-brand-muted px-6 py-4 lg:hidden shadow-sm">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="hover:bg-brand-muted p-2 rounded-lg transition-colors duration-200">
                  <Menu className="w-5 h-5" />
                </SidebarTrigger>
                <h1 className="text-xl font-bold text-slate-900">MyBarge</h1>
              </div>
            </header>

            <div className="flex-1 overflow-auto">
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </>
  );
}