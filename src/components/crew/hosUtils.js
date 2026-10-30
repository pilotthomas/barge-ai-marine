import { format, subDays } from "date-fns";

// USCG 46 U.S.C. §8104(n) limits for tankermen/tank vessel crew
export const DAILY_LIMIT = 15; // max hours in any 24-hour period
export const ROLLING_72_LIMIT = 36; // max hours in any 72-hour period

// Analyze a worker's daily_hours array (chronological) against USCG limits.
// Returns per-day flags, 72h window violations, and remaining capacity.
export function analyzeWorker(record, today = new Date()) {
  const days = (record.daily_hours || []).map((d) => ({
    ...d,
    hours: Number(d.hours) || 0,
  }));

  // Per-day violations (>15h in a day)
  const dayViolations = days.filter((d) => d.hours > DAILY_LIMIT);

  // Rolling 72h (3 consecutive calendar days) violations (>36h)
  const windowViolations = [];
  for (let i = 0; i <= days.length - 3; i++) {
    const sum = days[i].hours + days[i + 1].hours + days[i + 2].hours;
    if (sum > ROLLING_72_LIMIT) {
      windowViolations.push({
        start: days[i].date,
        end: days[i + 2].date,
        hours: sum,
      });
    }
  }

  // Remaining capacity for today: constrained by the 15h daily limit AND
  // the 36h/72h rolling limit (today + prior 2 calendar days)
  const d1 = format(subDays(today, 1), "yyyy-MM-dd");
  const d2 = format(subDays(today, 2), "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");
  const hoursOn = (dateStr) => days.find((d) => d.date === dateStr)?.hours || 0;
  const prior48 = hoursOn(d1) + hoursOn(d2);
  const workedToday = hoursOn(todayStr);
  const remainingToday = Math.max(
    0,
    Math.min(DAILY_LIMIT - workedToday, ROLLING_72_LIMIT - prior48 - workedToday)
  );

  const last3 = days.slice(-3).reduce((s, d) => s + d.hours, 0);
  const maxDay = days.reduce((m, d) => Math.max(m, d.hours), 0);

  return {
    days,
    dayViolations,
    windowViolations,
    remainingToday,
    prior48,
    last3,
    maxDay,
    hasViolation: dayViolations.length > 0 || windowViolations.length > 0,
  };
}