/**
 * Training history sync actions: incremental (cron) + backfill (on connect).
 *
 * Fetches Tonal workout activities, per-exercise performance, and strength
 * score snapshots, then persists via mutations in historySyncMutations.ts.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { aggregateDetailToSessions } from "../progressiveOverload";
import type {
  Activity,
  FormattedWorkoutSummary,
  StrengthScoreHistoryEntry,
  WorkoutActivityDetail,
} from "./types";
import type { performanceValidator, workoutValidator } from "./historySyncMutations";
import * as analytics from "../lib/posthog";

type WorkoutPayload = typeof workoutValidator.type;
type PerformancePayload = typeof performanceValidator.type;

const DETAIL_BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000;
const PROFILE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Activity detail fetching + payload building
// ---------------------------------------------------------------------------

/** Fetch detail/summary for one activity and return persistence payloads. */
async function processOneActivity(
  ctx: ActionCtx,
  userId: Id<"users">,
  activity: Activity,
): Promise<{ workout: WorkoutPayload; performances: PerformancePayload[] }> {
  const { activityId, activityTime, workoutPreview: p } = activity;
  const date = activityTime.slice(0, 10);

  const workout: WorkoutPayload = {
    activityId,
    date,
    title: p.workoutTitle,
    targetArea: p.targetArea,
    totalVolume: p.totalVolume,
    totalDuration: p.totalDuration,
    totalWork: p.totalWork,
    workoutType: p.workoutType,
    tonalWorkoutId: p.workoutId || undefined,
  };

  let detail: WorkoutActivityDetail | null = null;
  try {
    detail = (await ctx.runAction(internal.tonal.proxy.fetchWorkoutDetail, {
      userId,
      activityId,
    })) as WorkoutActivityDetail | null;
  } catch (err) {
    console.error(`[historySync] Detail fetch failed for ${activityId}`, err);
  }
  if (!detail) return { workout, performances: [] };

  // Fetch formatted summary for per-movement volume (optional)
  let volumeByMovement: Map<string, number> | undefined;
  try {
    const summary = (await ctx.runAction(internal.tonal.proxy.fetchFormattedSummary, {
      userId,
      summaryId: activityId,
    })) as FormattedWorkoutSummary;
    volumeByMovement = new Map<string, number>();
    for (const ms of summary.movementSets ?? []) {
      volumeByMovement.set(ms.movementId, ms.totalVolume);
    }
  } catch {
    // Summary optional -- we still have sets/reps from detail
  }

  const sessionMap = aggregateDetailToSessions(detail, volumeByMovement);
  const performances: PerformancePayload[] = [];
  for (const [movementId, snap] of sessionMap) {
    performances.push({
      activityId,
      movementId,
      date,
      sets: snap.sets,
      totalReps: snap.totalReps,
      avgWeightLbs: snap.avgWeightLbs,
      totalVolume: volumeByMovement?.get(movementId),
    });
  }

  return { workout, performances };
}

/** Fetch detail + summary for activities in batches with delay. */
async function fetchAndBuildPayloads(
  ctx: ActionCtx,
  userId: Id<"users">,
  activities: Activity[],
): Promise<{ workouts: WorkoutPayload[]; performances: PerformancePayload[] }> {
  const workouts: WorkoutPayload[] = [];
  const performances: PerformancePayload[] = [];

  for (let i = 0; i < activities.length; i += DETAIL_BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    const batch = activities.slice(i, i + DETAIL_BATCH_SIZE);

    const results = await Promise.allSettled(batch.map((a) => processOneActivity(ctx, userId, a)));
    for (const result of results) {
      if (result.status === "fulfilled") {
        workouts.push(result.value.workout);
        performances.push(...result.value.performances);
      } else {
        console.error("[historySync] Activity processing failed", result.reason);
      }
    }
  }
  return { workouts, performances };
}

// ---------------------------------------------------------------------------
// Shared orchestration: diff, fetch details, persist, sync strength
// ---------------------------------------------------------------------------

