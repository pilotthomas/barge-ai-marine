/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import BargeTransfers from './pages/BargeTransfers';
import Calendar from './pages/Calendar';
import CapExBudget from './pages/CapExBudget';
import ComplianceCalendar from './pages/ComplianceCalendar';
import ComplianceCalendarView from './pages/ComplianceCalendarView';
import CrewManagement from './pages/CrewManagement';
import Crewing from './pages/Crewing';
import DailyOps from './pages/DailyOps';
import DailyRecap from './pages/DailyRecap';
import Dashboard from './pages/Dashboard';
import Deliveries from './pages/Deliveries';
import Dispatches from './pages/Dispatches';
import EmailNotifications from './pages/EmailNotifications';
import Fleet from './pages/Fleet';
import FuelDockDeliveries from './pages/FuelDockDeliveries';
import FuelDockDispatch from './pages/FuelDockDispatch';
import Home from './pages/Home';
import Inventory from './pages/Inventory';
import LoadingEvents from './pages/LoadingEvents';
import Maintenance from './pages/Maintenance';
import MonthlyBargeReport from './pages/MonthlyBargeReport';
import Products from './pages/Products';
import ReconciliationReport from './pages/ReconciliationReport';
import RecurringOrders from './pages/RecurringOrders';
import Reports from './pages/Reports';
import RollingInventory from './pages/RollingInventory';
import RouteSheets from './pages/RouteSheets';
import SalesOrders from './pages/SalesOrders';
import ScheduledInspections from './pages/ScheduledInspections';
import StorageTanks from './pages/StorageTanks';
import TankermanDeliveries from './pages/TankermanDeliveries';
import Terminals from './pages/Terminals';
import Trailers from './pages/Trailers';
import TruckDispatch from './pages/TruckDispatch';
import TruckingDispatch from './pages/TruckingDispatch';
import Trucks from './pages/Trucks';
import Tugs from './pages/Tugs';
import UserManagement from './pages/UserManagement';
import VesselComplianceDates from './pages/VesselComplianceDates';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BargeTransfers": BargeTransfers,
    "Calendar": Calendar,
    "CapExBudget": CapExBudget,
    "ComplianceCalendar": ComplianceCalendar,
    "ComplianceCalendarView": ComplianceCalendarView,
    "CrewManagement": CrewManagement,
    "Crewing": Crewing,
    "DailyOps": DailyOps,
    "DailyRecap": DailyRecap,
    "Dashboard": Dashboard,
    "Deliveries": Deliveries,
    "Dispatches": Dispatches,
    "EmailNotifications": EmailNotifications,
    "Fleet": Fleet,
    "FuelDockDeliveries": FuelDockDeliveries,
    "FuelDockDispatch": FuelDockDispatch,
    "Home": Home,
    "Inventory": Inventory,
    "LoadingEvents": LoadingEvents,
    "Maintenance": Maintenance,
    "MonthlyBargeReport": MonthlyBargeReport,
    "Products": Products,
    "ReconciliationReport": ReconciliationReport,
    "RecurringOrders": RecurringOrders,
    "Reports": Reports,
    "RollingInventory": RollingInventory,
    "RouteSheets": RouteSheets,
    "SalesOrders": SalesOrders,
    "ScheduledInspections": ScheduledInspections,
    "StorageTanks": StorageTanks,
    "TankermanDeliveries": TankermanDeliveries,
    "Terminals": Terminals,
    "Trailers": Trailers,
    "TruckDispatch": TruckDispatch,
    "TruckingDispatch": TruckingDispatch,
    "Trucks": Trucks,
    "Tugs": Tugs,
    "UserManagement": UserManagement,
    "VesselComplianceDates": VesselComplianceDates,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};