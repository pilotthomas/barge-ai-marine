import React from 'react';
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function MetricCard({ title, value, subtitle, icon: Icon, trend, trendUp }) {
  return (
    <Card className="p-6 hover:shadow-lg transition-all duration-300 bg-white border-slate-200">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2">{value}</h3>
          {subtitle && (
            <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-3">
              {trendUp ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${trendUp ? 'text-emerald-500' : 'text-red-500'}`}>
                {trend}
              </span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </Card>
  );
}