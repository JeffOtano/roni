/**
 * Workout history fetch actions.
 * - fetchWorkoutHistory: recent 200 (for incremental sync)
 * - fetchWorkoutHistoryPage: single page at offset (for backfill)
 */

import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { fetchRecentWorkoutActivities, fetchWorkoutActivitiesPage } from "./client";
import { CACHE_TTLS } from "./cache";
import { cachedFetch, fetchWorkoutMetaBatch, toActivity } from "./proxy";
import { withTokenRetry } from "./tokenRetry";
import type { Activity, WorkoutActivityDetail } from "./types";

const GHOST_WORKOUT_ID = "00000000-0000-0000-0000-000000000000";

async function enrichWorkoutActivities(
  ctx: ActionCtx,
  token: string,
  items: WorkoutActivityDetail[],
): Promise<Activity[]> {
  const real = items.filter(
    (wa) => wa.workoutId !== GHOST_WORKOUT_ID || wa.totalVolume > 0 || wa.totalConcentricWork > 0,
  );
  if (real.length === 0) return [];
  const ids = [...new Set(real.map((w) => w.workoutId))];
  const meta = await fetchWorkoutMetaBatch(ctx, token, ids);
  return real.map((wa) => toActivity(wa, meta.get(wa.workoutId)));
}

/** Fetch recent workout history (newest 200). Used by incremental sync. */
export const fetchWorkoutHistory = internalAction({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }): Promise<Activity[]> =>
    withTokenRetry(ctx, userId, async (token, tonalUserId) => {
      const activities = await cachedFetch<Activity[]>(ctx, {
        userId,
        dataType: "workoutHistory_v3",
        ttl: CACHE_TTLS.workoutHistory,
        fetcher: async () => {
          const items = await fetchRecentWorkoutActivities<WorkoutActivityDetail>(
            token,
            tonalUserId,
          );
          return enrichWorkoutActivities(ctx, token, items);
        },
      });
      return limit != null ? activities.slice(0, limit) : activities;
    }),
});

/** Fetch one page of workout history at the given offset. Used by backfill to
 *  avoid loading all 1000+ workouts into one action's 64MB memory limit. */
export const fetchWorkoutHistoryPage = internalAction({
  args: { userId: v.id("users"), offset: v.number() },
  handler: async (
    ctx,
    { userId, offset },
  ): Promise<{ activities: Activity[]; pageSize: number; pgTotal: number }> =>
    withTokenRetry(ctx, userId, async (token, tonalUserId) => {
      const { items, pgTotal } = await fetchWorkoutActivitiesPage<WorkoutActivityDetail>(
        token,
        tonalUserId,
        offset,
      );
      const activities = await enrichWorkoutActivities(ctx, token, items);
      return { activities, pageSize: items.length, pgTotal };
    }),
});
