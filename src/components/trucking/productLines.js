export const TRUCK_UNITS = ["gal", "drum", "pail", "case", "tote", "each"];

export const emptyProductLine = () => ({ product_name: "", unit: "gal", ordered_qty: "", delivered_qty: "" });

const num = (v) => (v === "" || v === null || v === undefined || isNaN(parseFloat(v)) ? null : parseFloat(v));

// Normalise lines before saving: drop blank rows, coerce numbers.
export const cleanProductLines = (lines) =>
  (lines || [])
    .filter((l) => l && (l.product_name || "").trim())
    .map((l) => ({
      product_name: l.product_name.trim(),
      unit: l.unit || "gal",
      ordered_qty: num(l.ordered_qty),
      delivered_qty: num(l.delivered_qty),
    }));

// Sum of gallon-denominated lines for the given field; null when there are no gallon lines.
export const sumGallons = (lines, field) => {
  const gal = (lines || []).filter((l) => (l.unit || "gal") === "gal" && num(l[field]) !== null);
  return gal.length ? gal.reduce((s, l) => s + num(l[field]), 0) : null;
};

// Build product lines from a Sales Order's product_lines.
export const linesFromSalesOrder = (order) =>
  (order?.product_lines || [])
    .filter((l) => l.product_type)
    .map((l) => ({ product_name: l.product_type, unit: "gal", ordered_qty: num(l.requested_gallons), delivered_qty: null }));
