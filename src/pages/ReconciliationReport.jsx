import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Ship, Calendar, Mail, Download, CheckCircle, TrendingUp } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function ReconciliationReport() {
  const [selectedBarge, setSelectedBarge] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [emailRecipients, setEmailRecipients] = useState("ca.orders@ptlmarine.com");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data: barges = [] } = useQuery({
    queryKey: ['barges'],
    queryFn: () => base44.entities.Barge.list(),
  });

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

  const { data: bargeTransfers = [] } = useQuery({
    queryKey: ['barge-transfers'],
    queryFn: () => base44.entities.BargeTransfer.list('-transfer_date'),
  });

  const { data: inventoryHistory = [] } = useQuery({
    queryKey: ['inventory-history'],
    queryFn: () => base44.entities.InventoryHistory.list('-snapshot_date', 2000),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const monthYearStr = format(selectedMonth, 'yyyy-MM');

  const filteredBarges = selectedBarge === "all" ? barges : barges.filter(b => b.id === selectedBarge);

  // Calculate discrepancies for all barges and products
  const calculateAllDiscrepancies = () => {
    const allDiscrepancies = [];
    const lastKnownPhysicalReading = {};

    filteredBarges.forEach(barge => {
      const bargeTanks = inventory.filter(t => t.barge_id === barge.id);
      const productTypes = new Set();
      
      bargeTanks.forEach(t => { if (t.product_type) productTypes.add(t.product_type); });
      deliveries.filter(d => d.barge_id === barge.id && d.cargo_type).forEach(d => productTypes.add(d.cargo_type));
      loadingEvents.filter(l => l.barge_id === barge.id && l.product_type).forEach(l => productTypes.add(l.product_type));
      bargeTransfers.filter(t => t.from_barge_id === barge.id && t.product_type).forEach(t => productTypes.add(t.product_type));
      bargeTransfers.filter(t => t.to_barge_id === barge.id && (t.resulting_product_type || t.product_type)).forEach(t => productTypes.add(t.resulting_product_type || t.product_type));
      monthlySnapshots.filter(s => s.barge_id === barge.id && s.month_year === monthYearStr && s.product_type).forEach(s => productTypes.add(s.product_type));

      Array.from(productTypes).forEach(productType => {
        const snapshot = monthlySnapshots.find(s => 
          s.barge_id === barge.id && 
          s.month_year === monthYearStr && 
          s.product_type === productType
        );

        const beginningInventory = snapshot?.beginning_inventory || 0;

        // Calculate daily balances
        let runningBalance = beginningInventory;
        const daysInMonth = [];
        let currentDate = new Date(monthStart);
        
        while (currentDate <= monthEnd) {
          const dayStr = format(currentDate, 'yyyy-MM-dd');
          const today = format(new Date(), 'yyyy-MM-dd');
          
          // Skip future dates and today - only check past dates
          if (dayStr >= today) {
            runningBalance = runningBalance - 0 + 0 - 0 + 0; // No change, move to next day
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }
          
          const dayDeliveries = deliveries.filter(d => {
            if (!d.barge_id || d.barge_id !== barge.id) return false;
            if (d.cargo_type !== productType) return false;
            if (d.status !== 'delivered') return false;
            if (!d.start_date) return false;
            try {
              return format(parseISO(d.start_date), 'yyyy-MM-dd') === dayStr;
            } catch (e) {
              return false;
            }
          });
          
          const dayLoadings = loadingEvents.filter(l => {
            if (!l.barge_id || l.barge_id !== barge.id) return false;
            if (l.product_type !== productType) return false;
            if (l.status !== 'completed') return false;
            if (!l.scheduled_date) return false;
            try {
              return format(parseISO(l.scheduled_date), 'yyyy-MM-dd') === dayStr;
            } catch (e) {
              return false;
            }
          });

          const dayTransfersOut = bargeTransfers.filter(t => {
            if (!t.from_barge_id || t.from_barge_id !== barge.id) return false;
            if (t.product_type !== productType) return false;
            if (!t.transfer_date) return false;
            try {
              return format(parseISO(t.transfer_date), 'yyyy-MM-dd') === dayStr;
            } catch (e) {
              return false;
            }
          });

          const dayTransfersIn = bargeTransfers.filter(t => {
            if (!t.to_barge_id || t.to_barge_id !== barge.id) return false;
            if ((t.resulting_product_type || t.product_type) !== productType) return false;
            if (!t.transfer_date) return false;
            try {
              return format(parseISO(t.transfer_date), 'yyyy-MM-dd') === dayStr;
            } catch (e) {
              return false;
            }
          });
          
          const gallonsDelivered = dayDeliveries.reduce((sum, d) => sum + (d.gallons_delivered || 0), 0);
          const gallonsLoaded = dayLoadings.reduce((sum, l) => sum + (l.gallons_to_load || 0), 0);
          const gallonsTransferredOut = dayTransfersOut.reduce((sum, t) => sum + (t.gallons_transferred || 0), 0);
          const gallonsTransferredIn = dayTransfersIn.reduce((sum, t) => sum + (t.gallons_transferred || 0), 0);

          const endingBalance = runningBalance - gallonsDelivered + gallonsLoaded - gallonsTransferredOut + gallonsTransferredIn;

          // Track last known physical reading (will be carried forward if no reading exists for a day)
          const productKey = `${barge.id}-${productType}`;
          
          // Get physical readings for this day (all products on the barge)
          // IMPORTANT: We don't filter by product_type initially - we get all tank readings
          const dayHistoryRecords = inventoryHistory.filter(h => {
            if (h.barge_id !== barge.id) return false;
            if (!h.snapshot_date) return false;
            
            try {
              const recordDateKey = format(parseISO(h.snapshot_date), 'yyyy-MM-dd');
              return recordDateKey === dayStr;
            } catch (e) {
              return false;
            }
          });

          let physicalTotal = null;

          if (dayHistoryRecords.length > 0) {
            // Get latest reading per tank
            const tankReadings = {};
            dayHistoryRecords.forEach(record => {
              const tankKey = `${record.tank_number}-${record.tank_position}`;
              const recordTime = parseISO(record.snapshot_date).getTime();
              
              if (!tankReadings[tankKey] || recordTime > parseISO(tankReadings[tankKey].snapshot_date).getTime()) {
                tankReadings[tankKey] = record;
              }
            });
            
            // Sum only tanks that contain the specific product we're tracking
            const productSpecificTotal = Object.values(tankReadings)
              .filter(record => record.product_type === productType)
              .reduce((sum, record) => sum + (record.new_gallons || 0), 0);
            
            physicalTotal = productSpecificTotal;
            lastKnownPhysicalReading[productKey] = physicalTotal;
          } else if (lastKnownPhysicalReading[productKey] !== undefined) {
            // No reading for this day - carry forward the last known reading
            physicalTotal = lastKnownPhysicalReading[productKey];
          }

          if (physicalTotal !== null) {
              const difference = Math.abs(endingBalance - physicalTotal);
              const percentageVariance = Math.abs((difference / Math.max(endingBalance, physicalTotal)) * 100);

              // Flag if variance exceeds 2%
              if (percentageVariance > 2) {
                const scheduledDeliveries = deliveries.filter(d => {
                  if (!d.barge_id || d.barge_id !== barge.id) return false;
                  if (d.cargo_type !== productType) return false;
                  if (d.status !== 'scheduled' && d.status !== 'in_transit') return false;
                  if (!d.start_date) return false;
                  try {
                    return format(parseISO(d.start_date), 'yyyy-MM-dd') === dayStr;
                  } catch (e) {
                    return false;
                  }
                });

                allDiscrepancies.push({
                  barge: barge.name,
                  bargeId: barge.id,
                  productType,
                  date: new Date(currentDate),
                  dateStr: dayStr,
                  calculatedTotal: endingBalance,
                  physicalTotal,
                  difference,
                  percentageVariance,
                  hasUnclosedDeliveries: scheduledDeliveries.length > 0,
                  unclosedDeliveryCount: scheduledDeliveries.length,
                  severity: percentageVariance > 5 ? 'high' : percentageVariance > 3 ? 'medium' : 'low'
                });
              }
            }

          runningBalance = endingBalance;
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
    });

    return allDiscrepancies.sort((a, b) => b.date - a.date);
  };

  const allDiscrepancies = calculateAllDiscrepancies();
  const criticalDiscrepancies = allDiscrepancies.filter(d => d.severity === 'high');
  const mediumDiscrepancies = allDiscrepancies.filter(d => d.severity === 'medium');

  const handleSendEmail = async () => {
    if (!emailRecipients.trim()) {
      alert('Please enter at least one email recipient');
      return;
    }

    setIsSendingEmail(true);

    try {
      const emailBody = `
<h2>Weekly Inventory Reconciliation Report</h2>
<h3>${format(selectedMonth, 'MMMM yyyy')}</h3>

<p><strong>Report Generated:</strong> ${format(new Date(), 'MMMM d, yyyy HH:mm')}</p>
<p><strong>Generated By:</strong> ${currentUser?.full_name || 'System'}</p>

<hr/>

<h3>Summary</h3>
<ul>
  <li><strong>Total Discrepancies (>2%):</strong> ${allDiscrepancies.length}</li>
  <li><strong>Critical (>5%):</strong> ${criticalDiscrepancies.length}</li>
  <li><strong>Medium (3-5%):</strong> ${mediumDiscrepancies.length}</li>
  <li><strong>Barges Affected:</strong> ${new Set(allDiscrepancies.map(d => d.barge)).size}</li>
</ul>

<hr/>

${allDiscrepancies.length === 0 ? `
<div style="background-color: #d1fae5; border: 2px solid #10b981; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h3 style="color: #047857; margin: 0;">✅ All Clear!</h3>
  <p style="color: #065f46; margin: 8px 0 0 0;">No reconciliation discrepancies found for ${format(selectedMonth, 'MMMM yyyy')}. Rolling inventory matches physical tank levels.</p>
</div>
` : `
<h3>Discrepancies Requiring Attention</h3>

${allDiscrepancies.map((disc, idx) => `
<div style="background-color: ${disc.severity === 'high' ? '#fee2e2' : disc.severity === 'medium' ? '#fef3c7' : '#f1f5f9'}; border: 2px solid ${disc.severity === 'high' ? '#ef4444' : disc.severity === 'medium' ? '#f59e0b' : '#94a3b8'}; border-radius: 8px; padding: 16px; margin: 16px 0;">
  <h4 style="margin: 0 0 8px 0; color: #1e293b;">
    ${disc.barge} - ${disc.productType} - ${format(disc.date, 'MMMM d, yyyy')}
    ${disc.severity === 'high' ? '<span style="color: #dc2626; font-weight: bold;"> [CRITICAL]</span>' : ''}
  </h4>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr>
      <td style="padding: 4px 0;"><strong>Rolling Inventory:</strong></td>
      <td style="text-align: right;">${disc.calculatedTotal.toLocaleString()} gal</td>
    </tr>
    <tr>
      <td style="padding: 4px 0;"><strong>Physical Tank Levels:</strong></td>
      <td style="text-align: right;">${disc.physicalTotal.toLocaleString()} gal</td>
    </tr>
    <tr style="border-top: 1px solid #cbd5e1;">
      <td style="padding: 4px 0;"><strong style="color: #dc2626;">Difference:</strong></td>
      <td style="text-align: right;"><strong style="color: #dc2626;">${disc.difference.toLocaleString()} gallons</strong></td>
    </tr>
  </table>
  ${disc.hasUnclosedDeliveries ? `
    <div style="margin-top: 12px; padding: 8px; background-color: #fed7aa; border-left: 4px solid #ea580c; font-size: 13px;">
      <strong>⚠️ Action Required:</strong> ${disc.unclosedDeliveryCount} unclosed deliver${disc.unclosedDeliveryCount > 1 ? 'ies' : 'y'} on this date. Please close out all deliveries in the system.
    </div>
  ` : `
    <div style="margin-top: 12px; padding: 8px; background-color: #dbeafe; border-left: 4px solid #3b82f6; font-size: 13px;">
      <strong>📋 Action Required:</strong> Please verify physical tank gauging in Tank Levels History.
    </div>
  `}
</div>
`).join('')}
`}

<hr/>

<p style="font-size: 12px; color: #64748b; margin-top: 24px;">
  This is an automated report from BargeCom Delivery Management System.<br/>
  For questions, please contact your operations manager.
</p>
      `.trim();

      const recipients = emailRecipients.split(',').map(e => e.trim());
      
      await base44.functions.invoke('sendEmail', {
        to: recipients.join(','),
        subject: `Inventory Reconciliation Report - ${format(selectedMonth, 'MMMM yyyy')}`,
        html: emailBody
      });

      alert(`Report sent successfully to ${recipients.length} recipient(s)!`);
      setEmailRecipients("");
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const severityColors = {
    high: "bg-red-100 text-red-800 border-red-300",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
    low: "bg-blue-100 text-blue-800 border-blue-300"
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Inventory Reconciliation Report
            </h1>
            <p className="text-slate-600">Compare calculated rolling inventory vs physical tank readings</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handlePrint}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export/Print
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="shadow-md border-slate-200">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Month</Label>
                <Input
                  type="month"
                  value={format(selectedMonth, 'yyyy-MM')}
                  onChange={(e) => setSelectedMonth(new Date(e.target.value + '-01'))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Barge</Label>
                <Select value={selectedBarge} onValueChange={setSelectedBarge}>
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label>Quick Select</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMonth(new Date())}
                    className="flex-1"
                  >
                    Current Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedMonth(subMonths(new Date(), 1))}
                    className="flex-1"
                  >
                    Last Month
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Discrepancies</p>
                  <p className="text-3xl font-bold text-slate-900">{allDiscrepancies.length}</p>
                </div>
                <AlertTriangle className={`w-10 h-10 ${allDiscrepancies.length > 0 ? 'text-yellow-400' : 'text-slate-300'}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Critical (&gt;5%)</p>
                  <p className="text-3xl font-bold text-red-600">{criticalDiscrepancies.length}</p>
                </div>
                <AlertTriangle className={`w-10 h-10 ${criticalDiscrepancies.length > 0 ? 'text-red-400' : 'text-slate-300'}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Medium (3-5%)</p>
                  <p className="text-3xl font-bold text-yellow-600">{mediumDiscrepancies.length}</p>
                </div>
                <AlertTriangle className={`w-10 h-10 ${mediumDiscrepancies.length > 0 ? 'text-yellow-400' : 'text-slate-300'}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Barges Affected</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {new Set(allDiscrepancies.map(d => d.barge)).size}
                  </p>
                </div>
                <Ship className="w-10 h-10 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Email Notification Section */}
        <Card className="shadow-md border-blue-200 bg-blue-50">
          <CardHeader className="border-b border-blue-200">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Email This Report
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipients">Email Recipients (comma-separated)</Label>
                <Input
                  id="recipients"
                  value={emailRecipients}
                  onChange={(e) => setEmailRecipients(e.target.value)}
                  placeholder="john@example.com, jane@example.com"
                  className="bg-white"
                />
                <p className="text-xs text-slate-600">
                  Enter one or more email addresses separated by commas
                </p>
              </div>
              <Button
                onClick={handleSendEmail}
                disabled={isSendingEmail || !emailRecipients.trim()}
                className="bg-gradient-to-r from-blue-600 to-blue-700"
              >
                <Mail className="w-4 h-4 mr-2" />
                {isSendingEmail ? 'Sending...' : 'Send Weekly Report'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Discrepancies List */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900">
              Discrepancies for {format(selectedMonth, 'MMMM yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {allDiscrepancies.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">All Clear! 🎉</h3>
                <p className="text-slate-600">
                  No reconciliation discrepancies found for {format(selectedMonth, 'MMMM yyyy')}.
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  Rolling inventory matches physical tank levels.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {allDiscrepancies.map((disc, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 ${
                      disc.severity === 'high'
                        ? 'bg-red-50 border-red-300'
                        : disc.severity === 'medium'
                        ? 'bg-yellow-50 border-yellow-300'
                        : 'bg-blue-50 border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`w-5 h-5 ${
                          disc.severity === 'high' ? 'text-red-600' : 
                          disc.severity === 'medium' ? 'text-yellow-600' : 
                          'text-blue-600'
                        }`} />
                        <div>
                          <h3 className="font-bold text-lg text-slate-900">
                            {disc.barge} - {disc.productType}
                          </h3>
                          <p className="text-sm text-slate-600 flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {format(disc.date, 'EEEE, MMMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${severityColors[disc.severity]} border`}>
                        {disc.severity.toUpperCase()} PRIORITY
                      </Badge>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 mb-3">
                      <div className="p-3 bg-white rounded border border-slate-200">
                        <p className="text-xs text-slate-600 mb-1">Rolling Inventory (Calculated)</p>
                        <p className="text-xl font-bold text-slate-900">
                          {disc.calculatedTotal.toLocaleString()} gal
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded border border-slate-200">
                        <p className="text-xs text-slate-600 mb-1">Physical Tank Levels</p>
                        <p className="text-xl font-bold text-slate-900">
                          {disc.physicalTotal.toLocaleString()} gal
                        </p>
                      </div>

                      <div className="p-3 bg-white rounded border border-red-200">
                        <p className="text-xs text-red-600 mb-1">Difference</p>
                        <p className="text-xl font-bold text-red-600">
                          {disc.difference.toLocaleString()} gal
                        </p>
                        <p className="text-xs text-red-500 mt-1">
                          ({((disc.difference / disc.calculatedTotal) * 100).toFixed(1)}%)
                        </p>
                      </div>
                    </div>

                    <div className={`p-3 rounded ${
                      disc.hasUnclosedDeliveries 
                        ? 'bg-orange-100 border border-orange-300' 
                        : 'bg-blue-100 border border-blue-300'
                    }`}>
                      <p className="text-sm font-semibold text-slate-900 mb-1">
                        {disc.hasUnclosedDeliveries ? '⚠️ Likely Cause:' : '📋 Recommended Action:'}
                      </p>
                      <p className="text-sm text-slate-700">
                        {disc.hasUnclosedDeliveries 
                          ? `${disc.unclosedDeliveryCount} unclosed deliver${disc.unclosedDeliveryCount > 1 ? 'ies' : 'y'} on this date. Please close out all deliveries in the Deliveries page to update rolling inventory.`
                          : 'No unclosed deliveries found. Please verify physical tank gauging accuracy in Tank Levels → History tab. Consider re-checking measurements.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}