import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, X, Save, AlertCircle, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function EmailNotifications() {
  const [currentUser, setCurrentUser] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [editingMarket, setEditingMarket] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [tempEmails, setTempEmails] = useState([]);

  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: settings = [] } = useQuery({
    queryKey: ['email-notification-settings'],
    queryFn: () => base44.entities.EmailNotificationSettings.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EmailNotificationSettings.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-notification-settings'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EmailNotificationSettings.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-notification-settings'] });
      resetForm();
    },
  });

  const resetForm = () => {
    setEditingType(null);
    setEditingMarket(null);
    setEmailInput('');
    setTempEmails([]);
  };

  const handleEdit = (setting, market) => {
    setEditingType(setting.notification_type);
    setEditingMarket(market);
    setTempEmails(setting.recipient_emails || []);
  };

  const handleAddEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && !tempEmails.includes(email)) {
      setTempEmails([...tempEmails, email]);
      setEmailInput('');
    }
  };

  const handleRemoveEmail = (email) => {
    setTempEmails(tempEmails.filter(e => e !== email));
  };

  const handleSave = () => {
    const existing = settings.find(s => 
      s.notification_type === editingType && 
      (s.market || 'all') === editingMarket
    );
    
    if (existing) {
      updateMutation.mutate({
        id: existing.id,
        data: {
          notification_type: editingType,
          market: editingMarket,
          recipient_emails: tempEmails,
          is_active: true
        }
      });
    } else {
      createMutation.mutate({
        notification_type: editingType,
        market: editingMarket,
        recipient_emails: tempEmails,
        is_active: true
      });
    }
  };

  if (!currentUser) {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
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
            <p className="text-slate-600">Only administrators can manage email notifications.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const notificationTypes = [
    {
      key: 'order_confirmation',
      label: 'Order Confirmation',
      description: 'Sent to operations when a sales rep submits a new order'
    },
    {
      key: 'dispatch_confirmation',
      label: 'Dispatch Confirmations',
      description: 'Sent when a sales order is dispatched and scheduled for delivery'
    },
    {
      key: 'order_deletion',
      label: 'Order Deletions',
      description: 'Sent when a sales order is deleted from the queue'
    },
    {
      key: 'delivery_deletion',
      label: 'Delivery Deletions',
      description: 'Sent when a scheduled delivery is deleted'
    },
    {
      key: 'hedged_order',
      label: 'Hedged Order Alerts',
      description: 'Sent immediately when a sales rep submits a hedged order'
    },
    {
      key: 'daily_recap',
      label: 'Daily Operations Recap',
      description: 'Daily summary of gallons delivered (sent manually via Daily Recap page)'
    }
  ];

  const markets = ['all', 'Long Beach', 'Oakland', 'Portland', 'Seattle'];

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              Email Notifications
            </h1>
            <p className="text-slate-600">Configure who receives system email notifications</p>
          </div>
        </div>

        <Card className="shadow-md border-slate-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="space-y-2 text-sm text-slate-700">
              <p><strong>Note:</strong> Configure email recipients for different types of system notifications.</p>
              <p>The original submitter of a sales order will always receive the dispatch confirmation automatically.</p>
            </div>
          </CardContent>
        </Card>

        {notificationTypes.map((type) => {
          return (
            <Card key={type.key} className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-600" />
                    {type.label}
                  </CardTitle>
                  <p className="text-sm text-slate-600 mt-1">{type.description}</p>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {markets.map((market) => {
                    const setting = settings.find(s => 
                      s.notification_type === type.key && 
                      (s.market || 'all') === market
                    );
                    const isEditing = editingType === type.key && editingMarket === market;
                    const emails = isEditing ? tempEmails : (setting?.recipient_emails || []);

                    const marketColors = {
                      'all': 'bg-slate-100 text-slate-800 border-slate-200',
                      'Long Beach': 'bg-orange-100 text-orange-800 border-orange-200',
                      'Oakland': 'bg-emerald-100 text-emerald-800 border-emerald-200',
                      'Portland': 'bg-purple-100 text-purple-800 border-purple-200',
                      'Seattle': 'bg-blue-100 text-blue-800 border-blue-200'
                    };

                    return (
                      <div key={market} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={`${marketColors[market]} border text-sm`}>
                            {market === 'all' ? 'All Markets (Default)' : market}
                          </Badge>
                          {emails.length > 0 && (
                            <span className="text-xs text-slate-600">
                              {emails.length} {emails.length === 1 ? 'recipient' : 'recipients'}
                            </span>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-4">
                            {/* Add from users dropdown */}
                            {users.filter(u => u.email && !tempEmails.includes(u.email)).length > 0 && (
                              <div className="space-y-1">
                                <Label className="flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Add from Users</Label>
                                <Select onValueChange={(email) => {
                                  if (email && !tempEmails.includes(email)) {
                                    setTempEmails([...tempEmails, email]);
                                  }
                                }}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a user to add..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {users
                                      .filter(u => u.email && !tempEmails.includes(u.email))
                                      .map(u => (
                                        <SelectItem key={u.id} value={u.email}>
                                          {u.full_name} — {u.email}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            <div className="space-y-2">
                              <Label htmlFor={`email-${type.key}-${market}`}>Or type an email address</Label>
                              <div className="flex gap-2">
                                <Input
                                  id={`email-${type.key}-${market}`}
                                  type="email"
                                  value={emailInput}
                                  onChange={(e) => setEmailInput(e.target.value)}
                                  placeholder="email@example.com"
                                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmail())}
                                />
                                <Button type="button" onClick={handleAddEmail} variant="outline" size="sm">
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Recipients</Label>
                              {tempEmails.length === 0 ? (
                                <p className="text-sm text-slate-500 italic">No recipients configured</p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {tempEmails.map((email) => (
                                    <div key={email} className="bg-blue-100 px-3 py-2 rounded-lg flex items-center gap-2">
                                      <Mail className="w-4 h-4 text-blue-700" />
                                      <span className="text-sm text-blue-900">{email}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveEmail(email)}
                                        className="text-blue-700 hover:text-blue-900"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="bg-gradient-to-r from-blue-600 to-blue-700"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {emails.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">
                                {market === 'all' 
                                  ? 'No default recipients - will not send notifications unless market-specific is set' 
                                  : 'No recipients - will use default (All Markets) settings'}
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {emails.map((email) => (
                                  <div key={email} className="bg-white px-2 py-1 rounded border border-slate-200 flex items-center gap-2">
                                    <Mail className="w-3 h-3 text-slate-600" />
                                    <span className="text-xs text-slate-900">{email}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <Button
                              onClick={() => handleEdit(
                                setting || { notification_type: type.key, market: market, recipient_emails: [] },
                                market
                              )}
                              variant="outline"
                              size="sm"
                            >
                              {emails.length === 0 ? 'Configure' : 'Edit'}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}