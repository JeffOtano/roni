/**
 * Pure helper functions for training history sync.
 *
 * Extracted from historySync.ts so that file stays focused on workflow
 * definitions and entry points.
 */

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

type WorkoutPayload = typeof workoutValidator.type;
type PerformancePayload = typeof performanceValidator.type;

const DETAIL_BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000;
const PROFILE_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

function activityToWorkoutPayload(activity: Activity): WorkoutPayload {
  const { activityId, activityTime, workoutPreview: p } = activity;
  const date = activityTime.slice(0, 10);
  return {
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
}

/** Fetch detail/summary for one activity and return persistence payloads. */
async function processOneActivity(
  ctx: ActionCtx,
  userId: Id<"users">,
  activity: Activity,
  straightBarIds?: ReadonlySet<string>,
): Promise<{ workout: WorkoutPayload; performances: PerformancePayload[] }> {
  const workout = activityToWorkoutPayload(activity);
  const { activityId } = activity;

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
      date: workout.date,
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

/** Sync strength score history from the Tonal API. */
export async function syncStrengthOnly(ctx: ActionCtx, userId: Id<"users">): Promise<void> {
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
 * Returns { synced, remaining } so the caller can page through backfill.
 */
export async function syncActivitiesAndStrength(
  ctx: ActionCtx,
  userId: Id<"users">,
  activities: Activity[],
  maxNew?: number,
): Promise<{ synced: number; remaining: number }> {
  if (activities.length > 0) {
    await ctx.runMutation(internal.tonal.historySyncMutations.refreshCompletedWorkoutMetadata, {
      userId,
      workouts: activities.map(activityToWorkoutPayload),
    });
  }

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

  return { synced: batch.length, remaining };
}

/** Refresh profile data from Tonal API if >24h old. */
export async function maybeRefreshProfile(ctx: ActionCtx, userId: Id<"users">): Promise<void> {
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
