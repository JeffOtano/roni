/**
 * Time-decay helpers for recency-aware context formatting.
 * Used by buildTrainingSnapshot to vary detail level by age.
 */

export type RecencyLabel = "today" | "yesterday" | "this week" | "last week" | "older";

/**
 * Return the YYYY-MM-DD calendar day for a Date in the given IANA
 * timezone. Falls back to UTC if the timezone is missing or invalid.
 */
function calendarDay(date: Date, timeZone: string | undefined): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Unknown timezone — fall through to UTC.
  }
  return date.toISOString().slice(0, 10);
}

export function getRecencyLabel(
  isoTimestamp: string,
  now: Date = new Date(),
  timeZone?: string,
): RecencyLabel {
  const ts = new Date(isoTimestamp);
  const days = (now.getTime() - ts.getTime()) / 86_400_000;
  const tsDay = calendarDay(ts, timeZone);
  const nowDay = calendarDay(now, timeZone);
  if (tsDay === nowDay) return "today";
  // Check if ts is the previous calendar day
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  if (tsDay === calendarDay(yesterdayDate, timeZone)) return "yesterday";
  if (days < 7) return "this week";
  if (days < 14) return "last week";
  return "older";
}
