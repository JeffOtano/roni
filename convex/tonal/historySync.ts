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
import { toUserProfileData } from "./profileData";
import { persistNewTableData } from "./enrichmentSync";
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

const BACKFILL_MAX_RETRIES = 3;
const BACKFILL_RETRY_DELAYS = [30_000, 60_000, 120_000];
const BACKFILL_BATCH_SIZE = 20;
const BACKFILL_CONTINUATION_DELAY_MS = 5_000;

/** Page-by-page backfill. Each invocation fetches one API page (200 items),
 *  diffs against DB, processes up to 20 new workouts, then continues. */
export const backfillUserHistory = internalAction({
  args: {
    userId: v.id("users"),
    retryCount: v.optional(v.number()),
    pgOffset: v.optional(v.number()),
    newestActivityDate: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { userId, retryCount = 0, pgOffset = 0, newestActivityDate },
  ): Promise<{ newWorkouts: number; totalActivities: number }> => {
    if (await ctx.runQuery(internal.lib.auth.getDeletionInProgress, { userId })) {
      return { newWorkouts: 0, totalActivities: 0 };
    }
    if (retryCount === 0 && pgOffset === 0) {
      await ctx.runMutation(internal.userProfiles.updateSyncStatus, {
        userId,
        syncStatus: "syncing",
      });
    }

    try {
      const { activities, pageSize, pgTotal } = (await ctx.runAction(
        internal.tonal.workoutHistoryProxy.fetchWorkoutHistoryPage,
        { userId, offset: pgOffset },
      )) as { activities: Activity[]; pageSize: number; pgTotal: number };

      const { synced, remaining } =
        activities.length > 0
          ? await syncActivitiesAndStrength(ctx, userId, activities, BACKFILL_BATCH_SIZE)
          : { synced: 0, remaining: 0 };

      // Track the newest date seen across all pages (API returns oldest-first)
      const pageNewestDate =
        activities.length > 0
          ? activities[activities.length - 1].activityTime.slice(0, 10)
          : undefined;
      const bestDate = pageNewestDate ?? newestActivityDate;

      // More new workouts on this page to process
      if (remaining > 0) {
        console.log(
          `[historySync] Backfill page offset=${pgOffset}: ${synced} synced, ${remaining} remaining`,
        );
        await ctx.scheduler.runAfter(
          BACKFILL_CONTINUATION_DELAY_MS,
          internal.tonal.historySync.backfillUserHistory,
          { userId, retryCount, pgOffset, newestActivityDate: bestDate },
        );
        return { newWorkouts: synced, totalActivities: pgTotal };
      }

      // More pages to fetch (use raw pageSize, not filtered activities.length)
      const nextOffset = pgOffset + pageSize;
      if (nextOffset < pgTotal) {
        console.log(
          `[historySync] Backfill page offset=${pgOffset}: ${synced} synced, advancing to offset=${nextOffset}/${pgTotal}`,
        );
        await ctx.scheduler.runAfter(
          BACKFILL_CONTINUATION_DELAY_MS,
          internal.tonal.historySync.backfillUserHistory,
          { userId, retryCount, pgOffset: nextOffset, newestActivityDate: bestDate },
        );
        return { newWorkouts: synced, totalActivities: pgTotal };
      }

      // All pages processed - finalize
      if (bestDate) {
        await ctx.runMutation(internal.userProfiles.updateLastSyncedActivityDate, {
          userId,
          date: bestDate,
        });
      }
      await syncStrengthOnly(ctx, userId);
      const enrichmentFailures = await persistNewTableData(ctx, userId);
      await maybeRefreshProfile(ctx, userId);
      await ctx.runMutation(internal.userProfiles.updateSyncStatus, {
        userId,
        syncStatus: enrichmentFailures >= 3 ? "failed" : "complete",
      });

      console.log(`[historySync] Backfill complete for user ${userId} (${pgTotal} total)`);
      analytics.capture(userId, "history_sync_completed", { new_workouts: synced, backfill: true });
      await analytics.flush();

      return { newWorkouts: synced, totalActivities: pgTotal };
    } catch (err) {
      console.error(`[historySync] Backfill failed (attempt ${retryCount + 1})`, err);

      if (retryCount < BACKFILL_MAX_RETRIES) {
        const delay = BACKFILL_RETRY_DELAYS[retryCount] ?? 120_000;
        await ctx.scheduler.runAfter(delay, internal.tonal.historySync.backfillUserHistory, {
          userId,
          retryCount: retryCount + 1,
          pgOffset,
          newestActivityDate,
        });
        return { newWorkouts: 0, totalActivities: 0 };
      }

      await ctx.runMutation(internal.userProfiles.updateSyncStatus, {
        userId,
        syncStatus: "failed",
      });

      void ctx.runAction(internal.discord.notifyError, {
        source: "backfillUserHistory",
        message: `Backfill failed after ${BACKFILL_MAX_RETRIES + 1} attempts for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
        userId,
      });

      return { newWorkouts: 0, totalActivities: 0 };
    }
  },
});
