import { ALL_REGIONS, recordInRegion, recordLocation } from "@/lib/regions";

// Entities whose records must never be narrowed by region.
const UNSCOPED_ENTITIES = new Set(["User"]);
const BARGE_CACHE_TTL_MS = 30_000;

let activeRegion = ALL_REGIONS;
let bargeCache = { region: null, at: 0, promise: null };

export const setActiveRegion = (region) => {
  activeRegion = region || ALL_REGIONS;
};
export const getActiveRegion = () => activeRegion;
export const clearRegionCache = () => {
  bargeCache = { region: null, at: 0, promise: null };
};

// Wraps the SDK entities client so every list()/filter() only returns records in the active region.
export function scopeEntities(rawEntities) {
  const regionBargeIds = (region) => {
    const fresh = bargeCache.region === region && Date.now() - bargeCache.at < BARGE_CACHE_TTL_MS;
    if (!fresh) {
      bargeCache = {
        region,
        at: Date.now(),
        promise: rawEntities.Barge.list().then(
          (barges) => new Set(barges.filter((b) => recordInRegion(b, region)).map((b) => b.id))
        ),
      };
    }
    return bargeCache.promise;
  };

  const filterRecords = async (records) => {
    const region = activeRegion;
    if (region === ALL_REGIONS || !Array.isArray(records)) return records;
    const needsBarges = records.some((r) => r && !recordLocation(r) && r.barge_id);
    const bargeIds = needsBarges ? await regionBargeIds(region) : null;
    return records.filter((r) => {
      if (!r) return false;
      if (Array.isArray(r.regions) && r.regions.length > 0) return r.regions.includes(region);
      if (recordLocation(r)) return recordInRegion(r, region);
      if (r.barge_id && bargeIds) return bargeIds.has(r.barge_id);
      return true;
    });
  };

  const wrapEntity = (entity) =>
    new Proxy(entity, {
      get(target, prop) {
        const value = Reflect.get(target, prop);
        if (typeof value !== "function") return value;
        if (prop === "list" || prop === "filter") {
          return (...args) => value.apply(target, args).then(filterRecords);
        }
        return value.bind(target);
      },
    });

  return new Proxy(rawEntities, {
    get(target, prop) {
      const entity = Reflect.get(target, prop);
      if (!entity || typeof entity !== "object" || UNSCOPED_ENTITIES.has(prop)) return entity;
      return wrapEntity(entity);
    },
  });
}