import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Ship, Calendar, Filter, AlertCircle, CheckCircle2, MapPin, Trash2, Edit2, ChevronDown, Clock } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import DispatchForm from "../components/dispatches/DispatchForm";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { sendDirectDispatchNotification, warnIfNotificationFailed, themeFor } from "@/lib/orderNotifications";
// Removed: import RecentDispatchList from "../components/dashboard/RecentDispatchList";

export default function Deliveries() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [activeSort, setActiveSort] = useState('asc');
  const [editingDelivery, setEditingDelivery] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [selectedBarge, setSelectedBarge] = useState('all');
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [deletingDelivery, setDeletingDelivery] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recentDeliveriesOpen, setRecentDeliveriesOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const formRef = React.useRef(null);

  // The page scrolls inside the layout container (not the window), so bring the form into view explicitly.
  React.useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showForm, editingDelivery]);

  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(user => {
      setCurrentUser(user);
      if (user.default_market) {
        setSelectedMarket(user.default_market);
      }
    }).catch(() => {});
  }, []);

  const { data: deliveries = [] } = useQuery({
    queryKey: ['dispatches'],
    queryFn: () => base44.entities.Dispatch.list('-created_date'),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

  const { data: salesOrders = [] } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => base44.entities.SalesOrder.list('-submitted_date'),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Filter pending sales orders by market, search, and month (only Barge deliveries)
  const pendingSalesOrders = salesOrders
    .filter(o => o.status === 'pending' && o.method_of_delivery === 'Barge')
    .filter(o => {
      // Market filter
      const matchesMarket = selectedMarket === 'all' || o.market === selectedMarket;
      
      // Search filter (check customer name, vessel name, destination)
      const matchesSearch = searchTerm === '' || 
        o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.vessel_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.destination?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Month filter (based on requested_date)
      let matchesMonth = selectedMonth === 'all';
      if (!matchesMonth && o.requested_date) {
        try {
          matchesMonth = o.requested_date.substring(0, 7) === selectedMonth;
        } catch (e) {
          console.error('Error matching month for order:', o.requested_date, e);
          matchesMonth = false;
        }
      }
      
      return matchesMarket && matchesSearch && matchesMonth;
    });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Dispatch.create(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      setShowForm(false);
      setEditingDelivery(null);
      // Barge orders entered directly on Barge Dispatch notify CA.Orders (non-delivery events do not).
      if (created && (created.event_type || 'delivery') === 'delivery') {
        sendDirectDispatchNotification({ type: 'Barge', dispatch: created }).then(warnIfNotificationFailed);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Dispatch.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      setShowForm(false);
      setEditingDelivery(null);
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }) => {
      const order = salesOrders.find(o => o.id === orderId);
      
      await base44.entities.SalesOrder.delete(orderId);
      
      try {
        // Get configured recipients for order deletions - check market-specific first
        const allSettings = await base44.entities.EmailNotificationSettings.filter({
          notification_type: 'order_deletion',
          is_active: true
        });
        
        let notificationSetting = allSettings.find(s => s.market === order.market);
        if (!notificationSetting || !notificationSetting.recipient_emails || notificationSetting.recipient_emails.length === 0) {
          notificationSetting = allSettings.find(s => (s.market || 'all') === 'all');
        }
        
        const recipients = notificationSetting?.recipient_emails || [];
        
        if (recipients.length === 0) {
          console.log('No recipients configured for order deletion notifications');
          return;
        }
        
        const productLinesText = order.product_lines && Array.isArray(order.product_lines)
          ? order.product_lines.map(line => 
              `<tr>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${line.product_type}</td>
                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;"><strong>${(line.requested_gallons || 0).toLocaleString()}</strong> gallons</td>
              </tr>`
            ).join('')
          : '';
        
        const totalGallons = order.product_lines && Array.isArray(order.product_lines)
          ? order.product_lines.reduce((sum, line) => sum + (line.requested_gallons || 0), 0)
          : 0;

        await base44.functions.invoke('sendEmail', {
          to: recipients.join(','),
          subject: `Sales Order Deleted: ${order.customer_name} - ${order.vessel_name}`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background-color: #7f1d1d; padding: 30px 20px; text-align: center; border-bottom: 4px solid #dc2626;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">✕ Sales Order Deleted</h1>
      <p style="color: #fca5a5; margin: 12px 0 0 0; font-size: 16px; font-weight: 600;">A sales order has been removed from the system</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px 20px;">
      
      <!-- Submitted By Section -->
      <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
        <p style="margin: 0; color: #0f172a; font-size: 14px; font-weight: 600;">Submitted by: ${order.submitted_by_name}</p>
        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">${format(parseISO(order.submitted_date), 'MMMM d, yyyy')}</p>
      </div>

      <!-- Order Details Section -->
      <div style="margin-bottom: 30px;">
        <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #dc2626;">Order Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 140px;">Customer</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${order.customer_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Vessel</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${order.vessel_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Destination</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${order.destination}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Market</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${order.market}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Delivery Method</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${order.method_of_delivery}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Requested Date</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${format(parseISO(order.requested_date), 'MMMM d, yyyy')}${order.requested_time ? ` at ${order.requested_time}` : ''}</td>
          </tr>
          ${order.is_hedged ? `
          <tr>
            <td colspan="2" style="padding: 12px 0;">
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 4px;">
                <span style="color: #92400e; font-weight: 600; font-size: 14px;">⚠ Hedged Order</span>
              </div>
            </td>
          </tr>
          ` : ''}
        </table>
      </div>

      ${productLinesText ? `
      <!-- Product Details Section -->
      <div style="margin-bottom: 30px;">
        <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #dc2626;">Product Details</h2>
        <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 6px; overflow: hidden;">
          ${productLinesText}
          ${totalGallons > 0 ? `
          <tr style="background-color: #fee2e2;">
            <td style="padding: 12px 8px; font-weight: bold; color: #0f172a;">Total Gallons</td>
            <td style="padding: 12px 8px; text-align: right; font-weight: bold; color: #991b1b; font-size: 18px;">${totalGallons.toLocaleString()}</td>
          </tr>
          ` : ''}
        </table>
      </div>
      ` : ''}

      <!-- Reason for Deletion Section -->
      <div style="margin-bottom: 30px;">
        <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #dc2626;">Reason for Deletion</h2>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 6px;">
          <p style="margin: 0; color: #0f172a; white-space: pre-wrap;">${reason}</p>
        </div>
      </div>

      <!-- Footer Message -->
      <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 16px; border-radius: 4px; margin-top: 30px;">
        <p style="margin: 0; color: #64748b; font-size: 13px;">This notification was sent to configured recipients in Email Notifications settings.</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; color: #64748b; font-size: 12px;">PTL Marine | Barge Delivery Management System</p>
    </div>

  </div>
</body>
</html>
          `
        });
      } catch (emailError) {
        console.error('Failed to send deletion notification email:', emailError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      setDeleteDialogOpen(false);
      setDeletingOrder(null);
      setDeleteReason('');
    },
    onError: (error) => {
      console.error('Failed to delete order:', error);
      alert('Failed to delete order. Please try again.');
    },
  });

  const deleteDeliveryMutation = useMutation({
    mutationFn: async ({ deliveryId, reason }) => {
      const delivery = deliveries.find(d => d.id === deliveryId);
      
      await base44.entities.Dispatch.delete(deliveryId);
      
      try {
        // Get configured recipients for delivery deletions - check market-specific first
        const allSettings = await base44.entities.EmailNotificationSettings.filter({
          notification_type: 'delivery_deletion',
          is_active: true
        });
        
        let notificationSetting = allSettings.find(s => s.market === delivery.market);
        if (!notificationSetting || !notificationSetting.recipient_emails || notificationSetting.recipient_emails.length === 0) {
          notificationSetting = allSettings.find(s => (s.market || 'all') === 'all');
        }
        
        const recipients = notificationSetting?.recipient_emails || [];
        
        if (recipients.length === 0) {
          console.log('No recipients configured for delivery deletion notifications');
          return;
        }
        
        await base44.functions.invoke('sendEmail', {
          to: recipients.join(','),
          subject: `Delivery Deleted: ${delivery.vessel_name}`,
          html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background-color: #7f1d1d; padding: 30px 20px; text-align: center; border-bottom: 4px solid #dc2626;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">✕ Delivery Deleted</h1>
      <p style="color: #fca5a5; margin: 12px 0 0 0; font-size: 16px; font-weight: 600;">A scheduled delivery has been removed from the system</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px 20px;">
      
      ${delivery.dispatched_by_name ? `
      <!-- Dispatched By Section -->
      <div style="background-color: #f0f9ff; border-left: 4px solid #0284c7; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
        <p style="margin: 0; color: #0f172a; font-size: 14px; font-weight: 600;">Dispatched by: ${delivery.dispatched_by_name}</p>
        ${delivery.dispatched_by_email ? `<p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">${delivery.dispatched_by_email}</p>` : ''}
      </div>
      ` : ''}

      <!-- Delivery Details Section -->
      <div style="margin-bottom: 30px;">
        <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #dc2626;">Delivery Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 140px;">Vessel</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${delivery.vessel_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Barge</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${delivery.barge_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Destination</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${delivery.destination}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Market</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${delivery.market}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Status</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${delivery.status}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Start Date</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${format(parseISO(delivery.start_date), 'MMMM d, yyyy')}${delivery.requested_delivery_time ? ` at ${delivery.requested_delivery_time}` : ''}</td>
          </tr>
          ${delivery.customer ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Customer</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${delivery.customer}</td>
          </tr>
          ` : ''}
          ${delivery.cargo_type ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Product</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${delivery.cargo_type}</td>
          </tr>
          ` : ''}
          ${delivery.gallons_delivered ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Gallons Delivered</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${delivery.gallons_delivered.toLocaleString()}</td>
          </tr>
          ` : ''}
          ${delivery.captain ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Captain</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${delivery.captain}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      <!-- Reason for Deletion Section -->
      <div style="margin-bottom: 30px;">
        <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #dc2626;">Reason for Deletion</h2>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 6px;">
          <p style="margin: 0; color: #0f172a; white-space: pre-wrap;">${reason}</p>
        </div>
      </div>

      <!-- Footer Message -->
      <div style="background-color: #f8fafc; border-left: 4px solid #64748b; padding: 16px; border-radius: 4px; margin-top: 30px;">
        <p style="margin: 0; color: #64748b; font-size: 13px;">This notification was sent to configured recipients in Email Notifications settings.</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; color: #64748b; font-size: 12px;">PTL Marine | Barge Delivery Management System</p>
    </div>

  </div>
</body>
</html>
          `
        });
      } catch (emailError) {
        console.error('Failed to send deletion notification email:', emailError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      setDeleteDialogOpen(false);
      setDeletingDelivery(null);
      setDeleteReason('');
    },
    onError: (error) => {
      console.error('Failed to delete delivery:', error);
      alert('Failed to delete delivery. Please try again.');
    },
  });

  const dispatchOrderMutation = useMutation({
    mutationFn: async ({ order, dispatchData, currentUser }) => {
      // Add dispatcher info to dispatch data
      const dispatchWithUser = {
        ...dispatchData,
        dispatched_by_name: currentUser?.full_name || '',
        dispatched_by_email: currentUser?.email || ''
      };
      
      const dispatch = await base44.entities.Dispatch.create(dispatchWithUser);
      
      await base44.entities.SalesOrder.update(order.id, {
        status: 'dispatched',
        dispatch_id: dispatch.id,
        dispatched_date: new Date().toISOString()
      });

      const totalGallons = order.product_lines && Array.isArray(order.product_lines)
        ? order.product_lines.reduce((sum, line) => sum + (line.requested_gallons || 0), 0)
        : 0;

      const productLinesText = order.product_lines && Array.isArray(order.product_lines)
        ? order.product_lines.map(line => 
            `   • ${line.product_type}: ${(line.requested_gallons || 0).toLocaleString()} gallons`
          ).join('\n')
        : '';

      // Get configured recipients from settings - check market-specific first, then default
      const allSettings = await base44.entities.EmailNotificationSettings.filter({
        notification_type: 'dispatch_confirmation',
        is_active: true
      });
      
      // Try to find market-specific setting first
      let notificationSetting = allSettings.find(s => s.market === order.market);
      
      // Fall back to "all markets" default if no market-specific setting
      if (!notificationSetting || !notificationSetting.recipient_emails || notificationSetting.recipient_emails.length === 0) {
        notificationSetting = allSettings.find(s => (s.market || 'all') === 'all');
      }
      
      const emailRecipients = [];
      
      // Add configured additional recipients
      if (notificationSetting && notificationSetting.recipient_emails) {
        notificationSetting.recipient_emails.forEach(email => {
          if (email && !emailRecipients.includes(email)) {
            emailRecipients.push(email);
          }
        });
      }

      const productLinesHtml = order.product_lines && Array.isArray(order.product_lines)
        ? order.product_lines.map(line => 
            `<tr>
              <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${line.product_type}</td>
              <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0;"><strong>${(line.requested_gallons || 0).toLocaleString()}</strong> gallons</td>
            </tr>`
          ).join('')
        : '';

      const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background-color: #0f172a; padding: 30px 20px; text-align: center; border-bottom: 4px solid #10b981;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">✓ Order Dispatched</h1>
      <p style="color: #6ee7b7; margin: 12px 0 0 0; font-size: 16px; font-weight: 600;">Your order has been scheduled for delivery</p>
    </div>
    <div style="background-color: ${themeFor('Barge').accent}; padding: 10px 20px; text-align: center;">
      <span style="color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 2px;">${themeFor('Barge').icon} ${themeFor('Barge').label}</span>
    </div>

    <!-- Content -->
    <div style="padding: 30px 20px;">
      
      <!-- Order Details Section -->
      <div style="margin-bottom: 30px;">
        <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #10b981;">Order Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 140px;">Customer</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${order.customer_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Vessel</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${order.vessel_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Destination</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${order.destination}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Market</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${order.market}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Delivery Method</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${order.method_of_delivery}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Requested Date</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${format(parseISO(order.requested_date), 'MMMM d, yyyy')}${order.requested_time ? ` at ${order.requested_time}` : ''}</td>
          </tr>
        </table>
      </div>

      <!-- Product Details Section -->
      <div style="margin-bottom: 30px;">
        <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #10b981;">Product Details</h2>
        <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 6px; overflow: hidden;">
          ${productLinesHtml}
          <tr style="background-color: #e0f2fe;">
            <td style="padding: 12px 8px; font-weight: bold; color: #0f172a;">Total Gallons</td>
            <td style="padding: 12px 8px; text-align: right; font-weight: bold; color: #0369a1; font-size: 18px;">${totalGallons.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <!-- Dispatch Information Section -->
      <div style="margin-bottom: 30px;">
        <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #10b981;">Dispatch Information</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 140px;">Scheduled Date</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${format(parseISO(dispatchData.start_date), 'MMMM d, yyyy')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Barge</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${dispatchData.barge_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Captain</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${dispatchData.captain || 'TBD'}</td>
          </tr>
          ${dispatchData.tug_name ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Tug</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${dispatchData.tug_name}</td>
          </tr>` : ''}
        </table>
      </div>

      <!-- Footer Message -->
      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; border-radius: 4px; margin-top: 30px;">
        <p style="margin: 0; color: #0f172a; font-size: 14px;">Thank you for your order!</p>
        <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px;">PTL Marine Operations Team</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; color: #64748b; font-size: 12px;">PTL Marine | Barge Delivery Management System</p>
    </div>

  </div>
</body>
</html>
      `;

      // Send to all recipients
      for (const recipient of emailRecipients) {
        try {
          await base44.functions.invoke('sendEmail', {
            to: recipient,
            subject: `Order Dispatched: ${order.customer_name} - ${order.vessel_name}`,
            html: emailBody
          });
        } catch (emailError) {
          console.error(`Failed to send email to ${recipient}:`, emailError);
        }
      }

      return dispatch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
  });

  const handleSubmit = (data) => {
    if (editingDelivery) {
      updateMutation.mutate({ id: editingDelivery.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (delivery) => {
    setEditingDelivery(delivery);
    setShowForm(true);
  };

  const handleDispatchOrder = (order, dispatchData) => {
    if (!dispatchData.sage_order_number || !dispatchData.entered_in_sage) {
      alert('Please enter the Sage Order Number and confirm it has been entered in Sage before dispatching.');
      return;
    }
    
    dispatchOrderMutation.mutate({ order, dispatchData, currentUser });
  };

  const handleDeleteOrderClick = (order) => {
    setDeletingOrder(order);
    setDeletingDelivery(null);
    setDeleteReason('');
    setDeleteDialogOpen(true);
  };

  const handleDeleteDeliveryClick = (delivery) => {
    setDeletingDelivery(delivery);
    setDeletingOrder(null);
    setDeleteReason('');
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingOrder) {
      deleteOrderMutation.mutate({ orderId: deletingOrder.id, reason: deleteReason });
    } else if (deletingDelivery) {
      deleteDeliveryMutation.mutate({ deliveryId: deletingDelivery.id, reason: deleteReason });
    }
  };

  const availableMonths = [...new Set(deliveries.map(d => {
    if (!d.start_date) return null;
    return format(parseISO(d.start_date), 'yyyy-MM');
  }).filter(Boolean))].sort().reverse();

  const statusPriority = {
    'scheduled': 1,
    'delivered': 2,
    'cancelled': 3
  };

  const productColors = {
    'MGO': 'bg-blue-100 text-blue-800 border-blue-200',
    'RD99': 'bg-purple-100 text-purple-800 border-purple-200',
    'CARB Diesel': 'bg-green-100 text-green-800 border-green-200',
    'ULSD': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Lubricants': 'bg-orange-100 text-orange-800 border-orange-200',
    'default': 'bg-slate-100 text-slate-800 border-slate-200'
  };

  const getProductColor = (productType) => {
    if (!productType) return productColors.default;
    // Check if product name contains any of the keys
    for (const [key, color] of Object.entries(productColors)) {
      if (productType.toLowerCase().includes(key.toLowerCase())) {
        return color;
      }
    }
    // Check for lubricants category
    if (productType.toLowerCase().includes('lube') || productType.toLowerCase().includes('lubricant')) {
      return productColors['Lubricants'];
    }
    return productColors.default;
  };

  const filterByMarket = (dispatch) => {
    if (selectedMarket === 'all') return true;
    return dispatch.market === selectedMarket;
  };

  const filterByBarge = (dispatch) => {
    if (selectedBarge === 'all') return true;
    return dispatch.barge_id === selectedBarge;
  };

  const matchesSearchTerm = (d) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return [d.barge_name, d.tug_name, d.captain, d.deckhand, d.tankerman, ...(d.crew_members || []),
      d.destination, d.vessel_name, d.customer, d.cargo_type, d.sage_order_number]
      .some(v => v?.toLowerCase().includes(q));
  };

  const filteredDeliveries = deliveries
    .filter(d => {
      const matchesSearch = matchesSearchTerm(d);
      
      let matchesMonth = selectedMonth === 'all';
      if (!matchesMonth && d.start_date) {
        try {
          matchesMonth = d.start_date.substring(0, 7) === selectedMonth;
        } catch (e) {
          console.error('Error matching month for delivery:', d.start_date, e);
          matchesMonth = false;
        }
      }
      
      const matchesStatus = selectedStatus === 'all' || d.status === selectedStatus;
      const matchesMarket = filterByMarket(d);
      const matchesBarge = filterByBarge(d);
      
      return matchesSearch && matchesMonth && matchesStatus && matchesMarket && matchesBarge;
    })
    .sort((a, b) => {
      const priorityDiff = (statusPriority[a.status] || 5) - (statusPriority[b.status] || 5);
      if (priorityDiff !== 0) return priorityDiff;
      
      if (!a.start_date && !b.start_date) return 0;
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;

      try {
        return b.start_date.localeCompare(a.start_date);
      } catch (e) {
        console.error('Error sorting deliveries by date:', e);
        return 0;
      }
    });

  // Get active deliveries (all dispatched orders that haven't been delivered or cancelled)
  const activeDeliveries = deliveries.filter(d => {
    if (d.status === 'delivered' || d.status === 'cancelled') return false;
    if (d.event_type && d.event_type !== 'delivery') return false;
    // Apply all filters consistently
    if (selectedMarket !== 'all' && d.market !== selectedMarket) return false;
    if (selectedBarge !== 'all' && d.barge_id !== selectedBarge) return false;
    return matchesSearchTerm(d);
  }).sort((a, b) => {
    const cmp = (a.start_date || '').localeCompare(b.start_date || '') || (a.requested_delivery_time || '').localeCompare(b.requested_delivery_time || '');
    return activeSort === 'asc' ? cmp : -cmp;
  });

  const calculateTotalGallons = (productLines) => {
    if (!productLines || !Array.isArray(productLines)) return 0;
    return productLines.reduce((sum, line) => sum + (line.requested_gallons || 0), 0);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Barge Dispatch
            </h1>
            <p className="text-slate-600">Schedule and manage barge deliveries</p>
          </div>
          <Button
            onClick={() => {
              if (showForm && !editingDelivery) {
                setShowForm(false);
                return;
              }
              setEditingDelivery(null);
              setShowForm(true);
            }}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Delivery
          </Button>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Confirm Deletion
              </DialogTitle>
              <DialogDescription>
                {deletingOrder && (
                  <span>
                    Are you sure you want to delete the sales order for <strong>{deletingOrder.customer_name}</strong> - <strong>{deletingOrder.vessel_name}</strong>?
                  </span>
                )}
                {deletingDelivery && (
                  <span>
                    Are you sure you want to delete the delivery for <strong>{deletingDelivery.vessel_name}</strong> on barge <strong>{deletingDelivery.barge_name}</strong>?
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="delete_reason">Reason for Deletion *</Label>
                <Textarea
                  id="delete_reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Please provide a reason for deleting this order..."
                  rows={4}
                  required
                />
              </div>
              
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                <p className="font-medium mb-1">Email Notification</p>
                <p>A notification will be sent to configured recipients.</p>
                <p className="text-xs mt-1 text-blue-600">(Configure recipients in Settings → Email Notifications)</p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeletingOrder(null);
                  setDeletingDelivery(null);
                  setDeleteReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={!deleteReason.trim() || deleteOrderMutation.isPending || deleteDeliveryMutation.isPending}
              >
                {(deleteOrderMutation.isPending || deleteDeliveryMutation.isPending) ? 'Deleting...' : 'Delete Order'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Search and Filters - Moved to top, before Orders Awaiting Dispatch */}
        {!showForm && (
          <div className="flex flex-col gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search deliveries by barge, captain, vessel, location..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (e.target.value) setRecentDeliveriesOpen(true);
                }}
                className="pl-10 py-6 text-lg border-slate-200"
              />
            </div>
            
            <div className="flex flex-col md:flex-row gap-4">
              <Select value={selectedMarket} onValueChange={(value) => {
                setSelectedMarket(value);
                setSelectedBarge('all');
              }}>
                <SelectTrigger className="w-full md:w-64 py-6">
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

              <Select value={selectedBarge} onValueChange={setSelectedBarge}>
                <SelectTrigger className="w-full md:w-64 py-6">
                  <div className="flex items-center gap-2">
                    <Ship className="w-5 h-5 text-slate-400" />
                    <SelectValue placeholder="All Barges" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {/* Filter barges by selected market */}
                  <SelectItem value="all">All Barges</SelectItem>
                  {barges
                    .filter(b => selectedMarket === 'all' || b.market === selectedMarket)
                    .map(barge => (
                      <SelectItem key={barge.id} value={barge.id}>
                        {barge.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full md:w-64 py-6">
                  <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-slate-400" />
                    <SelectValue placeholder="All Statuses" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full md:w-64 py-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-slate-400" />
                    <SelectValue placeholder="All Months" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {availableMonths.map(month => (
                    <SelectItem key={month} value={month}>
                      {format(parseISO(`${month}-01`), 'MMMM yyyy')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Pending Sales Orders Queue */}
        {pendingSalesOrders.length > 0 && !showForm && (
          <Card className="shadow-lg border-2 border-emerald-300 bg-emerald-50">
            <CardHeader className="border-b border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900">
                      Orders Awaiting Dispatch ({pendingSalesOrders.length})
                    </CardTitle>
                    <p className="text-sm text-slate-600">Sales orders ready for scheduling</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4">
                {pendingSalesOrders.map((order) => {
                  const totalGallons = calculateTotalGallons(order.product_lines);
                  
                  return (
                    <Dialog key={order.id}>
                      <div className="p-4 bg-white rounded-lg border-2 border-emerald-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              <h3 className="font-bold text-lg text-slate-900">{order.customer_name}</h3>
                              {order.priority === 'urgent' && (
                                <Badge className="bg-red-100 text-red-800 border-red-200">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  URGENT
                                </Badge>
                              )}
                              {order.requested_time && (
                                <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-mono">
                                  {order.requested_time}
                                </Badge>
                              )}
                            </div>
                            <div className="grid md:grid-cols-3 gap-3 text-sm text-slate-600">
                              <div><span className="font-medium">Vessel:</span> {order.vessel_name}</div>
                              <div><span className="font-medium">Destination:</span> {order.destination}</div>
                              <div><span className="font-medium">Market:</span> {order.market}</div>
                              {order.product_lines && order.product_lines.length > 0 && (
                                <div>
                                  <span className="font-medium">Products:</span>{' '}
                                  {order.product_lines.map(line => line.product_type).filter(Boolean).join(', ')}
                                </div>
                              )}
                              {totalGallons > 0 && (
                                <div><span className="font-medium">Gallons:</span> {totalGallons.toLocaleString()}</div>
                              )}
                              <div>
                                <span className="font-medium">Requested:</span>{' '}
                                {format(parseISO(order.requested_date), 'MMM d, yyyy')}
                              </div>
                            </div>
                            <div className="mt-2 text-sm text-slate-600">
                              <span className="font-medium">Submitted by:</span> {order.submitted_by_name} on{' '}
                              {format(parseISO(order.submitted_date), 'MMM d, yyyy')}
                            </div>
                            {order.notes && (
                              <div className="mt-2 pt-2 border-t border-slate-100 text-sm text-slate-700">
                                <span className="font-medium">Notes:</span> {order.notes}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(createPageUrl("SalesOrders") + `?edit=${order.id}`);
                              }}
                            >
                              <Edit2 className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteOrderClick(order);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700"
                              >
                                Dispatch Order
                              </Button>
                            </DialogTrigger>
                          </div>
                        </div>
                      </div>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="text-2xl">Dispatch Order: {order.customer_name}</DialogTitle>
                        </DialogHeader>
                        <div className="mt-4">
                          <DispatchForm
                            dispatch={{
                              market: order.market,
                              vessel_name: order.vessel_name,
                              destination: order.destination,
                              cargo_type: order.product_lines && order.product_lines.length > 0 ? order.product_lines[0].product_type : '',
                              product_lines: (order.product_lines || []).map(l => ({
                                product_type: l.product_type || '',
                                cargo_brand: l.cargo_brand || '',
                                gallons: l.requested_gallons ?? '',
                                metric_tons: l.requested_metric_tons ?? ''
                              })),
                              gallons_delivered: order.product_lines && order.product_lines.length > 0 ? order.product_lines.reduce((sum, line) => sum + (line.requested_gallons || 0), 0) : 0,
                              start_date: order.requested_date,
                              requested_delivery_time: order.requested_time,
                              customer: order.customer_name,
                              agent_name: order.agent_name,
                              notes: order.notes,
                              status: 'scheduled'
                            }}
                            barges={barges}
                            onSave={(dispatchData) => handleDispatchOrder(order, dispatchData)}
                            onCancel={() => {}}
                            isProcessing={dispatchOrderMutation.isPending}
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Deliveries - Today and This Week */}
        {activeDeliveries.length > 0 && !showForm && (
          <Card className="shadow-lg border-2 border-blue-300 bg-blue-50">
            <CardHeader className="border-b border-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">
                    Active Deliveries ({activeDeliveries.length})
                  </CardTitle>
                  <p className="text-sm text-slate-600">Today and this week</p>
                </div>
                <Select value={activeSort} onValueChange={setActiveSort}>
                  <SelectTrigger className="w-48 ml-auto bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Date: Earliest first</SelectItem>
                    <SelectItem value="desc">Date: Latest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-4">
                {activeDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="p-4 bg-white rounded-lg border-2 border-blue-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="font-bold text-xl text-slate-900">{delivery.vessel_name}</h3>
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            {delivery.status}
                          </Badge>
                          {delivery.gallons_delivered && (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Gallons Recorded
                            </Badge>
                          )}
                          {delivery.dispatched_by_name && (
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                              Dispatched by: {delivery.dispatched_by_name}
                            </Badge>
                          )}
                          {delivery.status === 'scheduled' && !delivery.sage_order_number && (
                            <Badge className="bg-red-100 text-red-800 border-red-200">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Missing Sage #
                            </Badge>
                          )}
                        </div>
                        <div className="grid md:grid-cols-3 gap-2 text-sm text-slate-600 mb-3">
                          <div><span className="font-medium">Barge:</span> {delivery.barge_name}</div>
                          <div><span className="font-medium">Destination:</span> {delivery.destination}</div>
                          {delivery.product_lines && delivery.product_lines.length > 1 ? (
                            <div className="md:col-span-3">
                              <span className="font-medium">Products:</span>
                              <ul className="list-disc ml-5 mt-1">
                                {delivery.product_lines.map((line, i) => (
                                  <li key={i}>
                                    {line.product_type || 'TBD'}
                                    {line.gallons ? ` - ${Number(line.gallons).toLocaleString()} gal` : ''}
                                    {line.metric_tons ? ` (${Number(line.metric_tons)} MT)` : ''}
                                    {line.cargo_brand ? ` - ${line.cargo_brand}` : ''}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <div><span className="font-medium">Product:</span> {delivery.cargo_type || 'TBD'}</div>
                          )}
                          <div><span className="font-medium">Date:</span> {format(parseISO(delivery.start_date), 'MMM d, yyyy')}</div>
                          {delivery.customer && (
                            <div><span className="font-medium">Customer:</span> {delivery.customer}</div>
                          )}
                          {delivery.requested_delivery_time && (
                            <div><span className="font-medium">Requested Time:</span> {delivery.requested_delivery_time}</div>
                          )}
                          </div>
                          {(delivery.captain || delivery.deckhand || delivery.tankerman || delivery.crew_members?.length > 0) && (
                            <div className="text-sm text-slate-600">
                              <span className="font-medium">Crew: </span>
                              {[
                                delivery.captain,
                                delivery.deckhand,
                                delivery.tankerman,
                                ...(delivery.crew_members || [])
                              ].filter(Boolean).join(', ')}
                            </div>
                          )}
                        {(delivery.time_alongside || delivery.time_transfer_commenced || delivery.time_transfer_completed || delivery.time_departed) && (
                          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-sm">
                            <div className="font-semibold text-slate-700 mb-2">Timing Records:</div>
                            <div className="grid md:grid-cols-2 gap-2 text-slate-600">
                              {delivery.time_alongside && <div>Alongside: {delivery.time_alongside}</div>}
                              {delivery.time_transfer_commenced && <div>Transfer Started: {delivery.time_transfer_commenced}</div>}
                              {delivery.time_transfer_completed && <div>Transfer Completed: {delivery.time_transfer_completed}</div>}
                              {delivery.time_departed && <div>Departed: {delivery.time_departed}</div>}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-900">
                            {delivery.gallons_delivered ? delivery.gallons_delivered.toLocaleString() : 'TBD'}
                          </p>
                          <p className="text-xs text-slate-500 uppercase">Gallons</p>
                        </div>
                        <Button
                          onClick={() => handleEdit(delivery)}
                          className="bg-gradient-to-r from-blue-600 to-blue-700"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDeliveryClick(delivery);
                          }}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* New Delivery Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              ref={formRef}
              key={editingDelivery?.id || 'new'}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <DispatchForm
                dispatch={editingDelivery}
                barges={barges}
                onSave={handleSubmit}
                onCancel={() => {
                  setShowForm(false);
                  setEditingDelivery(null);
                }}
                isProcessing={createMutation.isPending || updateMutation.isPending}
              />
            </motion.div>
          )}
        </AnimatePresence>



        {/* Recent Deliveries List */}
        {!showForm && (
          <Collapsible 
            open={recentDeliveriesOpen} 
            onOpenChange={setRecentDeliveriesOpen}
            className="space-y-2"
          >
            <Card className="shadow-md border-slate-200">
              <CollapsibleTrigger asChild>
                <CardHeader className="border-b border-slate-100 pb-4 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <Ship className="w-5 h-5 text-blue-600" />
                      Recent Deliveries ({filteredDeliveries.length})
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="gap-2">
                      {recentDeliveriesOpen ? 'Collapse' : 'Expand'}
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${recentDeliveriesOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {filteredDeliveries.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        <Ship className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No deliveries match the current filters</p>
                      </div>
                    ) : (
                      filteredDeliveries.map((dispatch) => {
                        const getCrewList = (dispatch) => {
                          const crew = [];
                          if (dispatch.captain) crew.push(dispatch.captain);
                          if (dispatch.deckhand) crew.push(dispatch.deckhand);
                          if (dispatch.tankerman) crew.push(dispatch.tankerman);
                          if (dispatch.crew_members?.length) crew.push(...dispatch.crew_members);
                          return crew;
                        };
                        
                        const formatStatus = (status) => {
                          return status
                            .replace(/_/g, ' ')
                            .split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        };
                        
                        const formatDate = (dateString) => {
                          if (!dateString) return '';
                          try {
                            return format(parseISO(dateString), 'MMM d, yyyy');
                          } catch (e) {
                            console.error('Error formatting date:', dateString, e);
                            return dateString;
                          }
                        };
                        
                        const crewList = getCrewList(dispatch);
                        const isDelivered = dispatch.status === 'delivered';
                        const missingPaperwork = isDelivered && !dispatch.paperwork_sent_to_billing;
                        const missingSage = isDelivered && !dispatch.entered_in_sage;
                        
                        const statusColors = {
                          scheduled: "bg-blue-100 text-blue-800 border-blue-200",
                          in_transit: "bg-orange-100 text-orange-800 border-orange-200",
                          delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
                          cancelled: "bg-slate-100 text-slate-800 border-slate-200"
                        };

                        const marketColors = {
                          'Long Beach': "bg-amber-100 text-amber-800 border-amber-200",
                          'Oakland': "bg-purple-100 text-purple-800 border-purple-200",
                          'Portland': "bg-teal-100 text-teal-800 border-teal-200",
                          'Seattle': "bg-indigo-100 text-indigo-800 border-indigo-200"
                        };
                        
                        return (
                          <div
                            key={dispatch.id}
                            onClick={() => handleEdit(dispatch)}
                            className="p-4 hover:bg-slate-50 cursor-pointer transition-colors duration-200"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Ship className="w-5 h-5 text-blue-600" />
                                  <h4 className="font-bold text-lg text-slate-900">{dispatch.vessel_name}</h4>
                                  <Badge className={`${statusColors[dispatch.status]} border text-xs`}>
                                    {formatStatus(dispatch.status)}
                                  </Badge>
                                  {dispatch.market && (
                                    <Badge className={`${marketColors[dispatch.market] || 'bg-slate-100 text-slate-800 border-slate-200'} border text-xs font-semibold`}>
                                      {dispatch.market}
                                    </Badge>
                                  )}
                                  {dispatch.cargo_type && (
                                    <Badge className={`${getProductColor(dispatch.cargo_type)} border text-xs font-semibold`}>
                                      {dispatch.cargo_type}
                                    </Badge>
                                  )}
                                  {dispatch.product_lines && dispatch.product_lines.length > 1 && dispatch.product_lines.slice(1).map((line, i) => (
                                    line.product_type ? (
                                      <Badge key={i} className={`${getProductColor(line.product_type)} border text-xs font-semibold`}>
                                        {line.product_type}
                                      </Badge>
                                    ) : null
                                  ))}
                                  {dispatch.is_outside_tow && (
                                    <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200 text-xs flex items-center gap-1">
                                      <Ship className="w-3 h-3" />
                                      Outside Tow
                                    </Badge>
                                  )}
                                </div>
                                <div className="space-y-1 ml-8 text-sm text-slate-600">
                                  <div className="text-slate-500 uppercase">{dispatch.barge_name}</div>
                                  {dispatch.tug_name && (
                                    <div className="flex items-center gap-2">
                                      <Ship className="w-4 h-4" />
                                      <span>
                                        Tug: {dispatch.tug_name}
                                        {dispatch.is_third_party_towing && (
                                          <span className="ml-1 text-purple-600 font-medium">(3rd Party)</span>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    <span>→ {dispatch.destination}</span>
                                  </div>
                                  {dispatch.start_date && (
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-4 h-4" />
                                      <span className="font-bold">
                                        {formatDate(dispatch.start_date)}
                                      </span>
                                    </div>
                                  )}
                                  {dispatch.sage_order_number && (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-purple-700">Sage Order #:</span>
                                      <span className="font-mono text-purple-900">{dispatch.sage_order_number}</span>
                                    </div>
                                  )}
                                  {crewList.length > 0 && (
                                    <div className="flex items-start gap-2 pt-1">
                                      <Ship className="w-4 h-4 mt-0.5" />
                                      <div>
                                        <span className="font-medium text-slate-700">Crew: </span>
                                        <span className="text-slate-600">{crewList.join(', ')}</span>
                                      </div>
                                    </div>
                                  )}
                                  {(missingSage || missingPaperwork) && (
                                    <div className="flex flex-wrap gap-2 pt-2">
                                      {missingPaperwork && (
                                        <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                                          Missing: Paperwork to Billing
                                        </Badge>
                                      )}
                                      {missingSage && (
                                        <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                                          Missing: Sage Entry
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              {dispatch.gallons_delivered && (
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-slate-900">
                                    {dispatch.gallons_delivered.toLocaleString()}
                                  </p>
                                  <p className="text-xs text-slate-500 uppercase">Gallons</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
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