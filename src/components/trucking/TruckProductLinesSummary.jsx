import React from "react";

const fmt = (n) => (n === null || n === undefined || n === "" ? "—" : Number(n).toLocaleString());

// Compact read-only list of product lines with ordered vs delivered.
export default function TruckProductLinesSummary({ lines, className = "" }) {
  if (!lines || lines.length === 0) return null;
  return (
    <div className={`text-sm ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="text-xs text-slate-500 text-left">
            <th className="font-medium py-1">Product</th>
            <th className="font-medium py-1 text-right">Ordered</th>
            <th className="font-medium py-1 text-right">Delivered</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const short = l.delivered_qty !== null && l.delivered_qty !== undefined && l.ordered_qty !== null && l.ordered_qty !== undefined && Number(l.delivered_qty) !== Number(l.ordered_qty);
            return (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1 text-slate-900">{l.product_name}</td>
                <td className="py-1 text-right text-slate-700">{fmt(l.ordered_qty)} {l.unit}</td>
                <td className={`py-1 text-right font-semibold ${short ? "text-amber-700" : "text-slate-900"}`}>{fmt(l.delivered_qty)}{l.delivered_qty !== null && l.delivered_qty !== undefined ? ` ${l.unit}` : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