/** Diff activities against DB, fetch details, persist, and sync strength scores. */
async function syncActivitiesAndStrength(
  ctx: ActionCtx,
  userId: Id<"users">,
  activities: Activity[],
): Promise<number> {
  const allIds = activities.map((a) => a.activityId);
  const existingIds: string[] = await ctx.runQuery(
    internal.tonal.historySyncMutations.getExistingActivityIds,
    { userId, activityIds: allIds },
  );
  const existingSet = new Set(existingIds);
  const newActivities = activities.filter((a) => !existingSet.has(a.activityId));

  if (newActivities.length > 0) {
    const { workouts, performances } = await fetchAndBuildPayloads(ctx, userId, newActivities);
    if (workouts.length > 0) {
      await ctx.runMutation(internal.tonal.historySyncMutations.persistCompletedWorkouts, {
        userId,
        workouts,
      });
    }
    if (performances.length > 0) {
      await ctx.runMutation(internal.tonal.historySyncMutations.persistExercisePerformance, {
        userId,
        performances,
      });
    }
  }

  // Sync strength score history
  try {
    const strengthHistory: StrengthScoreHistoryEntry[] = await ctx.runAction(
      internal.tonal.proxy.fetchStrengthHistory,
      {
        userId,
      },
    );
    if (strengthHistory.length > 0) {
      const snapshots = strengthHistory.map((entry) => ({
        date: entry.activityTime.slice(0, 10),
        overall: entry.overall,
        upper: entry.upper,
        lower: entry.lower,
        core: entry.core,
        workoutActivityId: entry.workoutActivityId || undefined,
      }));
      await ctx.runMutation(internal.tonal.historySyncMutations.persistStrengthSnapshots, {
        userId,
        snapshots,
      });
    }
  } catch (err) {
    console.error("[historySync] Strength history sync failed", err);
  }

  // Update high-water mark
  const newestDate = activities[0].activityTime.slice(0, 10);
  await ctx.runMutation(internal.userProfiles.updateLastSyncedActivityDate, {
    userId,
    date: newestDate,
  });

  return newActivities.length;
}

/** Refresh profile data from Tonal API if >24h old. */
async function maybeRefreshProfile(ctx: ActionCtx, userId: Id<"users">): Promise<void> {
  const profile = await ctx.runQuery(internal.userProfiles.getByUserId, { userId });
  if (!profile) return;
  if (Date.now() - (profile.profileDataRefreshedAt ?? 0) < PROFILE_REFRESH_INTERVAL_MS) return;

  try {
    const u = await ctx.runAction(internal.tonal.proxy.fetchUserProfile, { userId });
    await ctx.runMutation(internal.userProfiles.updateProfileData, {
      userId,
      profileData: {
        firstName: u.firstName,
        lastName: u.lastName,
        heightInches: u.heightInches,
        weightPounds: u.weightPounds,
        gender: u.gender,
        level: u.tonalStatus ?? "",
        workoutsPerWeek: u.workoutsPerWeek,
        workoutDurationMin: u.workoutDurationMin ?? 0,
        workoutDurationMax: u.workoutDurationMax ?? 0,
        dateOfBirth: u.dateOfBirth || undefined,
        username: u.username || undefined,
        tonalCreatedAt: u.createdAt || undefined,
      },
    });
  } catch (err) {
    console.error("[historySync] Profile refresh failed", err);
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Incremental sync: persist new workouts since last sync. Called by cron. */
export const syncUserHistory = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const activities: Activity[] = await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
      userId,
      limit: 20,
    });

    let synced = 0;
    if (activities.length > 0) {
      synced = await syncActivitiesAndStrength(ctx, userId, activities);
    }

    // Always refresh profile (catches weight changes, etc.)
    await maybeRefreshProfile(ctx, userId);

    if (synced > 0) {
      console.log(`[historySync] Synced ${synced} new workouts for user ${userId}`);
    }

    analytics.capture(userId, "history_sync_completed", { new_workouts: synced });
    await analytics.flush();
  },
});

/** One-shot backfill on Tonal connect. Fetches deeper history. */
export const backfillUserHistory = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const activities: Activity[] = await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
      userId,
      limit: 100,
    });

    let synced = 0;
    if (activities.length > 0) {
      synced = await syncActivitiesAndStrength(ctx, userId, activities);
    }

    // Always refresh profile, even for new users with no workouts
    await maybeRefreshProfile(ctx, userId);

    console.log(
      `[historySync] Backfilled ${synced}/${activities.length} workouts for user ${userId}`,
    );

    analytics.capture(userId, "history_sync_completed", {
      new_workouts: synced,
      backfill: true,
    });
    await analytics.flush();
  },
});
