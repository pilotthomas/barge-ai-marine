import React from "react";
import { MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIONS, ALL_REGIONS } from "@/lib/regions";
import { useRegion } from "@/lib/RegionContext";

export default function RegionSwitcher() {
  const { region, setRegion, isAdmin, saving } = useRegion();

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 px-1 mb-1.5">Region</p>
      <Select value={region} onValueChange={setRegion} disabled={saving}>
        <SelectTrigger className="h-10 rounded-xl border-brand-muted bg-brand-soft text-sm font-medium text-brand-text hover:bg-brand-muted transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-brand shrink-0" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {REGIONS.map((r) => (
            <SelectItem key={r.key} value={r.key}>
              {r.label}
            </SelectItem>
          ))}
          {isAdmin && <SelectItem value={ALL_REGIONS}>All Regions</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  );
}