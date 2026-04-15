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

/** Subtract one calendar day from a YYYY-MM-DD string. */
function prevCalendarDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}

/** Validate a user-supplied IANA timezone, returning undefined if invalid. */
export function sanitizeTimezone(tz: string | undefined): string | undefined {
  if (!tz || typeof tz !== "string") return undefined;
  const trimmed = tz.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return undefined;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return undefined;
  }
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
  if (tsDay === prevCalendarDay(nowDay)) return "yesterday";
  if (days < 7) return "this week";
  if (days < 14) return "last week";
  return "older";
}
