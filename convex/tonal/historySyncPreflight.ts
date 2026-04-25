/**
 * Pure helper that decides whether to skip a cron-driven history sync.
 *
 * The cron runs every 30 minutes for active users; when the last sync just
 * happened and we already have a recent activity high-water mark, kicking off
 * the workflow again is wasted work. Conservative: when we cannot prove
 * freshness, return false so the sync proceeds.
 */

import { CACHE_TTLS } from "./cache";

const ACTIVITY_WATERMARK_FRESH_MS = 48 * 60 * 60 * 1000;

export interface PreflightInputs {
  now: number;
  workoutHistoryCacheFetchedAt: number | undefined;
  lastSyncedActivityDate: string | undefined;
  /** ISO date string for "today" in the timezone the watermark uses (UTC). */
  todayIso: string;
}

/** True when the workflow can safely skip; false means run it. */
export function shouldSkipBackgroundSync(inputs: PreflightInputs): boolean {
  const { now, workoutHistoryCacheFetchedAt, lastSyncedActivityDate, todayIso } = inputs;

  if (workoutHistoryCacheFetchedAt === undefined) return false;
  if (lastSyncedActivityDate === undefined) return false;

  // Cache must still be inside the proxy TTL — otherwise the workflow would
  // hit Tonal anyway, which is exactly what we'd want it to do.
  const cacheAge = now - workoutHistoryCacheFetchedAt;
  if (cacheAge < 0) return false;
  if (cacheAge >= CACHE_TTLS.workoutHistory) return false;

  // The watermark must be recent enough that we trust we are caught up. A
  // user returning after a multi-day gap should always sync, even if some
  // proxy call happened to populate the cache in the meantime.
  const watermarkMs = parseIsoDateUtc(lastSyncedActivityDate);
  if (watermarkMs === null) return false;
  const todayMs = parseIsoDateUtc(todayIso);
  if (todayMs === null) return false;

  const watermarkAge = todayMs - watermarkMs;
  if (watermarkAge < 0) return false;
  if (watermarkAge > ACTIVITY_WATERMARK_FRESH_MS) return false;

  return true;
}

/** Parse a YYYY-MM-DD string at UTC midnight, returning null if malformed. */
function parseIsoDateUtc(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(ms) ? null : ms;
}

export function isoDateUtc(now: number): string {
  const d = new Date(now);
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
