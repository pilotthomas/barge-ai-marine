import React, { createContext, useCallback, useContext, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ALL_REGIONS, ALL_MARKETS, getRegion, marketsForRegion } from "@/lib/regions";
import { setActiveRegion, clearRegionCache } from "@/lib/regionScope";
import RegionSelectPrompt from "@/components/region/RegionSelectPrompt";

const RegionContext = createContext(null);

const resolveSavedRegion = (user) => {
  const saved = user?.region;
  if (!saved) return null;
  if (saved === ALL_REGIONS) return user?.role === "admin" ? ALL_REGIONS : null;
  return getRegion(saved) ? saved : null;
};

export function RegionProvider({ user, children }) {
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const [region, setRegionState] = useState(() => {
    const saved = resolveSavedRegion(user);
    setActiveRegion(saved || ALL_REGIONS);
    return saved;
  });
  const [saving, setSaving] = useState(false);

  const setRegion = useCallback(
    async (next) => {
      if (!next || next === region) return;
      setSaving(true);
      setActiveRegion(next);
      clearRegionCache();
      setRegionState(next);
      await queryClient.resetQueries();
      await base44.auth.updateMe({ region: next });
      setSaving(false);
    },
    [queryClient, region]
  );

  if (!region) {
    return <RegionSelectPrompt userName={user?.full_name} isAdmin={isAdmin} saving={saving} onSelect={setRegion} />;
  }

  const isAllRegions = region === ALL_REGIONS;
  const value = {
    region,
    setRegion,
    saving,
    isAdmin,
    isAllRegions,
    markets: marketsForRegion(region),
    regionLabel: isAllRegions ? "All Regions" : getRegion(region)?.label,
  };

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

const FALLBACK = {
  region: ALL_REGIONS,
  setRegion: () => {},
  saving: false,
  isAdmin: false,
  isAllRegions: true,
  markets: ALL_MARKETS,
  regionLabel: "All Regions",
};

export const useRegion = () => useContext(RegionContext) || FALLBACK;