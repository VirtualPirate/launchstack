import type { BriefScheduleResponse } from "@launchstack/api-interfaces";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function cadenceLabel(schedule: BriefScheduleResponse): string {
  const time = schedule.cadence.time.slice(0, 5);
  const tz = schedule.timezone;
  if (schedule.cadence.type === "daily") return `Daily at ${time} ${tz}`;
  if (schedule.cadence.type === "weekly") {
    const day = DAYS[schedule.cadence.dayOfWeek] ?? "?";
    return `Weekly · ${day} at ${time} ${tz}`;
  }
  return `Monthly · day ${schedule.cadence.dayOfMonth} at ${time} ${tz}`;
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
