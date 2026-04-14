/**
 * Fetches enrichment data (strength scores, muscle readiness, external activities)
 * from the Tonal API and persists to local DB tables. Used by both the backfill
 * and the incremental cron sync.
 */

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { ExternalActivity, MuscleReadiness, StrengthScore } from "./types";

/** Fetch current strength scores, muscle readiness, and external activities, then persist to DB.
 *  Returns the number of datasets that failed to fetch (0 = all succeeded). */
export async function persistNewTableData(ctx: ActionCtx, userId: Id<"users">): Promise<number> {
  const results = await Promise.allSettled([
    ctx.runAction(internal.tonal.proxy.fetchStrengthScores, { userId }),
    ctx.runAction(internal.tonal.proxy.fetchMuscleReadiness, { userId }),
    ctx.runAction(internal.tonal.proxy.fetchExternalActivities, { userId, limit: 20 }),
  ]);

  let failures = 0;

  // Strength scores - persist even if empty (clears stale data)
  if (results[0].status === "fulfilled") {
    const scores = results[0].value as StrengthScore[];
    await ctx.runMutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: scores.map((s) => ({ bodyRegion: s.bodyRegionDisplay, score: s.score })),
    });
  } else {
    console.error("[historySync] Strength scores fetch failed", results[0].reason);
    failures++;
  }

  // Muscle readiness - persist even if null (clears stale data)
  if (results[1].status === "fulfilled") {
    const mr = results[1].value as MuscleReadiness | null;
    if (mr) {
      await ctx.runMutation(internal.tonal.historySyncMutations.persistMuscleReadiness, {
        userId,
        readiness: {
          chest: mr.Chest,
          shoulders: mr.Shoulders,
          back: mr.Back,
          triceps: mr.Triceps,
          biceps: mr.Biceps,
          abs: mr.Abs,
          obliques: mr.Obliques,
          quads: mr.Quads,
          glutes: mr.Glutes,
          hamstrings: mr.Hamstrings,
          calves: mr.Calves,
        },
      });
    } else {
      await ctx.runMutation(internal.tonal.historySyncMutations.clearMuscleReadiness, { userId });
    }
  } else {
    console.error("[historySync] Muscle readiness fetch failed", results[1].reason);
    failures++;
  }

  // External activities
  if (results[2].status === "fulfilled") {
    const activities = results[2].value as ExternalActivity[];
    if (activities.length > 0) {
      await ctx.runMutation(internal.tonal.historySyncMutations.persistExternalActivities, {
        userId,
        activities: activities.map((a) => ({
          externalId: a.externalId,
          workoutType: a.workoutType,
          beginTime: a.beginTime,
          totalDuration: a.totalDuration,
          activeCalories: a.activeCalories,
          totalCalories: a.totalCalories,
          averageHeartRate: a.averageHeartRate,
          source: a.source,
          distance: a.distance,
        })),
      });
    }
  } else {
    console.error("[historySync] External activities fetch failed", results[2].reason);
    failures++;
  }

  return failures;
}
