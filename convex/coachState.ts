import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, type QueryCtx } from "./_generated/server";
import { GARMIN_WELLNESS_SNAPSHOT_ROW_LIMIT } from "./ai/garminWellnessSnapshot";
import { isDeletionInProgress } from "./lib/auth";
import { MAX_RECENT_WELLNESS_DAILY_ROWS } from "./garmin/wellnessDaily";

// Limits mirror the per-source internal queries that gatherSnapshotInputs
// replaces. Keeping them here avoids cross-file drift when snapshot rendering
// changes its expected counts.
const RECENT_COMPLETED_WORKOUTS_LIMIT = 20;
const RECENT_FEEDBACK_LIMIT = 5;
const RECENT_EXTERNAL_ACTIVITIES_LIMIT = 20;
// Match the previous call-site computation in buildTrainingSnapshot so the
// formatter (which slices at GARMIN_WELLNESS_SNAPSHOT_ROW_LIMIT) doesn't pay
// for rows it then discards. Capped by the table's hard upper bound.
const GARMIN_WELLNESS_LIMIT = Math.min(
  GARMIN_WELLNESS_SNAPSHOT_ROW_LIMIT,
  MAX_RECENT_WELLNESS_DAILY_ROWS,
);

export interface SnapshotInputs {
  profile: Doc<"userProfiles"> | null;
  scores: Doc<"currentStrengthScores">[];
  readiness: Doc<"muscleReadiness"> | null;
  activities: Doc<"completedWorkouts">[];
  activeBlock: Doc<"trainingBlocks"> | null;
  recentFeedback: Doc<"workoutFeedback">[];
  activeGoals: Doc<"goals">[];
  activeInjuries: Doc<"injuries">[];
  externalActivities: Doc<"externalActivities">[];
  garminWellness: Doc<"garminWellnessDaily">[];
}

/**
 * Per-source resilience helper. If `read` rejects, return `fallback` so a
 * single sub-domain failure inside `gatherSnapshotInputs` does not poison
 * the other 9 reads. Exported for direct unit testing of the rejection path.
 */
export async function safe<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch {
    return fallback;
  }
}

/**
 * Single internal query that performs all 10 reads buildTrainingSnapshot
 * previously fanned out across separate runQuery calls. Inlining lets
 * `ctx.db.query` reads count under one function invocation instead of 10 —
 * see ADR 0001 §0 (Alt-A) for the cost rationale.
 *
 * Per-source try/catch preserves the today-shape graceful degradation: if any
 * one sub-domain read fails, that field is `[]` or `null` and the rest still
 * returns.
 */
export const gatherSnapshotInputs = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<SnapshotInputs> => {
    const profile = await safe(() => readUserProfile(ctx, userId), null);

    const [
      scores,
      readiness,
      activities,
      activeBlock,
      recentFeedback,
      activeGoals,
      activeInjuries,
      externalActivities,
      garminWellness,
    ] = await Promise.all([
      safe<Doc<"currentStrengthScores">[]>(
        () =>
          ctx.db
            .query("currentStrengthScores")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .collect(),
        [],
      ),
      safe<Doc<"muscleReadiness"> | null>(
        () =>
          ctx.db
            .query("muscleReadiness")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .first(),
        null,
      ),
      safe<Doc<"completedWorkouts">[]>(() => readRecentCompletedWorkouts(ctx, userId), []),
      safe<Doc<"trainingBlocks"> | null>(() => readActiveBlock(ctx, userId), null),
      safe<Doc<"workoutFeedback">[]>(
        () =>
          ctx.db
            .query("workoutFeedback")
            .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
            .order("desc")
            .take(RECENT_FEEDBACK_LIMIT),
        [],
      ),
      safe<Doc<"goals">[]>(
        () =>
          ctx.db
            .query("goals")
            .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "active"))
            .collect(),
        [],
      ),
      safe<Doc<"injuries">[]>(
        () =>
          ctx.db
            .query("injuries")
            .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "active"))
            .collect(),
        [],
      ),
      safe<Doc<"externalActivities">[]>(
        () =>
          ctx.db
            .query("externalActivities")
            .withIndex("by_userId_beginTime", (q) => q.eq("userId", userId))
            .order("desc")
            .take(RECENT_EXTERNAL_ACTIVITIES_LIMIT),
        [],
      ),
      safe<Doc<"garminWellnessDaily">[]>(
        () =>
          ctx.db
            .query("garminWellnessDaily")
            .withIndex("by_userId_calendarDate", (q) => q.eq("userId", userId))
            .order("desc")
            .take(GARMIN_WELLNESS_LIMIT),
        [],
      ),
    ]);

    return {
      profile,
      scores,
      readiness,
      activities,
      activeBlock,
      recentFeedback,
      activeGoals,
      activeInjuries,
      externalActivities,
      garminWellness,
    };
  },
});

async function readUserProfile(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"userProfiles"> | null> {
  // Mirrors internal.tonal.cache.getUserProfile: deletion-in-progress users
  // never expose profile data to downstream callers.
  if (await isDeletionInProgress(ctx, userId)) return null;
  return ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

async function readRecentCompletedWorkouts(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"completedWorkouts">[]> {
  // Mirror internal.tonal.syncQueries.getRecentCompletedWorkouts: over-read by
  // 3x then drop ghost entries (empty title) so the final list still hits the
  // requested count after filtering.
  const rows = await ctx.db
    .query("completedWorkouts")
    .withIndex("by_userId_date", (q) => q.eq("userId", userId))
    .order("desc")
    .take(RECENT_COMPLETED_WORKOUTS_LIMIT * 3);
  return rows.filter((r) => r.title !== "").slice(0, RECENT_COMPLETED_WORKOUTS_LIMIT);
}

async function readActiveBlock(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"trainingBlocks"> | null> {
  const blocks = await ctx.db
    .query("trainingBlocks")
    .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "active"))
    .collect();
  return blocks[0] ?? null;
}
