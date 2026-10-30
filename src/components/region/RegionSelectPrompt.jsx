import React from "react";
import { motion } from "framer-motion";
import { Droplet, Globe } from "lucide-react";
import { REGIONS, ALL_REGIONS } from "@/lib/regions";
import RegionOptionCard from "@/components/region/RegionOptionCard";

export default function RegionSelectPrompt({ userName, isAdmin, saving, onSelect }) {
  const firstName = userName?.split(" ")[0];
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-sky-50 via-white to-blue-100 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center mb-12"
        >
          <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-6">
            <Droplet className="w-6 h-6 text-white" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600 mb-3">MyBarge</p>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-900">
            {firstName ? `Welcome, ${firstName}.` : "Welcome."} Choose your region.
          </h1>
          <p className="mt-4 max-w-xl text-slate-500 leading-relaxed">
            You'll only see the barges, deliveries, orders and assets for the region you select. You can switch any time from the sidebar.
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-3">
          {REGIONS.map((region, i) => (
            <RegionOptionCard key={region.key} region={region} index={i} disabled={saving} onSelect={onSelect} />
          ))}
        </div>

        {isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-10 flex justify-center"
          >
            <button
              type="button"
              disabled={saving}
              onClick={() => onSelect(ALL_REGIONS)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors disabled:opacity-60"
            >
              <Globe className="w-4 h-4" />
              View all regions (admin)
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}