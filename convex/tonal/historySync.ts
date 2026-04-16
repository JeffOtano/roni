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
  Movement,
  StrengthScoreHistoryEntry,
  WorkoutActivityDetail,
} from "./types";
import type { performanceValidator, workoutValidator } from "./historySyncMutations";
import { toUserProfileData } from "./profileData";
import { persistNewTableData } from "./enrichmentSync";
import { finalizeSuccessfulBackfill } from "./backfillCompletion";
import { type BackfillUserHistoryArgs, backfillUserHistoryWithDeps } from "./backfillRunner";
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
  straightBarIds?: ReadonlySet<string>,
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

  // Fetch formatted summary for per-movement totalVolume (optional).
  // totalVolume is a work-based metric (not weight x reps); kept for volume display.
  const volumeByMovement = new Map<string, number>();
  try {
    const summary = (await ctx.runAction(internal.tonal.proxy.fetchFormattedSummary, {
      userId,
      summaryId: activityId,
    })) as FormattedWorkoutSummary;
    for (const ms of summary.movementSets ?? []) {
      volumeByMovement.set(ms.movementId, ms.totalVolume);
    }
  } catch {
    // Summary optional
  }

  const sessionMap = aggregateDetailToSessions(detail, straightBarIds);
  const performances: PerformancePayload[] = [];
  for (const [movementId, snap] of sessionMap) {
    performances.push({
      activityId,
      movementId,
      date,
      sets: snap.sets,
      totalReps: snap.totalReps,
      avgWeightLbs: snap.avgWeightLbs,
      totalVolume: volumeByMovement.get(movementId),
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

  const movements: Movement[] = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);
  const straightBarIds = new Set(
    movements.filter((m) => m.onMachineInfo?.accessory === "StraightBar").map((m) => m.id),
  );

  for (let i = 0; i < activities.length; i += DETAIL_BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    const batch = activities.slice(i, i + DETAIL_BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((a) => processOneActivity(ctx, userId, a, straightBarIds)),
    );
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

/** Sync strength score history from the Tonal API. */
async function syncStrengthOnly(ctx: ActionCtx, userId: Id<"users">): Promise<void> {
  try {
    const strengthHistory: StrengthScoreHistoryEntry[] = await ctx.runAction(
      internal.tonal.proxy.fetchStrengthHistory,
      { userId },
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
}

/**
 * Diff activities against DB, fetch details, and persist.
 * When maxNew is set, only processes that many new activities per invocation.
 * Returns { synced, remaining } so the caller can schedule a continuation.
 */
async function syncActivitiesAndStrength(
  ctx: ActionCtx,
  userId: Id<"users">,
  activities: Activity[],
  maxNew?: number,
): Promise<{ synced: number; remaining: number }> {
  const allIds = activities.map((a) => a.activityId);
  const existingIds: string[] = await ctx.runQuery(
    internal.tonal.historySyncMutations.getExistingActivityIds,
    { userId, activityIds: allIds },
  );
  const existingSet = new Set(existingIds);
  const newActivities = activities.filter((a) => !existingSet.has(a.activityId));

  const batch = maxNew != null ? newActivities.slice(0, maxNew) : newActivities;
  const remaining = newActivities.length - batch.length;

  if (batch.length > 0) {
    const { workouts, performances } = await fetchAndBuildPayloads(ctx, userId, batch);
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

  // When maxNew is set, the caller (backfill) handles strength sync and
  // high-water mark in its own finalize step. Only run them here for
  // unbatched callers (incremental sync).
  if (remaining === 0 && maxNew == null) {
    await syncStrengthOnly(ctx, userId);
    if (activities.length > 0) {
      const newestDate = activities[activities.length - 1].activityTime.slice(0, 10);
      await ctx.runMutation(internal.userProfiles.updateLastSyncedActivityDate, {
        userId,
        date: newestDate,
      });
    }
  }

  return { synced: batch.length, remaining };
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
      profileData: toUserProfileData(u),
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
    if (await ctx.runQuery(internal.lib.auth.getDeletionInProgress, { userId })) return;
    const activities: Activity[] = await ctx.runAction(
      internal.tonal.workoutHistoryProxy.fetchWorkoutHistory,
      {
        userId,
      },
    );

    let synced = 0;
    if (activities.length > 0) {
      const result = await syncActivitiesAndStrength(ctx, userId, activities);
      synced = result.synced;
    }

    // Persist strength scores, muscle readiness, and external activities to DB
    await persistNewTableData(ctx, userId);

    // Always refresh profile (catches weight changes, etc.)
    await maybeRefreshProfile(ctx, userId);

    if (synced > 0) {
      console.log(`[historySync] Synced ${synced} new workouts for user ${userId}`);
    }

    analytics.capture(userId, "history_sync_completed", { new_workouts: synced });
    await analytics.flush();
  },
});

/** Page-by-page backfill. Each invocation fetches one API page (200 items),
 *  diffs against DB, processes up to 20 new workouts, then continues. */
export async function backfillUserHistoryHandler(
  ctx: ActionCtx,
  { userId, retryCount = 0, pgOffset = 0, newestActivityDate }: BackfillUserHistoryArgs,
): Promise<{ newWorkouts: number; totalActivities: number }> {
  if (await ctx.runQuery(internal.lib.auth.getDeletionInProgress, { userId })) {
    return { newWorkouts: 0, totalActivities: 0 };
  }

  return backfillUserHistoryWithDeps(
    {
      userId,
      retryCount,
      pgOffset,
      newestActivityDate,
    },
    {
      setSyncingStatus: () =>
        ctx.runMutation(internal.userProfiles.updateSyncStatus, {
          userId,
          syncStatus: "syncing",
        }),
      fetchWorkoutHistoryPage: ({ userId, offset }) =>
        ctx.runAction(internal.tonal.workoutHistoryProxy.fetchWorkoutHistoryPage, {
          userId,
          offset,
        }) as Promise<{ activities: Activity[]; pageSize: number; pgTotal: number }>,
      syncActivitiesAndStrength: (activities, maxNew) =>
        syncActivitiesAndStrength(ctx, userId, activities, maxNew),
      scheduleBackfill: (delayMs, args) =>
        ctx.scheduler.runAfter(delayMs, internal.tonal.historySync.backfillUserHistory, args),
      finalizeSuccessfulBackfill: (args) =>
        finalizeSuccessfulBackfill(args, {
          updateLastSyncedActivityDate: (args) =>
            ctx.runMutation(internal.userProfiles.updateLastSyncedActivityDate, args),
          syncStrengthOnly: () => syncStrengthOnly(ctx, userId),
          persistNewTableData: () => persistNewTableData(ctx, userId),
          maybeRefreshProfile: () => maybeRefreshProfile(ctx, userId),
          updateSyncStatus: (args) => ctx.runMutation(internal.userProfiles.updateSyncStatus, args),
          captureHistorySyncCompleted: (props) =>
            analytics.capture(userId, "history_sync_completed", props),
          flushAnalytics: () => analytics.flush(),
          logWarning: (message) => console.warn(message),
        }),
      markFailed: () =>
        ctx.runMutation(internal.userProfiles.updateSyncStatus, {
          userId,
          syncStatus: "failed",
        }),
      notifyBackfillFailed: (message) =>
        ctx.runAction(internal.discord.notifyError, {
          source: "backfillUserHistory",
          message,
          userId,
        }),
      logInfo: (message) => console.log(message),
      logError: (message, error) => console.error(message, error),
    },
  );
}

export const backfillUserHistory = internalAction({
  args: {
    userId: v.id("users"),
    retryCount: v.optional(v.number()),
    pgOffset: v.optional(v.number()),
    newestActivityDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => backfillUserHistoryHandler(ctx, args),
});
