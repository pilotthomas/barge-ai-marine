// Single source of truth for operating regions and the markets that belong to them.
export const REGIONS = [
  // sharedCrew: crew in any market of this region can be assigned to any barge in the region.
  { key: "PNW", label: "Pacific Northwest", short: "PNW", markets: ["Portland", "Seattle"], sharedCrew: true },
  { key: "California", label: "California", short: "CA", markets: ["Long Beach", "Oakland"] },
  {
    key: "Marine East",
    label: "Marine East",
    short: "East",
    markets: ["Wood River", "St. Louis", "Wickliffe", "Memphis", "Baton Rouge", "Mobile"],
  },
];

export const ALL_REGIONS = "all";
export const ALL_MARKETS = REGIONS.flatMap((r) => r.markets);

// Facilities / legacy market names that aren't a canonical market but clearly belong to a region.
const LOCATION_ALIASES = {
  "Richmond": "California",
  "Rancho Dominguez": "California",
  "Huntington Beach": "California",
  "San Francisco": "California",
  "Berth 258": "California",
  "LA Berth": "California",
  "Los Angeles": "California",
  "Port Hueneme": "California",
  "Wycliffe": "Marine East",
};

export const getRegion = (key) => REGIONS.find((r) => r.key === key) || null;

export const marketsForRegion = (key) => getRegion(key)?.markets ?? ALL_MARKETS;

// True when a crew member based in `crewMarket` can be assigned to work in `targetMarket`.
export function crewAvailableForMarket(crewMarket, targetMarket) {
  if (!crewMarket || !targetMarket) return false;
  if (crewMarket === targetMarket) return true;
  const region = REGIONS.find((r) => r.markets.includes(targetMarket));
  return !!(region?.sharedCrew && region.markets.includes(crewMarket));
}

export function regionForLocation(location) {
  if (!location || typeof location !== "string") return null;
  const name = location.trim();
  for (const r of REGIONS) if (r.markets.includes(name)) return r.key;
  if (LOCATION_ALIASES[name]) return LOCATION_ALIASES[name];
  const lower = name.toLowerCase();
  for (const r of REGIONS) {
    if (r.markets.some((m) => lower.includes(m.toLowerCase()))) return r.key;
  }
  for (const [alias, key] of Object.entries(LOCATION_ALIASES)) {
    if (lower.includes(alias.toLowerCase())) return key;
  }
  return null;
}

export const recordLocation = (record) =>
  record?.market || record?.facility || record?.facility_name || record?.fuel_dock_location || null;

// True when the record belongs to the region (records with no recognisable location pass through).
export function recordInRegion(record, regionKey) {
  if (!regionKey || regionKey === ALL_REGIONS) return true;
  // Records explicitly tagged with regions (e.g. products) are limited to those regions.
  if (Array.isArray(record?.regions) && record.regions.length > 0) return record.regions.includes(regionKey);
  const location = recordLocation(record);
  if (!location) return true;
  const found = regionForLocation(location);
  return found === null ? true : found === regionKey;
}