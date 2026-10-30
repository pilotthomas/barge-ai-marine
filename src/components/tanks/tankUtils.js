const productColorStyles = {
  "CARB Diesel": "bg-red-100 text-red-900 border-red-300",
  RD99: "bg-emerald-100 text-emerald-900 border-emerald-300",
  MGO: "bg-orange-100 text-orange-900 border-orange-300",
  ULSD: "bg-amber-100 text-amber-900 border-amber-300",
  default: "bg-blue-100 text-blue-900 border-blue-300",
};

export const getProductColor = (productType) =>
  productColorStyles[productType] || productColorStyles.default;

export const fillPercent = (gallons, capacity) =>
  capacity ? Math.max(0, Math.round((gallons / capacity) * 100)) : 0;

export const fillBarColor = (pct) =>
  pct > 80 ? "bg-emerald-500" : pct > 50 ? "bg-sky-500" : pct > 20 ? "bg-amber-500" : "bg-red-500";

export const ACTIVE_DELIVERY_STATUSES = ["scheduled", "in_progress"];

export const tankLabel = (tank) =>
  tank ? `${tank.tank_number}${tank.product_type ? ` · ${tank.product_type}` : ""}` : "";