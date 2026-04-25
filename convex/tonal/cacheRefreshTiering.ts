/**
 * Pure helpers for tiering the refresh-tonal-cache cron by recent app activity.
 *
 * Active users get the existing 30-minute cadence; less-active cohorts back
 * off so the cron stops fanning out a sync to every connected user every run.
 */

const HOUR_MS = 60 * 60 * 1000;

/** Upper bound on `now - appLastActiveAt` for each tier. Strictly increasing. */
export const TIER_THRESHOLDS_MS = {
  active: 4 * HOUR_MS,
  recent: 24 * HOUR_MS,
  lapsing: 72 * HOUR_MS,
} as const;

/** Minimum interval between cron-driven syncs for each tier. */
export const TIER_INTERVALS_MS = {
  active: HOUR_MS / 2,
  recent: HOUR_MS,
  lapsing: 6 * HOUR_MS,
} as const;

// Cron interval scheduling skews by a few seconds; without slack a tier-1 user
// synced at T0 + 5s would be ineligible at T0 + 30m (only 29m55s elapsed).
export const TIER_INTERVAL_SLACK_MS = 60 * 1000;

export type RefreshTier = "active" | "recent" | "lapsing" | "skip";

export function classifyTier(now: number, appLastActiveAt: number | undefined): RefreshTier {
  if (appLastActiveAt === undefined) return "skip";
  const age = now - appLastActiveAt;
  if (age < 0) return "active";
  if (age < TIER_THRESHOLDS_MS.active) return "active";
  if (age < TIER_THRESHOLDS_MS.recent) return "recent";
  if (age < TIER_THRESHOLDS_MS.lapsing) return "lapsing";
  return "skip";
}

/** True when the user is eligible for a cron-driven background refresh. */
export function isEligibleForRefresh(
  now: number,
  appLastActiveAt: number | undefined,
  lastTonalSyncAt: number | undefined,
): boolean {
  const tier = classifyTier(now, appLastActiveAt);
  if (tier === "skip") return false;
  if (lastTonalSyncAt === undefined) return true;

  const elapsed = now - lastTonalSyncAt;
  return elapsed + TIER_INTERVAL_SLACK_MS >= TIER_INTERVALS_MS[tier];
}

/**
 * Earliest time the user becomes eligible for a refresh, given their current
 * tier and last-sync timestamp. Returned value matches `isEligibleForRefresh`:
 * once `now >= computeNextSyncAt(...)` the user is eligible.
 *
 * Returns undefined when the user is outside the 72h cohort — callers should
 * leave the indexed field unset so the cron's range query skips them.
 */
export function computeNextSyncAt(
  now: number,
  appLastActiveAt: number | undefined,
  lastTonalSyncAt: number | undefined,
): number | undefined {
  const tier = classifyTier(now, appLastActiveAt);
  if (tier === "skip") return undefined;
  if (lastTonalSyncAt === undefined) return 0;
  return lastTonalSyncAt + TIER_INTERVALS_MS[tier] - TIER_INTERVAL_SLACK_MS;
}
