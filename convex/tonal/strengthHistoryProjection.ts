import { z } from "zod";
import type { StrengthScoreHistoryEntry } from "./types";

const strengthHistoryEntrySchema = z.object({
  workoutActivityId: z.string(),
  upper: z.number(),
  lower: z.number(),
  core: z.number(),
  overall: z.number(),
  activityTime: z.string(),
});

const strengthHistorySchema = z.array(strengthHistoryEntrySchema);

/**
 * Project a raw /v6/users/{id}/strength-scores/history response down to the
 * fields readers consume (chart axes, sync snapshots). Drops `id` and the
 * per-row `userId` since neither is read; both are fixed-size strings whose
 * removal compounds across hundreds of cached rows.
 */
export function projectStrengthHistory(raw: unknown): StrengthScoreHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const result = strengthHistorySchema.safeParse(raw);
  if (!result.success) {
    console.warn("projectStrengthHistory: schema mismatch", result.error.issues);
    return [];
  }
  return result.data;
}

/**
 * Strict variant for fresh API responses: throws on schema mismatch so
 * `cachedFetch` can fall back to stale data instead of caching an empty
 * placeholder that would mask upstream drift for the full TTL.
 */
export function projectStrengthHistoryStrict(raw: unknown): StrengthScoreHistoryEntry[] {
  if (!Array.isArray(raw)) {
    throw new Error(
      `projectStrengthHistoryStrict: expected array, got ${raw === null ? "null" : typeof raw}`,
    );
  }
  return strengthHistorySchema.parse(raw);
}
