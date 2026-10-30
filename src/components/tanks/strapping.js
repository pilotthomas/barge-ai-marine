// Strapping-chart helpers: convert a physical gauge (innage) reading to gallons.
// Charts are stored on StorageTank.strapping_chart as [{ inches, gallons }] sorted by inches.
// Vertical tanks store one point per foot (the Inspectorate tables are linear within a foot,
// verified within ~1 gal of the 1/4" table); horizontal tanks store every inch.

export const hasChart = (tank) => Array.isArray(tank?.strapping_chart) && tank.strapping_chart.length >= 2;

const sortedChart = (tank) =>
  [...(tank?.strapping_chart || [])].filter((p) => p && p.inches != null && p.gallons != null).sort((a, b) => a.inches - b.inches);

export const maxGaugeInches = (tank) => {
  const c = sortedChart(tank);
  return c.length ? c[c.length - 1].inches : 0;
};

// Gallons at a gauge height (inches). Returns null when there's no chart or the reading is out of range.
export function gallonsAtInches(tank, inches) {
  const c = sortedChart(tank);
  if (c.length < 2 || inches == null || isNaN(inches)) return null;
  if (inches < c[0].inches || inches > c[c.length - 1].inches) return null;
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1];
    const b = c[i];
    if (inches <= b.inches) {
      const t = (inches - a.inches) / (b.inches - a.inches || 1);
      return Math.round(a.gallons + (b.gallons - a.gallons) * t);
    }
  }
  return Math.round(c[c.length - 1].gallons);
}

// Inverse lookup: gauge height (inches) for a gallon amount — used for "safe fill at X ft Y in".
export function inchesAtGallons(tank, gallons) {
  const c = sortedChart(tank);
  if (c.length < 2 || gallons == null) return null;
  if (gallons <= c[0].gallons) return c[0].inches;
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1];
    const b = c[i];
    if (gallons <= b.gallons) {
      const t = (gallons - a.gallons) / (b.gallons - a.gallons || 1);
      return a.inches + (b.inches - a.inches) * t;
    }
  }
  return c[c.length - 1].inches;
}

// Feet + inches + fraction (quarters/eighths) → total inches.
export const toInches = (ft, inch, frac) => (Number(ft) || 0) * 12 + (Number(inch) || 0) + (Number(frac) || 0);

// 101.5 → 8' 5 1/2"
export function formatGauge(totalInches) {
  if (totalInches == null || isNaN(totalInches)) return "—";
  const eighths = Math.round(totalInches * 8);
  const ft = Math.floor(eighths / 96);
  const remEighths = eighths - ft * 96;
  const inch = Math.floor(remEighths / 8);
  const frac = remEighths - inch * 8;
  const fracLabel = { 0: "", 1: " 1/8", 2: " 1/4", 3: " 3/8", 4: " 1/2", 5: " 5/8", 6: " 3/4", 7: " 7/8" }[frac];
  return `${ft}' ${inch}${fracLabel}"`;
}

export const FRACTIONS = [
  { label: "0", value: 0 },
  { label: "1/8", value: 0.125 },
  { label: "1/4", value: 0.25 },
  { label: "3/8", value: 0.375 },
  { label: "1/2", value: 0.5 },
  { label: "5/8", value: 0.625 },
  { label: "3/4", value: 0.75 },
  { label: "7/8", value: 0.875 },
];
