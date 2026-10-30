import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ClipboardList, Clock, CheckCircle, XCircle, AlertCircle, Trash2, Archive, ArchiveRestore, Edit2, Shield } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { themeFor, orderTypeBannerRow } from "@/lib/orderNotifications";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  dispatched: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  archived: "bg-slate-100 text-slate-800 border-slate-200"
};

const priorityColors = {
  normal: "bg-blue-100 text-blue-800 border-blue-200",
  urgent: "bg-red-100 text-red-800 border-red-200"
};

export default function SalesOrders() {
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const [formData, setFormData] = useState({
    market: '',
    customer_name: '',
    customer_po: '',
    vessel_name: '',
    broker_name: '',
    broker_commission: '',
    agent_name: '',
    method_of_delivery: '',
    destination: '',
    product_lines: [{ product_type: '', requested_gallons: '', requested_metric_tons: '', metric_tons_per_gallon_conversion: '', price_per_gallon: '', price_per_metric_ton: '', pricing_timing: 'Day of Delivery', mgo_api: '' }],
    barge_charge: '',
    requested_date: '',
    requested_time: '',
    priority: 'normal',
    is_hedged: false,
    notes: ''
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: orders = [] } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => base44.entities.SalesOrder.list('-submitted_date'),
  });

  // Auto-open the edit form when arriving from Barge Dispatch with ?edit=<order id>
  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (!editId) return;
    const order = orders.find(o => o.id === editId);
    if (order) {
      setEditingOrder(order);
      setFormData({
        market: order.market || '',
        customer_name: order.customer_name || '',
        customer_po: order.customer_po || '',
        vessel_name: order.vessel_name || '',
        broker_name: order.broker_name || '',
        broker_commission: order.broker_commission || '',
        agent_name: order.agent_name || '',
        method_of_delivery: order.method_of_delivery || '',
        destination: order.destination || '',
        product_lines: order.product_lines && order.product_lines.length > 0
          ? order.product_lines.map(line => ({...line, pricing_timing: line.pricing_timing || 'Day of Delivery', price_per_metric_ton: line.price_per_metric_ton || '', mgo_api: line.mgo_api || ''}))
          : [{ product_type: '', requested_gallons: '', requested_metric_tons: '', metric_tons_per_gallon_conversion: '', price_per_gallon: '', price_per_metric_ton: '', pricing_timing: 'Day of Delivery' }],
        barge_charge: order.barge_charge || '',
        requested_date: order.requested_date || '',
        requested_time: order.requested_time || '',
        priority: order.priority || 'normal',
        is_hedged: order.is_hedged || false,
        notes: order.notes || ''
      });
      setShowForm(true);
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, [orders.length]);

  const { data: cargoTypes = [] } = useQuery({
    queryKey: ['cargo'],
    queryFn: () => base44.entities.Cargo.list(),
  });

  const activeCargoTypes = cargoTypes.filter(c => c.is_active !== false).sort((a, b) => a.name.localeCompare(b.name));
  
  // Filter products based on selected delivery method
  const getAvailableProducts = () => {
    if (!formData.method_of_delivery) return activeCargoTypes;
    
    if (formData.method_of_delivery === 'Truck') {
      return activeCargoTypes.filter(c => 
        c.category === 'Other' || !c.delivery_method || c.delivery_method === 'Trucking' || c.delivery_method === 'Both'
      );
    } else if (formData.method_of_delivery === 'Barge' || formData.method_of_delivery === 'X-Pipe') {
      return activeCargoTypes.filter(c => 
        c.category === 'Other' || !c.delivery_method || c.delivery_method === 'Marine' || c.delivery_method === 'Both'
      );
    }
    return activeCargoTypes;
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Filter out empty product lines - accept either gallons OR metric tons
      const cleanedProductLines = data.product_lines.filter(line => 
        line.product_type && (line.requested_gallons || line.requested_metric_tons)
      ).map(line => ({
        ...line,
        requested_gallons: line.requested_gallons ? parseFloat(line.requested_gallons) : 0,
        requested_metric_tons: line.requested_metric_tons ? parseFloat(line.requested_metric_tons) : null,
        metric_tons_per_gallon_conversion: line.metric_tons_per_gallon_conversion ? parseFloat(line.metric_tons_per_gallon_conversion) : null,
        price_per_gallon: line.price_per_gallon ? parseFloat(line.price_per_gallon) : null,
        price_per_metric_ton: line.price_per_metric_ton ? parseFloat(line.price_per_metric_ton) : null
      }));

      const totalGallons = cleanedProductLines.reduce((sum, line) => 
        sum + (parseFloat(line.requested_gallons) || 0), 0
      );
      const primaryProduct = cleanedProductLines[0]?.product_type || '';

      // Route to appropriate dispatch system based on delivery method
      if (data.method_of_delivery === 'Truck') {
        // Create sales order as pending - will be dispatched by trucking dispatch team
        const newOrder = await base44.entities.SalesOrder.create({
          ...data,
          product_lines: cleanedProductLines,
          broker_commission: data.broker_commission ? parseFloat(data.broker_commission) : null,
          barge_charge: data.barge_charge ? parseFloat(data.barge_charge) : null,
          submitted_by: currentUser?.email,
          submitted_by_name: currentUser?.full_name,
          submitted_date: new Date().toISOString(),
          status: 'pending'
        });

        // Send order confirmation email for Truck orders too
        try {
          const allSettings = await base44.entities.EmailNotificationSettings.filter({
            notification_type: 'order_confirmation'
          });

          const activeSettings = allSettings.filter(s => s.is_active !== false);

          let notificationSetting = activeSettings.find(s => s.market === data.market && s.recipient_emails?.length > 0);
          if (!notificationSetting) {
            notificationSetting = activeSettings.find(s => s.market === 'all' && s.recipient_emails?.length > 0);
          }
          if (!notificationSetting) {
            notificationSetting = activeSettings[0];
          }

          const recipients = notificationSetting?.recipient_emails || [];

          if (recipients.length > 0) {
            const totalGallons = cleanedProductLines.reduce((sum, line) => sum + (parseFloat(line.requested_gallons) || 0), 0);

            const truckProductRowsHTML = cleanedProductLines.map(line => {
              const quantityText = `${parseFloat(line.requested_gallons).toLocaleString()} gal`;
              const priceText = line.price_per_gallon ? `$${line.price_per_gallon}/gal` : '—';
              const lineTotalText = line.price_per_gallon ? `$${(line.requested_gallons * line.price_per_gallon).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—';
              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 12px; text-align: left;">${line.product_type}</td>
                  <td style="padding: 12px; text-align: right;">${quantityText}</td>
                  <td style="padding: 12px; text-align: right;">${priceText}</td>
                  <td style="padding: 12px; text-align: right;">${line.pricing_timing || '—'}</td>
                  <td style="padding: 12px; text-align: right; font-weight: 600;">${lineTotalText}</td>
                </tr>
              `;
            }).join('');

            const allTruckRecipients = [...new Set(recipients.filter(Boolean))];
            for (const recipient of allTruckRecipients) {
              await base44.functions.invoke('sendEmail', {
              to: recipient,
              subject: `New Trucking Order - ${data.market}: ${data.customer_name} - ${data.vessel_name}`,
              html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: ${themeFor('Truck').header}; padding: 30px; text-align: center; border-top: 6px solid ${themeFor('Truck').accent};">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">🚛 New Trucking Order</h1>
              <p style="margin: 12px 0 0 0; color: #fed7aa; font-size: 17px; font-weight: 600;">${data.market}</p>
              <p style="margin: 6px 0 0 0; color: #fdba74; font-size: 14px;">Truck Delivery</p>
            </td>
          </tr>
          ${orderTypeBannerRow('Truck')}

          <!-- Order Info -->
          <tr>
            <td style="padding: 30px;">
              
              <!-- Submitted By Section -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 30px; border-radius: 4px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 600;">
                  Submitted by: ${currentUser?.full_name} (${currentUser?.email})
                </p>
                <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px;">
                  ${format(new Date(), 'MMMM d, yyyy HH:mm')}
                </p>
              </div>
              
              <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Customer Information</h2>
              <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                  <td style="color: #64748b; font-size: 14px; width: 40%;">Customer:</td>
                  <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.customer_name}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 14px;">Vessel:</td>
                  <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.vessel_name}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 14px;">Destination:</td>
                  <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.destination}</td>
                </tr>
                ${data.agent_name ? `
                <tr>
                  <td style="color: #64748b; font-size: 14px;">Agent:</td>
                  <td style="color: #0f172a; font-size: 14px;">${data.agent_name}</td>
                </tr>
                ` : ''}
              </table>

              <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Delivery Details</h2>
              <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                  <td style="color: #64748b; font-size: 14px; width: 40%;">Delivery Method:</td>
                  <td style="color: #0f172a; font-size: 14px; font-weight: 600;">Truck</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 14px;">Requested Date:</td>
                  <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${format(parseISO(data.requested_date), 'EEEE, MMMM d, yyyy')}${data.requested_time ? ` at ${data.requested_time}` : ''}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 14px;">Priority:</td>
                  <td style="color: #0f172a; font-size: 14px;">
                    <span style="background-color: ${data.priority === 'urgent' ? '#fee2e2' : '#dbeafe'}; color: ${data.priority === 'urgent' ? '#dc2626' : '#2563eb'}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">${data.priority}</span>
                  </td>
                </tr>
              </table>

              <h2 style="margin: 0 0 15px 0; color: #0f172a; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Products</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 20px; margin-top: 15px;">
                <thead>
                  <tr style="background-color: #f1f5f9;">
                    <th style="padding: 12px; text-align: left; color: #475569; font-size: 13px; font-weight: 600;">Product</th>
                    <th style="padding: 12px; text-align: right; color: #475569; font-size: 13px; font-weight: 600;">Quantity</th>
                    <th style="padding: 12px; text-align: right; color: #475569; font-size: 13px; font-weight: 600;">Price</th>
                    <th style="padding: 12px; text-align: right; color: #475569; font-size: 13px; font-weight: 600;">Pricing</th>
                    <th style="padding: 12px; text-align: right; color: #475569; font-size: 13px; font-weight: 600;">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${truckProductRowsHTML}
                  <tr style="background-color: #f8fafc; font-weight: 600;">
                    <td colspan="4" style="padding: 12px; text-align: right; color: #0f172a; font-size: 14px;">Total Gallons:</td>
                    <td style="padding: 12px; text-align: right; color: #0f172a; font-size: 14px;">${totalGallons.toLocaleString()} gal</td>
                  </tr>
                </tbody>
              </table>

              ${data.notes ? `
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #92400e; font-size: 13px; font-weight: 600; text-transform: uppercase;">Additional Notes:</p>
                <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.5;">${data.notes}</p>
              </div>
              ` : ''}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #475569; font-size: 13px; font-style: italic;">
                ✓ This order is now pending trucking dispatch scheduling.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
              `
              });
            }
          }
        } catch (emailError) {
          console.error('Failed to send truck order confirmation email:', emailError);
          alert('Order created but email notification failed: ' + (emailError?.message || JSON.stringify(emailError)));
        }

        return newOrder;
      } else {
        // Regular sales order for Barge/X-Pipe (Marine Ops)
        const newOrder = await base44.entities.SalesOrder.create({
          ...data,
          product_lines: cleanedProductLines,
          broker_commission: data.broker_commission ? parseFloat(data.broker_commission) : null,
          barge_charge: data.barge_charge ? parseFloat(data.barge_charge) : null,
          submitted_by: currentUser?.email,
          submitted_by_name: currentUser?.full_name,
          submitted_date: new Date().toISOString(),
          status: 'pending'
        });

        // Send hedged order notification if applicable
        if (data.is_hedged) {
          try {
            const allSettings = await base44.entities.EmailNotificationSettings.filter({
              notification_type: 'hedged_order',
              is_active: true
            });
            
            let notificationSetting = allSettings.find(s => s.market === data.market);
            if (!notificationSetting || !notificationSetting.recipient_emails || notificationSetting.recipient_emails.length === 0) {
              notificationSetting = allSettings.find(s => (s.market || 'all') === 'all');
            }
            
            const recipients = notificationSetting?.recipient_emails || [];
            
            if (recipients.length > 0) {
              const totalGallons = cleanedProductLines.reduce((sum, line) => sum + (parseFloat(line.requested_gallons) || 0), 0);
              const productList = cleanedProductLines.map(line => 
                `${line.product_type}: ${parseFloat(line.requested_gallons).toLocaleString()} gal`
              ).join(', ');

              await base44.functions.invoke('sendEmail', {
                to: recipients.join(','),
                subject: `🔔 HEDGED ORDER - ${data.customer_name} - ${totalGallons.toLocaleString()} gallons`,
                html: `
A new HEDGED sales order has been submitted and requires supply tracking update.

ORDER DETAILS:
Customer: ${data.customer_name}
Vessel: ${data.vessel_name}
Market: ${data.market}
Destination: ${data.destination}

PRODUCTS:
${productList}

Total Gallons: ${totalGallons.toLocaleString()}

Requested Date: ${format(parseISO(data.requested_date), 'MMMM d, yyyy')}${data.requested_time ? ` at ${data.requested_time}` : ''}
Delivery Method: ${data.method_of_delivery}

Submitted by: ${currentUser?.full_name} on ${format(new Date(), 'MMMM d, yyyy HH:mm')}

⚠️ ACTION REQUIRED: Please update your hedges book to reflect this committed volume.

This notification was sent to configured supply team recipients in Email Notifications settings.
                `
              });
            }
          } catch (emailError) {
            console.error('Failed to send hedged order notification:', emailError);
          }
        }

        // Send order confirmation email
        try {
          const allSettings = await base44.entities.EmailNotificationSettings.list();
          const confirmationSettings = allSettings.filter(s => 
            s.notification_type === 'order_confirmation' && s.is_active !== false
          );

          console.log('Email notification settings found:', confirmationSettings.length, confirmationSettings.map(s => `${s.market}: ${s.recipient_emails}`));

          let notificationSetting = confirmationSettings.find(s => s.market === data.market && s.recipient_emails?.length > 0);
          if (!notificationSetting) {
            notificationSetting = confirmationSettings.find(s => (!s.market || s.market === 'all') && s.recipient_emails?.length > 0);
          }

          const recipients = notificationSetting?.recipient_emails?.length > 0
            ? notificationSetting.recipient_emails
            : [];
          
          console.log('Email recipients for order confirmation:', recipients, 'market:', data.market);

          if (recipients.length > 0) {
            const totalGallons = cleanedProductLines.reduce((sum, line) => sum + (parseFloat(line.requested_gallons) || 0), 0);
            let productDetails = '';
            cleanedProductLines.forEach((line, idx) => {
              productDetails += `\nProduct ${idx + 1}: ${line.product_type}\n`;
              if (line.requested_metric_tons) {
                productDetails += `  Quantity: ${parseFloat(line.requested_metric_tons).toLocaleString()} MT (${parseFloat(line.requested_gallons).toLocaleString()} gallons)\n`;
                productDetails += `  Conversion: ${line.metric_tons_per_gallon_conversion} MT/gal\n`;
              } else {
                productDetails += `  Quantity: ${parseFloat(line.requested_gallons).toLocaleString()} gallons\n`;
              }
              if (line.price_per_metric_ton && line.requested_metric_tons) {
                productDetails += `  Price: $${line.price_per_metric_ton}/MT\n`;
                productDetails += `  Line Total: $${(line.requested_metric_tons * line.price_per_metric_ton).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n`;
              } else if (line.price_per_gallon) {
                productDetails += `  Price: $${line.price_per_gallon}/gallon\n`;
                productDetails += `  Line Total: $${(line.requested_gallons * line.price_per_gallon).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n`;
              }
              if (line.pricing_timing) {
                productDetails += `  Pricing: ${line.pricing_timing}\n`;
              }
            });

            const grandTotal = cleanedProductLines.reduce((sum, line) => {
              if (line.price_per_metric_ton && line.requested_metric_tons) {
                return sum + (line.requested_metric_tons * line.price_per_metric_ton);
              }
              return sum + ((line.requested_gallons || 0) * (line.price_per_gallon || 0));
            }, 0) + (parseFloat(data.barge_charge) || 0);

            // Build product rows HTML
            let productRowsHTML = '';
            cleanedProductLines.forEach((line, idx) => {
              let quantityText = '';
              if (line.requested_metric_tons) {
                quantityText = `${parseFloat(line.requested_metric_tons).toLocaleString()} MT (${parseFloat(line.requested_gallons).toLocaleString()} gal)`;
              } else {
                quantityText = `${parseFloat(line.requested_gallons).toLocaleString()} gal`;
              }

              let priceText = '';
              let lineTotalText = '';
              if (line.price_per_metric_ton && line.requested_metric_tons) {
                priceText = `$${line.price_per_metric_ton}/MT`;
                lineTotalText = `$${(line.requested_metric_tons * line.price_per_metric_ton).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
              } else if (line.price_per_gallon) {
                priceText = `$${line.price_per_gallon}/gal`;
                lineTotalText = `$${(line.requested_gallons * line.price_per_gallon).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
              }

              productRowsHTML += `
               <tr style="border-bottom: 1px solid #e2e8f0;">
                 <td style="padding: 12px; text-align: left;">${line.product_type}</td>
                 <td style="padding: 12px; text-align: right;">${quantityText}</td>
                 <td style="padding: 12px; text-align: right;">${priceText || '—'}</td>
                 <td style="padding: 12px; text-align: right;">${line.pricing_timing || '—'}</td>
                 <td style="padding: 12px; text-align: right; font-weight: 600;">${lineTotalText || '—'}</td>
               </tr>
              `;
              });

              // Send to configured recipients only
              const allRecipients = [...new Set(recipients.filter(Boolean))];

              console.log('Attempting to send email to:', allRecipients);
              const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: ${themeFor(data.method_of_delivery).header}; padding: 30px; text-align: center; border-top: 6px solid ${themeFor(data.method_of_delivery).accent};">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">${themeFor(data.method_of_delivery).icon} New ${data.method_of_delivery === 'X-Pipe' ? 'X-Pipe' : 'Barge'} Order</h1>
              <p style="margin: 12px 0 0 0; color: #bae6fd; font-size: 17px; font-weight: 600;">${data.market}</p>
              <p style="margin: 6px 0 0 0; color: #7dd3fc; font-size: 14px;">${data.method_of_delivery}</p>
            </td>
          </tr>
          ${orderTypeBannerRow(data.method_of_delivery)}

          <!-- Order Info -->
          <tr>
            <td style="padding: 30px;">
              
              <!-- Submitted By Section -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 30px; border-radius: 4px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 600;">
                  Submitted by: ${currentUser?.full_name} (${currentUser?.email})
                </p>
                <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px;">
                  ${format(new Date(), 'MMMM d, yyyy HH:mm')}
                </p>
              </div>
              
              <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Customer Information</h2>
              <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                  <td style="color: #64748b; font-size: 14px; width: 40%;">Customer:</td>
                  <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.customer_name}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 14px;">Vessel:</td>
                  <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.vessel_name}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 14px;">Destination:</td>
                  <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.destination}</td>
                </tr>
                ${data.broker_name ? `
                <tr>
                  <td style="color: #64748b; font-size: 14px;">Broker:</td>
                  <td style="color: #0f172a; font-size: 14px;">${data.broker_name}</td>
                </tr>
                ` : ''}
                ${data.agent_name ? `
                <tr>
                  <td style="color: #64748b; font-size: 14px;">Agent:</td>
                  <td style="color: #0f172a; font-size: 14px;">${data.agent_name}</td>
                </tr>
                ` : ''}
              </table>

              <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Delivery Details</h2>
              <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom: 25px;">
                <tr>
                  <td style="color: #64748b; font-size: 14px; width: 40%;">Delivery Method:</td>
                  <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${data.method_of_delivery}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 14px;">Requested Date:</td>
                  <td style="color: #0f172a; font-size: 14px; font-weight: 600;">${format(parseISO(data.requested_date), 'EEEE, MMMM d, yyyy')}${data.requested_time ? ` at ${data.requested_time}` : ''}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-size: 14px;">Priority:</td>
                  <td style="color: #0f172a; font-size: 14px;">
                    <span style="background-color: ${data.priority === 'urgent' ? '#fee2e2' : '#dbeafe'}; color: ${data.priority === 'urgent' ? '#dc2626' : '#2563eb'}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase;">${data.priority}</span>
                  </td>
                </tr>
                ${data.is_hedged ? `
                <tr>
                  <td style="color: #64748b; font-size: 14px;">Hedged Status:</td>
                  <td style="color: #0f172a; font-size: 14px;">
                    <span style="background-color: #fae8ff; color: #a855f7; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">⚠️ HEDGED - Supply Team Notified</span>
                  </td>
                </tr>
                ` : ''}
              </table>

              <h2 style="margin: 0 0 15px 0; color: #0f172a; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Products</h2>
              
              ${cleanedProductLines.map((line, idx) => 
                line.pricing_timing ? `<p style="margin: 0 0 8px 0; color: #475569; font-size: 13px;"><strong>${line.product_type}:</strong> ${line.pricing_timing}</p>` : ''
              ).join('')}
              
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 20px; margin-top: 15px;">
                <thead>
                  <tr style="background-color: #f1f5f9;">
                    <th style="padding: 12px; text-align: left; color: #475569; font-size: 13px; font-weight: 600;">Product</th>
                    <th style="padding: 12px; text-align: right; color: #475569; font-size: 13px; font-weight: 600;">Quantity</th>
                    <th style="padding: 12px; text-align: right; color: #475569; font-size: 13px; font-weight: 600;">Price</th>
                    <th style="padding: 12px; text-align: right; color: #475569; font-size: 13px; font-weight: 600;">Pricing</th>
                    <th style="padding: 12px; text-align: right; color: #475569; font-size: 13px; font-weight: 600;">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${productRowsHTML}
                  <tr style="background-color: #f8fafc; font-weight: 600;">
                    <td colspan="4" style="padding: 12px; text-align: right; color: #0f172a; font-size: 14px;">Total Gallons:</td>
                    <td style="padding: 12px; text-align: right; color: #0f172a; font-size: 14px;">${totalGallons.toLocaleString()} gal</td>
                  </tr>
                  ${data.barge_charge ? `
                  <tr style="background-color: #dbeafe;">
                    <td colspan="4" style="padding: 12px; text-align: right; color: #1e40af; font-size: 14px; font-weight: 600;">Barge Charge:</td>
                    <td style="padding: 12px; text-align: right; color: #1e40af; font-size: 14px; font-weight: 600;">$${parseFloat(data.barge_charge).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  </tr>
                  ` : ''}
                  ${cleanedProductLines.some(l => l.price_per_gallon || l.price_per_metric_ton) ? `
                  <tr style="background-color: #dcfce7;">
                    <td colspan="4" style="padding: 15px; text-align: right; color: #15803d; font-size: 16px; font-weight: 700;">GRAND TOTAL:</td>
                    <td style="padding: 15px; text-align: right; color: #15803d; font-size: 16px; font-weight: 700;">$${grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  </tr>
                  ` : ''}
                </tbody>
              </table>

              ${data.notes ? `
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <p style="margin: 0 0 8px 0; color: #92400e; font-size: 13px; font-weight: 600; text-transform: uppercase;">Additional Notes:</p>
                <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.5;">${data.notes}</p>
              </div>
              ` : ''}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #475569; font-size: 13px; font-style: italic;">
                ✓ This order is now pending dispatch scheduling.
                </p>
                </td>
                </tr>

                </table>
                </td>
                </tr>
                </table>
                </body>
                </html>
            `;
            const failedRecipients = [];
            for (const recipient of allRecipients) {
              try {
                await base44.functions.invoke('sendEmail', {
                  to: recipient,
                  subject: `New ${data.method_of_delivery === 'X-Pipe' ? 'X-Pipe' : 'Barge'} Order - ${data.market}: ${data.customer_name} - ${data.vessel_name}`,
                  html: emailBody
                });
                console.log('Email sent successfully to:', recipient);
              } catch (recipientError) {
                console.error('Failed to send to:', recipient, recipientError?.message);
                failedRecipients.push(recipient);
              }
            }
            if (failedRecipients.length > 0) {
              alert(`Order created, but the email notification failed for: ${failedRecipients.join(', ')}. Please notify CA.Orders manually.`);
            }
          } // end if recipients.length > 0
        } catch (emailError) {
          console.error('Failed to send order confirmation email:', emailError?.message || emailError);
          alert('Order created but email notification failed: ' + (emailError?.message || JSON.stringify(emailError)));
        }

        return newOrder;
      }
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      if (variables.method_of_delivery === 'Truck') {
        queryClient.invalidateQueries({ queryKey: ['truck-dispatch'] });
      }
      resetForm();
    },
    onError: (error) => {
      console.error('Failed to create order:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      alert(`Failed to create order: ${errorMessage}\n\nPlease check the console for details or contact support.`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const cleanedProductLines = data.product_lines.filter(line => 
        line.product_type && (line.requested_gallons || line.requested_metric_tons)
      ).map(line => ({
        ...line,
        requested_gallons: line.requested_gallons ? parseFloat(line.requested_gallons) : 0,
        requested_metric_tons: line.requested_metric_tons ? parseFloat(line.requested_metric_tons) : null,
        metric_tons_per_gallon_conversion: line.metric_tons_per_gallon_conversion ? parseFloat(line.metric_tons_per_gallon_conversion) : null,
        price_per_gallon: line.price_per_gallon ? parseFloat(line.price_per_gallon) : null,
        price_per_metric_ton: line.price_per_metric_ton ? parseFloat(line.price_per_metric_ton) : null
      }));

      return await base44.entities.SalesOrder.update(id, {
        ...data,
        product_lines: cleanedProductLines,
        broker_commission: data.broker_commission ? parseFloat(data.broker_commission) : null,
        barge_charge: data.barge_charge ? parseFloat(data.barge_charge) : null
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      resetForm();
    },
    onError: (error) => {
      console.error('Failed to update order:', error);
      alert('Failed to update order. Please try again.');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId) => base44.entities.SalesOrder.update(orderId, { status: 'cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (error) => {
      console.error('Failed to cancel order:', error);
      alert('Failed to cancel order. Please try again.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (orderId) => base44.entities.SalesOrder.delete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (error) => {
      console.error('Failed to delete order:', error);
      alert('Failed to delete order. Please try again.');
    }
  });

  const archiveMutation = useMutation({
    mutationFn: (orderId) => {
      console.log('Archiving order:', orderId);
      return base44.entities.SalesOrder.update(orderId, { status: 'archived' });
    },
    onSuccess: (data, orderId) => {
      console.log('Archive successful for order:', orderId);
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (error, orderId) => {
      console.error('Failed to archive order:', orderId, error);
      alert('Failed to archive order. Please try again.');
    }
  });

  const unarchiveMutation = useMutation({
    mutationFn: (orderId) => base44.entities.SalesOrder.update(orderId, { status: 'dispatched' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (error) => {
      console.error('Failed to restore order:', error);
      alert('Failed to restore order. Please try again.');
    }
  });

  const handleDelete = (order) => {
    if (window.confirm(`Are you sure you want to permanently delete this order for ${order.customer_name} - ${order.vessel_name}? This action cannot be undone.`)) {
      deleteMutation.mutate(order.id);
    }
  };

  const handleArchive = (order) => {
    console.log('Archive button clicked for order:', order.id, order.customer_name);
    if (window.confirm(`Archive this order for ${order.customer_name}? It will be moved to your archived orders.`)) {
      console.log('User confirmed archive, calling mutation...');
      archiveMutation.mutate(order.id);
    } else {
      console.log('User cancelled archive');
    }
  };

  const handleUnarchive = (order) => {
    if (window.confirm(`Restore this order for ${order.customer_name} back to active orders?`)) {
      unarchiveMutation.mutate(order.id);
    }
  };

  const resetForm = () => {
    setFormData({
      market: '',
      customer_name: '',
      customer_po: '',
      vessel_name: '',
      broker_name: '',
      broker_commission: '',
      agent_name: '',
      method_of_delivery: '',
      destination: '',
      product_lines: [{ product_type: '', requested_gallons: '', requested_metric_tons: '', metric_tons_per_gallon_conversion: '', price_per_gallon: '', price_per_metric_ton: '', pricing_timing: 'Day of Delivery', mgo_api: '' }],
      barge_charge: '',
      requested_date: '',
      requested_time: '',
      priority: 'normal',
      is_hedged: false,
      notes: ''
    });
    setShowForm(false);
    setEditingOrder(null);
  };

  const handleEdit = (order) => {
    setEditingOrder(order);
    setFormData({
      market: order.market || '',
      customer_name: order.customer_name || '',
      customer_po: order.customer_po || '',
      vessel_name: order.vessel_name || '',
      broker_name: order.broker_name || '',
      broker_commission: order.broker_commission || '',
      agent_name: order.agent_name || '',
      method_of_delivery: order.method_of_delivery || '',
      destination: order.destination || '',
      product_lines: order.product_lines && order.product_lines.length > 0 
        ? order.product_lines.map(line => ({...line, pricing_timing: line.pricing_timing || 'Day of Delivery', price_per_metric_ton: line.price_per_metric_ton || '', mgo_api: line.mgo_api || ''}))
        : [{ product_type: '', requested_gallons: '', requested_metric_tons: '', metric_tons_per_gallon_conversion: '', price_per_gallon: '', price_per_metric_ton: '', pricing_timing: 'Day of Delivery' }],
      barge_charge: order.barge_charge || '',
      requested_date: order.requested_date || '',
      requested_time: order.requested_time || '',
      priority: order.priority || 'normal',
      is_hedged: order.is_hedged || false,
      notes: order.notes || ''
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate product lines - allow either gallons OR metric tons
    const hasValidProduct = formData.product_lines.some(line => 
      line.product_type && (line.requested_gallons || line.requested_metric_tons)
    );
    
    if (!hasValidProduct) {
      alert('Please add at least one product with a product type and quantity (either gallons or metric tons).');
      return;
    }
    
    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const addProductLine = () => {
    if (formData.product_lines.length < 3) {
      setFormData({
        ...formData,
        product_lines: [...formData.product_lines, { product_type: '', requested_gallons: '', requested_metric_tons: '', metric_tons_per_gallon_conversion: '', price_per_gallon: '', price_per_metric_ton: '', pricing_timing: 'Day of Delivery', mgo_api: '' }]
      });
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCSV(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            orders: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  market: { type: "string" },
                  customer_name: { type: "string" },
                  vessel_name: { type: "string" },
                  destination: { type: "string" },
                  method_of_delivery: { type: "string" },
                  requested_date: { type: "string" },
                  requested_time: { type: "string" },
                  product_type: { type: "string" },
                  requested_gallons: { type: "number" },
                  price_per_gallon: { type: "number" },
                  pricing_timing: { type: "string" },
                  notes: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (result.status === 'success' && result.output?.orders) {
        for (const orderData of result.output.orders) {
          await base44.entities.SalesOrder.create({
            market: orderData.market,
            customer_name: orderData.customer_name,
            vessel_name: orderData.vessel_name,
            destination: orderData.destination,
            method_of_delivery: orderData.method_of_delivery || 'Barge',
            requested_date: orderData.requested_date,
            requested_time: orderData.requested_time,
            product_lines: [{
              product_type: orderData.product_type,
              requested_gallons: orderData.requested_gallons,
              price_per_gallon: orderData.price_per_gallon,
              price_per_metric_ton: orderData.price_per_metric_ton,
              pricing_timing: orderData.pricing_timing || 'Day of Delivery'
            }],
            notes: orderData.notes,
            status: 'pending',
            submitted_by: currentUser?.email,
            submitted_by_name: currentUser?.full_name,
            submitted_date: new Date().toISOString()
          });
        }
        
        queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
        alert(`Successfully imported ${result.output.orders.length} orders from CSV`);
      } else {
        alert('Failed to parse CSV. Please check the format.');
      }
    } catch (error) {
      console.error('CSV upload error:', error);
      alert('Failed to upload CSV. Please try again.');
    } finally {
      setUploadingCSV(false);
      e.target.value = '';
    }
  };

  const removeProductLine = (index) => {
    if (formData.product_lines.length > 1) {
      setFormData({
        ...formData,
        product_lines: formData.product_lines.filter((_, i) => i !== index)
      });
    }
  };

  // MGO API lookup table (API -> GLS per MT API)
  const MGO_API_TABLE = {
    27.3:297.0,27.4:297.2,27.5:297.4,27.6:297.6,27.7:297.8,27.8:298.0,27.9:298.2,
    28.0:298.4,28.1:298.6,28.2:298.8,28.3:299.0,28.4:299.2,28.5:299.4,28.6:299.6,
    28.7:299.8,28.8:300.0,28.9:300.2,29.0:300.3,29.1:300.5,29.2:300.7,29.3:300.8,
    29.4:301.0,29.5:301.2,29.6:301.4,29.7:301.6,29.8:301.8,29.9:302.0,
    30.0:302.2,30.1:302.4,30.2:302.6,30.3:302.7,30.4:302.9,30.5:303.1,30.6:303.3,
    30.7:303.5,30.8:303.7,30.9:303.9,31.0:304.1,31.1:304.2,31.2:304.4,31.3:304.6,
    31.4:304.8,31.5:305.0,31.6:305.2,31.7:305.4,31.8:305.6,31.9:305.7,
    32.0:305.9,32.1:306.1,32.2:306.3,32.3:306.5,32.4:306.7,32.5:306.9,32.6:307.1,
    32.7:307.2,32.8:307.4,32.9:307.6,33.0:307.8,33.1:308.0,33.2:308.2,33.3:308.4,
    33.4:308.6,33.5:308.7,33.6:308.4,33.7:309.1,33.8:309.3,33.9:309.5,
    34.0:309.7,34.1:309.9,34.2:310.1,34.3:310.2,34.4:310.4,34.5:310.6,34.6:310.8,
    34.7:311.0,34.8:311.2,34.9:311.4,35.0:311.5,35.1:311.7,35.2:311.9,35.3:312.1,
    35.4:312.3,35.5:312.5,35.6:312.7,35.7:312.9,35.8:313.1,35.9:313.2,
    36.0:313.4,36.1:313.6,36.2:313.8,36.3:314.0,36.4:314.2,36.5:314.4,36.6:314.6,
    36.7:314.7,36.8:314.9,36.9:315.1,37.0:315.3,37.1:315.5,37.2:315.7,37.3:315.9,
    37.4:316.1,37.5:316.2,37.6:316.4,37.7:316.6,37.8:316.8,37.9:317.0,
    38.0:317.2,38.1:317.4,38.2:317.6,38.3:317.7,38.4:317.9,38.5:318.1,38.6:318.3,
    38.7:318.5,38.8:318.7,38.9:318.9,39.0:319.1,39.1:319.2,39.2:319.4,39.3:319.6,
    39.4:319.8,39.5:320.0,39.6:320.2,39.7:320.4,39.8:320.5,39.9:320.7,
    40.0:320.9,40.1:321.1
  };

  const getMGOConversionRate = (apiValue) => {
    if (!apiValue) return 306; // default if no API selected
    const key = parseFloat(parseFloat(apiValue).toFixed(1));
    return MGO_API_TABLE[key] || 306;
  };

  // Fixed conversion rates: gallons per metric ton
  const getConversionRate = (productType, mgoApi) => {
    if (productType === 'Marine Gas Oil (MGO)') {
      return getMGOConversionRate(mgoApi);
    }
    const conversions = {
      'Renewable Diesel (RD99)': 339,
      'ULSD Diesel': 316,
    };
    if (conversions[productType]) return conversions[productType];
    const product = cargoTypes.find(c => c.name === productType);
    return product?.gallons_per_metric_ton || null;
  };

  // Generate MGO API options (27.3 to 40.1 in 0.1 increments)
  const mgoApiOptions = Object.keys(MGO_API_TABLE).map(k => parseFloat(k)).sort((a, b) => a - b);

  const updateProductLine = (index, field, value) => {
    const newProductLines = [...formData.product_lines];
    const currentLine = newProductLines[index];
    
    // Update the field
    currentLine[field] = value;
    
    // Auto-calculate gallons from metric tons using fixed conversion rates
    if (field === 'requested_metric_tons' || field === 'product_type' || field === 'mgo_api') {
      const mt = parseFloat(currentLine.requested_metric_tons);
      const conversion = getConversionRate(currentLine.product_type, currentLine.mgo_api);
      
      if (!isNaN(mt) && mt > 0 && conversion) {
        currentLine.requested_gallons = (mt * conversion).toFixed(2);
        currentLine.metric_tons_per_gallon_conversion = 1 / conversion;
      } else if (field === 'requested_metric_tons' && (!mt || isNaN(mt))) {
        currentLine.requested_gallons = '';
        currentLine.metric_tons_per_gallon_conversion = '';
      }
    }
    
    // Auto-calculate metric tons from gallons using fixed conversion rates
    if (field === 'requested_gallons') {
      const gallons = parseFloat(currentLine.requested_gallons);
      const conversion = getConversionRate(currentLine.product_type, currentLine.mgo_api);
      
      if (!isNaN(gallons) && gallons > 0 && conversion) {
        currentLine.requested_metric_tons = (gallons / conversion).toFixed(3);
        currentLine.metric_tons_per_gallon_conversion = 1 / conversion;
      } else if (!gallons || isNaN(gallons)) {
        currentLine.requested_metric_tons = '';
        currentLine.metric_tons_per_gallon_conversion = '';
      }
    }
    
    setFormData({
      ...formData,
      product_lines: newProductLines
    });
  };

  // Calculate total for each line and grand total
  const calculateLineTotal = (line) => {
    // If priced per metric ton, use that
    if (line.price_per_metric_ton && line.requested_metric_tons) {
      const mt = parseFloat(line.requested_metric_tons) || 0;
      const priceMT = parseFloat(line.price_per_metric_ton) || 0;
      return mt * priceMT;
    }
    // Otherwise use price per gallon
    const gallons = parseFloat(line.requested_gallons) || 0;
    const price = parseFloat(line.price_per_gallon) || 0;
    return gallons * price;
  };

  const calculateGrandTotal = () => {
    const productTotal = formData.product_lines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
    const bargeCharge = parseFloat(formData.barge_charge) || 0;
    return productTotal + bargeCharge;
  };

  // Generate 24-hour time options with 30-minute increments
  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeOptions.push(timeString);
    }
  }

  // All orders are visible and editable by any user
  const myOrders = orders;
  const activeOrders = myOrders.filter(o => o.status !== 'archived');
  const archivedOrders = myOrders.filter(o => o.status === 'archived');
  const pendingOrders = activeOrders.filter(o => o.status === 'pending');
  const completedOrders = activeOrders.filter(o => o.status === 'dispatched');

  const renderOrderCard = (order, isArchived = false) => (
    <div
      key={order.id}
      className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-lg text-slate-900">{order.customer_name}</h3>
            <Badge className={`${statusColors[order.status]} border`}>
              {order.status}
            </Badge>
            {order.priority === 'urgent' && (
              <Badge className={`${priorityColors[order.priority]} border`}>
                <AlertCircle className="w-3 h-3 mr-1" />
                URGENT
              </Badge>
            )}
            {order.is_hedged && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 border">
                <Shield className="w-3 h-3 mr-1" />
                HEDGED
              </Badge>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-2 text-sm text-slate-600">
            <div><span className="font-medium">Vessel:</span> {order.vessel_name}</div>
            <div><span className="font-medium">Destination:</span> {order.destination}</div>
            {order.customer_po && (
              <div><span className="font-medium">Customer PO:</span> {order.customer_po}</div>
            )}
            <div><span className="font-medium">Market:</span> {order.market}</div>
            <div><span className="font-medium">Method:</span> {order.method_of_delivery}</div>
            {order.broker_name && (
              <div><span className="font-medium">Broker:</span> {order.broker_name}</div>
            )}
            {order.agent_name && (
              <div><span className="font-medium">Agent:</span> {order.agent_name}</div>
            )}
            <div>
              <span className="font-medium">Requested:</span>{' '}
              {format(parseISO(order.requested_date), 'MMM d, yyyy')}
              {order.requested_time && ` at ${order.requested_time}`}
            </div>
            <div>
              <span className="font-medium">Submitted:</span>{' '}
              {order.submitted_by_name || 'Unknown'} on {order.submitted_date ? format(parseISO(order.submitted_date), 'MMM d, yyyy') : '—'}
            </div>
          </div>
          {order.product_lines && order.product_lines.length > 0 && (
            <div className="mt-3 p-3 bg-slate-50 rounded border border-slate-200">
              <p className="text-xs font-semibold text-slate-700 mb-2">Product Lines:</p>
              {order.product_lines.map((line, idx) => (
                <div key={idx} className="text-sm text-slate-600 mb-1">
                  {line.product_type}: {line.requested_gallons?.toLocaleString()} gal
                  {line.requested_metric_tons && ` (${line.requested_metric_tons} MT)`}
                  {line.price_per_metric_ton && line.requested_metric_tons && 
                    ` @ $${line.price_per_metric_ton}/MT = $${(line.requested_metric_tons * line.price_per_metric_ton).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                  {!line.price_per_metric_ton && line.price_per_gallon && 
                    ` @ $${line.price_per_gallon}/gal = $${(line.requested_gallons * line.price_per_gallon).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                  {line.pricing_timing && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                      {line.pricing_timing}
                    </span>
                  )}
                </div>
              ))}
              {order.product_lines.some(line => line.price_per_gallon) && (
                <div className="pt-2 mt-2 border-t border-slate-300">
                  <div className="flex justify-between text-sm text-slate-700">
                    <span>Product Total:</span>
                    <span>${order.product_lines.reduce((sum, line) => sum + ((line.requested_gallons || 0) * (line.price_per_gallon || 0)), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                  {order.barge_charge && (
                    <div className="flex justify-between text-sm font-semibold text-blue-700 mt-1">
                      <span>Barge Charge:</span>
                      <span>${parseFloat(order.barge_charge).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-slate-900 pt-2 mt-2 border-t border-slate-300">
                    <span>Grand Total:</span>
                    <span>${(order.product_lines.reduce((sum, line) => sum + ((line.requested_gallons || 0) * (line.price_per_gallon || 0)), 0) + (parseFloat(order.barge_charge) || 0)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {order.notes && (
            <div className="mt-2 pt-2 border-t border-slate-100 text-sm text-slate-700">
              <span className="font-medium">Notes:</span> {order.notes}
            </div>
          )}
          {order.status === 'dispatched' && order.dispatched_date && (
            <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-800">
              ✓ Dispatched on {format(parseISO(order.dispatched_date), 'MMM d, yyyy')}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {isArchived ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleUnarchive(order)}
              disabled={unarchiveMutation.isPending}
            >
              <ArchiveRestore className="w-4 h-4 mr-1" />
              Restore
            </Button>
          ) : (
            <>
              {order.status === 'pending' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(order)}
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => cancelMutation.mutate(order.id)}
                    disabled={cancelMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </>
              )}
              {order.status === 'dispatched' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleArchive(order)}
                  disabled={archiveMutation.isPending}
                >
                  <Archive className="w-4 h-4 mr-1" />
                  Archive
                </Button>
              )}
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(order)}
            disabled={deleteMutation.isPending}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-2">
              Sales Order Submission
            </h1>
            <p className="text-sm md:text-base text-slate-600">Submit delivery requests for dispatch scheduling</p>
          </div>
          <div className="flex gap-2 md:gap-3 flex-wrap w-full md:w-auto">
            <Button
              variant="outline"
              onClick={() => document.getElementById('csv-upload').click()}
              disabled={uploadingCSV}
            >
              <Plus className="w-5 h-5 mr-2" />
              {uploadingCSV ? 'Uploading...' : 'Upload CSV'}
            </Button>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSVUpload}
            />
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Order Request
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Pending Dispatch</p>
                  <p className="text-2xl md:text-3xl font-bold text-yellow-600">{pendingOrders.length}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Dispatched</p>
                  <p className="text-2xl md:text-3xl font-bold text-green-600">{completedOrders.length}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200 sm:col-span-2 lg:col-span-1">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-slate-600 mb-1">Total Active Orders</p>
                  <p className="text-2xl md:text-3xl font-bold text-slate-900">{activeOrders.length}</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
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
                    {editingOrder ? 'Edit Order Request' : 'Submit Order Request'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="method_of_delivery">Method of Delivery *</Label>
                        <Select
                          value={formData.method_of_delivery}
                          onValueChange={(value) => setFormData({...formData, method_of_delivery: value, market: ''})}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Barge">Barge</SelectItem>
                            <SelectItem value="Truck">Truck</SelectItem>
                            <SelectItem value="X-Pipe">X-Pipe (Fuel Dock Pipeline)</SelectItem>
                          </SelectContent>
                        </Select>
                        {formData.method_of_delivery === 'X-Pipe' && (
                          <p className="text-xs text-cyan-600 font-medium">
                            Shore-to-ship delivery via pipeline (Seattle Pier 15, LA Berth 258, P66 Richmond Dock)
                          </p>
                        )}
                        {formData.method_of_delivery === 'Truck' && (
                          <p className="text-xs text-blue-600 font-medium">
                            Trucking delivery operations (Richmond CA, Rancho Dominguez, Seattle)
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="market">Market *</Label>
                        <Select
                          value={formData.market}
                          onValueChange={(value) => setFormData({...formData, market: value})}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select market" />
                          </SelectTrigger>
                          <SelectContent>
                            {formData.method_of_delivery === 'Truck' ? (
                              <>
                                <SelectItem value="Richmond CA">Richmond CA</SelectItem>
                                <SelectItem value="Rancho Dominguez">Rancho Dominguez</SelectItem>
                                <SelectItem value="Seattle">Seattle</SelectItem>
                              </>
                            ) : formData.method_of_delivery === 'X-Pipe' ? (
                              <>
                                <SelectItem value="Seattle">Seattle</SelectItem>
                                <SelectItem value="Long Beach">Long Beach</SelectItem>
                                <SelectItem value="Oakland">Oakland</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="Long Beach">Long Beach</SelectItem>
                                <SelectItem value="Oakland">Oakland</SelectItem>
                                <SelectItem value="Portland">Portland</SelectItem>
                                <SelectItem value="Seattle">Seattle</SelectItem>
                                <SelectItem value="Wood River">Wood River (MS River)</SelectItem>
                                <SelectItem value="St. Louis">St. Louis (MS River)</SelectItem>
                                <SelectItem value="Wycliffe">Wycliffe (MS River)</SelectItem>
                                <SelectItem value="Memphis">Memphis (MS River)</SelectItem>
                                <SelectItem value="Baton Rouge">Baton Rouge (MS River)</SelectItem>
                                <SelectItem value="Mobile">Mobile (Gulf Coast)</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="customer_name">Customer Name *</Label>
                        <Input
                          id="customer_name"
                          value={formData.customer_name}
                          onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                          placeholder="Customer name"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="customer_po">Customer PO</Label>
                        <Input
                          id="customer_po"
                          value={formData.customer_po}
                          onChange={(e) => setFormData({...formData, customer_po: e.target.value})}
                          placeholder="PO number"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vessel_name">Vessel Name *</Label>
                        <Input
                          id="vessel_name"
                          value={formData.vessel_name}
                          onChange={(e) => setFormData({...formData, vessel_name: e.target.value})}
                          placeholder="Vessel name"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="broker_name">Broker Name</Label>
                        <Input
                          id="broker_name"
                          value={formData.broker_name}
                          onChange={(e) => setFormData({...formData, broker_name: e.target.value})}
                          placeholder="Broker name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="broker_commission">Broker Commission</Label>
                        <Input
                          id="broker_commission"
                          type="number"
                          step="0.01"
                          value={formData.broker_commission}
                          onChange={(e) => setFormData({...formData, broker_commission: e.target.value})}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="agent_name">Agent Name</Label>
                        <Input
                          id="agent_name"
                          value={formData.agent_name}
                          onChange={(e) => setFormData({...formData, agent_name: e.target.value})}
                          placeholder="Agent name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="destination">Destination *</Label>
                        <Input
                          id="destination"
                          value={formData.destination}
                          onChange={(e) => setFormData({...formData, destination: e.target.value})}
                          placeholder="Delivery location"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="requested_date">Requested Date *</Label>
                        <Input
                          id="requested_date"
                          type="date"
                          value={formData.requested_date}
                          onChange={(e) => setFormData({...formData, requested_date: e.target.value})}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="requested_time">Requested Time</Label>
                        <Select
                          value={formData.requested_time}
                          onValueChange={(value) => setFormData({...formData, requested_time: value})}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select time" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="TBD">Time not confirmed (TBD)</SelectItem>
                            {timeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select
                          value={formData.priority}
                          onValueChange={(value) => setFormData({...formData, priority: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Hedged Order Checkbox */}
                    <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id="is_hedged"
                          checked={formData.is_hedged}
                          onCheckedChange={(checked) => setFormData({...formData, is_hedged: checked})}
                        />
                        <div className="flex-1">
                          <Label htmlFor="is_hedged" className="cursor-pointer flex items-center gap-2 text-base font-semibold">
                            <Shield className="w-5 h-5 text-purple-600" />
                            This order is hedged
                          </Label>
                          <p className="text-xs text-purple-700 mt-1">
                            Supply team will be notified immediately to update hedges book
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Product Lines */}
                    <div className="space-y-4 pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <Label className="text-lg font-semibold">Product Lines (up to 3)</Label>
                        {formData.product_lines.length < 3 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addProductLine}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Line
                          </Button>
                        )}
                      </div>

                      {formData.product_lines.map((line, index) => (
                        <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-slate-900">Line {index + 1}</h4>
                            {formData.product_lines.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeProductLine(index)}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                          <div className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                              <Label htmlFor={`product_${index}`}>Product *</Label>
                              <Select
                                value={line.product_type}
                                onValueChange={(value) => updateProductLine(index, 'product_type', value)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                 {getAvailableProducts().map((cargo) => (
                                   <SelectItem key={cargo.id} value={cargo.name}>
                                     {cargo.name}
                                   </SelectItem>
                                 ))}
                                </SelectContent>
                              </Select>
                              </div>

                              {line.product_type === 'Marine Gas Oil (MGO)' && (
                                <div className="space-y-2">
                                  <Label htmlFor={`mgo_api_${index}`}>MGO API Value</Label>
                                  <Select
                                    value={line.mgo_api ? String(line.mgo_api) : ''}
                                    onValueChange={(value) => updateProductLine(index, 'mgo_api', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select API..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[280px]">
                                      {mgoApiOptions.map((api) => (
                                        <SelectItem key={api} value={String(api)}>
                                          {api} API → {MGO_API_TABLE[api]} gal/MT
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {line.mgo_api && (
                                    <p className="text-xs text-blue-600 font-medium">
                                      Using {getMGOConversionRate(line.mgo_api)} gal/MT for API {line.mgo_api}
                                    </p>
                                  )}
                                </div>
                              )}

                              <div className="space-y-2">
                                <Label htmlFor={`timing_${index}`}>Priced As</Label>
                                <Select
                                  value={line.pricing_timing || 'Day of Delivery'}
                                  onValueChange={(value) => updateProductLine(index, 'pricing_timing', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Day of Delivery">Day of Delivery</SelectItem>
                                    <SelectItem value="Day of Loading">Day of Loading</SelectItem>
                                    <SelectItem value="On Invoice Price">On Invoice Price</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`price_${index}`}>Price/Gal</Label>
                                <Input
                                  id={`price_${index}`}
                                  type="number"
                                  step="0.0001"
                                  value={line.price_per_gallon}
                                  onChange={(e) => updateProductLine(index, 'price_per_gallon', e.target.value)}
                                  placeholder="Optional"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`price_mt_${index}`}>Price/MT</Label>
                                <Input
                                  id={`price_mt_${index}`}
                                  type="number"
                                  step="0.01"
                                  value={line.price_per_metric_ton}
                                  onChange={(e) => updateProductLine(index, 'price_per_metric_ton', e.target.value)}
                                  placeholder="Optional"
                                />
                              </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor={`gallons_${index}`}>Gallons *</Label>
                                <Input
                                  id={`gallons_${index}`}
                                  type="number"
                                  value={line.requested_gallons}
                                  onChange={(e) => updateProductLine(index, 'requested_gallons', e.target.value)}
                                  placeholder="0"
                                />
                                {line.requested_gallons && getConversionRate(line.product_type) && (
                                  <p className="text-xs text-green-600">
                                    = {line.requested_metric_tons || '0'} MT
                                  </p>
                                )}
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`mt_${index}`}>Metric Tons *</Label>
                                <Input
                                  id={`mt_${index}`}
                                  type="number"
                                  step="0.001"
                                  value={line.requested_metric_tons}
                                  onChange={(e) => updateProductLine(index, 'requested_metric_tons', e.target.value)}
                                  placeholder="0.000"
                                />
                                {line.requested_metric_tons && getConversionRate(line.product_type) && (
                                  <p className="text-xs text-green-600">
                                    = {line.requested_gallons || '0'} gal
                                  </p>
                                )}
                              </div>
                            </div>

                            {(line.price_per_gallon || line.price_per_metric_ton) && (
                              <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-slate-700">Line Total:</span>
                                  <span className="text-lg font-bold text-emerald-600">
                                    ${calculateLineTotal(line).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {formData.product_lines.some(line => line.price_per_gallon) && (
                        <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-bold text-slate-900">Grand Total:</span>
                            <span className="text-2xl font-bold text-emerald-600">
                              ${calculateGrandTotal().toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </span>
                          </div>
                          {formData.barge_charge && parseFloat(formData.barge_charge) > 0 && (
                            <div className="mt-2 pt-2 border-t border-emerald-300 text-sm text-slate-700">
                              <div className="flex justify-between">
                                <span>Product Total:</span>
                                <span>${formData.product_lines.reduce((sum, line) => sum + calculateLineTotal(line), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                              </div>
                              <div className="flex justify-between font-semibold text-blue-700">
                                <span>Barge Charge:</span>
                                <span>${parseFloat(formData.barge_charge).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="barge_charge">Barge Charge (Optional)</Label>
                      <Input
                        id="barge_charge"
                        type="number"
                        step="0.01"
                        value={formData.barge_charge}
                        onChange={(e) => setFormData({...formData, barge_charge: e.target.value})}
                        placeholder="0.00"
                      />
                      <p className="text-xs text-slate-500">Flat fee for barge usage (e.g., $5000)</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        placeholder="Additional order details..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        className="bg-gradient-to-r from-emerald-600 to-emerald-700"
                      >
                        {createMutation.isPending || updateMutation.isPending 
                          ? (editingOrder ? 'Updating...' : 'Submitting...') 
                          : (editingOrder ? 'Update Order' : 'Submit Order')}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Orders List with Tabs */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900">All Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                <TabsTrigger value="active" className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Active Orders ({activeOrders.length})
                </TabsTrigger>
                <TabsTrigger value="archived" className="flex items-center gap-2">
                  <Archive className="w-4 h-4" />
                  Archived ({archivedOrders.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active">
                {activeOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No active orders</p>
                    <p className="text-sm mt-2">Submit your first order request above</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeOrders.map((order) => renderOrderCard(order, false))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="archived">
                {archivedOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Archive className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No archived orders</p>
                    <p className="text-sm mt-2">Completed orders you archive will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {archivedOrders.map((order) => renderOrderCard(order, true))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}