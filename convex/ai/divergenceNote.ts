import type { PushDivergence } from "../tonal/mutations";

export interface DayDivergence {
  dayName: string;
  divergence: PushDivergence;
}

/**
 * Build a one-line LLM warning that summarizes any per-day push divergence.
 * Returns empty string when there's nothing to report.
 */
export function formatPushDivergenceNote(perDay: DayDivergence[]): string {
  if (perDay.length === 0) return "";
  const days = perDay.map((d) => d.dayName).join(", ");
  const totalMissing = perDay.reduce((s, d) => s + d.divergence.missingMovements.length, 0);
  const totalMismatches = perDay.reduce((s, d) => s + d.divergence.setCountMismatches.length, 0);
  return `\n\nWARNING: Tonal stored ${perDay.length} workout(s) differently than sent (${days}). Missing movements across all days: ${totalMissing}. Set-count mismatches: ${totalMismatches}. Tell the user to spot-check these on their Tonal.`;
}
