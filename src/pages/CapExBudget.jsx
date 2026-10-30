import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle, Ship } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function CapExBudget() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  const { data: tasks = [] } = useQuery({
    queryKey: ['maintenance-tasks'],
    queryFn: () => base44.entities.MaintenanceTask.list('-created_date'),
  });

  // Filter AFE items for selected year
  const afeItems = tasks.filter(task => {
    if (!task.is_afe_item) return false;
    
    // Filter by year based on drydock_out_of_water_date
    if (task.drydock_out_of_water_date) {
      const taskYear = new Date(task.drydock_out_of_water_date).getFullYear();
      return taskYear.toString() === selectedYear;
    }
    
    return false;
  });

  // Calculate totals
  const totalBudgeted = afeItems.reduce((sum, item) => sum + (parseFloat(item.budgeted_amount) || 0), 0);
  const totalActual = afeItems.reduce((sum, item) => sum + (parseFloat(item.final_charge) || 0), 0);
  const variance = totalBudgeted - totalActual;
  const variancePercent = totalBudgeted > 0 ? ((variance / totalBudgeted) * 100).toFixed(1) : 0;

  // Group by status
  const completedItems = afeItems.filter(t => t.status === 'completed' && t.final_charge);
  const inProgressItems = afeItems.filter(t => t.status !== 'completed');

  // Generate year options (current year and previous 2 years)
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].map(y => y.toString());

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
              CapEx Budget Report
            </h1>
            <p className="text-slate-600">AFE tracking and budget analysis</p>
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="shadow-md border-slate-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Budgeted</p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    ${totalBudgeted.toLocaleString()}
                  </h3>
                </div>
                <DollarSign className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Total Actual</p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    ${totalActual.toLocaleString()}
                  </h3>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Variance</p>
                  <h3 className={`text-2xl font-bold ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ${Math.abs(variance).toLocaleString()}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {variance >= 0 ? 'Under' : 'Over'} Budget ({Math.abs(variancePercent)}%)
                  </p>
                </div>
                {variance >= 0 ? (
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-slate-600 mb-1">AFE Items</p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {afeItems.length}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {completedItems.length} completed
                  </p>
                </div>
                <Ship className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed AFE Items Table */}
        <Card className="shadow-md border-slate-200">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-xl font-bold text-slate-900">
              AFE Items - {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {afeItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">No AFE Items</p>
                <p className="text-sm mt-2">No AFE items recorded for {selectedYear}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="text-left py-3 px-2 font-bold">Vessel</th>
                      <th className="text-left py-3 px-2 font-bold">Task</th>
                      <th className="text-left py-3 px-2 font-bold">AFE Request #</th>
                      <th className="text-left py-3 px-2 font-bold">AFE PO #</th>
                      <th className="text-left py-3 px-2 font-bold">Vendor</th>
                      <th className="text-right py-3 px-2 font-bold">Budgeted</th>
                      <th className="text-right py-3 px-2 font-bold">Actual</th>
                      <th className="text-right py-3 px-2 font-bold">Variance</th>
                      <th className="text-center py-3 px-2 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {afeItems.map((item) => {
                      const budgeted = parseFloat(item.budgeted_amount) || 0;
                      const actual = parseFloat(item.final_charge) || 0;
                      const itemVariance = budgeted - actual;
                      
                      return (
                        <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-3 px-2 font-medium">
                            <div>
                              <div className="font-bold text-slate-900">{item.vessel_name}</div>
                              <div className="text-xs text-slate-500 capitalize">{item.vessel_type}</div>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div>
                              <div className="font-medium text-slate-900">{item.task_name}</div>
                              {item.drydock_out_of_water_date && (
                                <div className="text-xs text-slate-500">
                                  {format(parseISO(item.drydock_out_of_water_date), 'MMM d, yyyy')}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-slate-700">{item.afe_request_number || '-'}</td>
                          <td className="py-3 px-2 text-slate-700">{item.afe_po_number || '-'}</td>
                          <td className="py-3 px-2 text-slate-700">{item.vendor_name || '-'}</td>
                          <td className="py-3 px-2 text-right font-medium text-slate-900">
                            ${budgeted.toLocaleString()}
                          </td>
                          <td className="py-3 px-2 text-right font-medium text-slate-900">
                            {actual > 0 ? `$${actual.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-3 px-2 text-right">
                            {actual > 0 ? (
                              <span className={`font-bold ${itemVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                ${Math.abs(itemVariance).toLocaleString()}
                                <div className="text-xs">
                                  {itemVariance >= 0 ? '▼ Under' : '▲ Over'}
                                </div>
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 px-2 text-center">
                            <Badge className={
                              item.status === 'completed' 
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : item.status === 'scheduled'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : 'bg-slate-100 text-slate-800 border-slate-200'
                            }>
                              {item.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* Totals Row */}
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                      <td colSpan="5" className="py-3 px-2 text-right">TOTAL:</td>
                      <td className="py-3 px-2 text-right text-slate-900">
                        ${totalBudgeted.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right text-slate-900">
                        ${totalActual.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className={`font-bold ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          ${Math.abs(variance).toLocaleString()}
                        </span>
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* In Progress vs Completed */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="shadow-md border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-900">
                In Progress ({inProgressItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {inProgressItems.length === 0 ? (
                <p className="text-center text-slate-500 py-4">No items in progress</p>
              ) : (
                <div className="space-y-3">
                  {inProgressItems.map(item => (
                    <div key={item.id} className="p-3 bg-blue-50 rounded border border-blue-200">
                      <div className="font-bold text-slate-900">{item.vessel_name}</div>
                      <div className="text-sm text-slate-600">{item.task_name}</div>
                      <div className="text-sm font-medium text-blue-600 mt-1">
                        Budget: ${(parseFloat(item.budgeted_amount) || 0).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-900">
                Completed ({completedItems.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {completedItems.length === 0 ? (
                <p className="text-center text-slate-500 py-4">No completed items</p>
              ) : (
                <div className="space-y-3">
                  {completedItems.map(item => {
                    const budgeted = parseFloat(item.budgeted_amount) || 0;
                    const actual = parseFloat(item.final_charge) || 0;
                    const itemVariance = budgeted - actual;
                    
                    return (
                      <div key={item.id} className="p-3 bg-emerald-50 rounded border border-emerald-200">
                        <div className="font-bold text-slate-900">{item.vessel_name}</div>
                        <div className="text-sm text-slate-600">{item.task_name}</div>
                        <div className="flex justify-between mt-1">
                          <span className="text-sm text-slate-600">
                            Budget: ${budgeted.toLocaleString()}
                          </span>
                          <span className="text-sm text-slate-600">
                            Actual: ${actual.toLocaleString()}
                          </span>
                        </div>
                        <div className={`text-sm font-bold mt-1 ${itemVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {itemVariance >= 0 ? '▼' : '▲'} ${Math.abs(itemVariance).toLocaleString()} {itemVariance >= 0 ? 'under' : 'over'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}