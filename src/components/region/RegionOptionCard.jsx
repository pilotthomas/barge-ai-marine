import React from "react";
import { motion } from "framer-motion";
import { Trees, Sun, Anchor, ArrowRight } from "lucide-react";

const ICONS = { PNW: Trees, California: Sun, "Marine East": Anchor };
const TONES = {
  PNW: "from-emerald-500 to-teal-600",
  California: "from-amber-400 to-orange-500",
  "Marine East": "from-sky-500 to-blue-700",
};

export default function RegionOptionCard({ region, index, disabled, onSelect }) {
  const Icon = ICONS[region.key] || Anchor;
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(region.key)}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 * index, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="group relative w-full text-left rounded-3xl border border-white/70 bg-white/80 backdrop-blur p-7 shadow-[0_20px_60px_-30px_rgba(2,44,90,0.45)] transition-shadow hover:shadow-[0_30px_70px_-30px_rgba(2,44,90,0.55)] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${TONES[region.key]} flex items-center justify-center shadow-lg mb-6`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-1">{region.short}</p>
      <h3 className="text-2xl font-semibold text-slate-900 tracking-tight mb-3">{region.label}</h3>
      <p className="text-sm leading-relaxed text-slate-500">{region.markets.join(" · ")}</p>
      <div className="mt-6 flex items-center gap-2 text-sm font-medium text-sky-700">
        Enter region
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </div>
    </motion.button>
  );
}