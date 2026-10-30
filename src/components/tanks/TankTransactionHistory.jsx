import React from "react";
import { format, parseISO, addMonths, subMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, History, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { getProductColor } from "@/components/tanks/tankUtils";
import TransactionRowActions from "@/components/tanks/TransactionRowActions";

export default function TankTransactionHistory({ transactions, month, onMonthChange }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => onMonthChange(subMonths(month, 1))}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="text-lg font-semibold text-slate-900 min-w-[180px] text-center">{format(month, "MMMM yyyy")}</span>
        <Button variant="outline" size="icon" onClick={() => onMonthChange(addMonths(month, 1))}><ChevronRight className="w-4 h-4" /></Button>
      </div>
      <Card className="shadow-md border-slate-200 rounded-2xl">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg font-semibold text-slate-900">Transactions ({transactions.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-14 h-14 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-600">No truck movements recorded this month</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map((tx) => {
                const isIn = tx.transaction_type === "truck_in";
                return (
                  <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isIn ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                        {isIn ? <ArrowDownToLine className="w-5 h-5" /> : <ArrowUpFromLine className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{tx.tank_number} · {isIn ? "Received" : "Shipped"}</div>
                        <div className="text-sm text-slate-600">
                          {format(parseISO(tx.transaction_date), "MMM d, yyyy")}
                          {tx.truck_number && ` • Truck ${tx.truck_number}`}
                          {tx.bol_number && ` • BOL ${tx.bol_number}`}
                          {tx.driver_name && ` • ${tx.driver_name}`}
                        </div>
                        {(tx.customer || tx.supplier) && <div className="text-sm text-slate-500">{isIn ? tx.supplier : tx.customer}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-semibold tabular-nums ${isIn ? "text-emerald-600" : "text-red-600"}`}>{isIn ? "+" : "-"}{(tx.gallons || 0).toLocaleString()}</div>
                      <Badge className={`${getProductColor(tx.product_type)} border mt-1`}>{tx.product_type}</Badge>
                      <TransactionRowActions tx={tx} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}