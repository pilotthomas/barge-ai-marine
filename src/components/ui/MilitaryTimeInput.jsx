import React from "react";
import { Input } from "@/components/ui/input";

// 24-hour time entry stored as "HH:mm". Accepts "1430" or "14:30".
export default function MilitaryTimeInput({ value, onChange, ...props }) {
  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
    onChange(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
  };
  const handleBlur = () => {
    const digits = (value || "").replace(/\D/g, "");
    if (!digits) return;
    const padded = digits.length <= 2 ? digits.padStart(2, "0") + "00" : digits.padStart(4, "0");
    const h = Math.min(23, parseInt(padded.slice(0, 2), 10));
    const m = Math.min(59, parseInt(padded.slice(2), 10));
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };
  return <Input inputMode="numeric" placeholder="HH:MM (24h)" maxLength={5} value={value || ""} onChange={handleChange} onBlur={handleBlur} {...props} />;
}