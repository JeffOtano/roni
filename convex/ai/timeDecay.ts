/**
 * Time-decay helpers for recency-aware context formatting.
 * Used by buildTrainingSnapshot to vary detail level by age.
 */

export type RecencyLabel = "today" | "yesterday" | "this week" | "last week" | "older";

export function getRecencyLabel(isoTimestamp: string, now: Date = new Date()): RecencyLabel {
  const ts = new Date(isoTimestamp);
  const days = (now.getTime() - ts.getTime()) / 86_400_000;
  if (days < 1 && ts.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) return "today";
  if (days < 2) return "yesterday";
  if (days < 7) return "this week";
  if (days < 14) return "last week";
  return "older";
}
