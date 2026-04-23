/**
 * Workout history fetch actions.
 * - fetchWorkoutHistory: recent 200 (for incremental sync)
 * - fetchWorkoutHistoryPage: single page at offset (for backfill)
 */

import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { fetchRecentWorkoutActivities, fetchWorkoutActivitiesPage, tonalFetch } from "./client";
import { CACHE_TTLS } from "./cache";
import { cachedFetch, fetchWorkoutMetaBatch, toActivity } from "./proxy";
import { withTokenRetry } from "./tokenRetry";
import type { Activity, WorkoutActivityDetail } from "./types";
import type { WorkoutMeta } from "./workoutMeta";

const GHOST_WORKOUT_ID = "00000000-0000-0000-0000-000000000000";
const WORKOUT_HISTORY_PAGE_LIMIT = 200;

interface ActivityPreviewMeta extends WorkoutMeta {
  activityId: string;
  workoutId: string;
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function projectActivityPreviewMeta(activity: Activity): ActivityPreviewMeta {
  const preview = activity.workoutPreview;
  const meta: ActivityPreviewMeta = {
    activityId: activity.activityId,
    workoutId: preview.workoutId,
  };
  const title = optionalString(preview.workoutTitle);
  const targetArea = optionalString(preview.targetArea);
  const programName = optionalString(preview.programName);
  if (title) meta.title = title;
  if (targetArea) meta.targetArea = targetArea;
  if (programName) meta.programName = programName;
  return meta;
}

function mergeWorkoutMeta(
  workoutMeta: WorkoutMeta | undefined,
  activityMeta: WorkoutMeta | undefined,
): WorkoutMeta | undefined {
  // The precedence is asymmetric: workoutMeta from /v6/workouts/{id} has the
  // better title/targetArea, while activityMeta from legacy /activities is the
  // authoritative source for programName.
  if (!workoutMeta) return activityMeta;
  if (!activityMeta) return workoutMeta;
  return {
    title: workoutMeta.title ?? activityMeta.title,
    targetArea: workoutMeta.targetArea ?? activityMeta.targetArea,
    programName: activityMeta.programName ?? workoutMeta.programName,
  };
}

async function fetchActivityPreviewMeta(
  ctx: ActionCtx,
  userId: Id<"users">,
  token: string,
  tonalUserId: string,
  offset: number,
  limit: number,
): Promise<Map<string, ActivityPreviewMeta>> {
  try {
    const previews = await cachedFetch<ActivityPreviewMeta[]>(ctx, {
      userId,
      dataType: `activityPreviewMeta:${offset}:${limit}`,
      ttl: CACHE_TTLS.workoutHistory,
      fetcher: async () => {
        const activities = await tonalFetch<Activity[]>(
          token,
          `/v6/users/${tonalUserId}/activities?offset=${offset}&limit=${limit}`,
        );
        return activities.map(projectActivityPreviewMeta);
      },
    });
    return new Map(previews.map((preview) => [preview.activityId, preview]));
  } catch (error) {
    console.warn("[workoutHistory] activity preview metadata unavailable", error);
    return new Map();
  }
}

async function enrichWorkoutActivities(
  ctx: ActionCtx,
  userId: Id<"users">,
  token: string,
  tonalUserId: string,
  items: WorkoutActivityDetail[],
  previewOffset: number,
  previewLimit: number,
): Promise<Activity[]> {
  const real = items.filter(
    (wa) => wa.workoutId !== GHOST_WORKOUT_ID || wa.totalVolume > 0 || wa.totalConcentricWork > 0,
  );
  if (real.length === 0) return [];
  const ids = [...new Set(real.map((w) => w.workoutId))];
  const [workoutMeta, activityMeta] = await Promise.all([
    fetchWorkoutMetaBatch(ctx, token, ids),
    fetchActivityPreviewMeta(ctx, userId, token, tonalUserId, previewOffset, previewLimit),
  ]);
  return real.map((wa) =>
    toActivity(wa, mergeWorkoutMeta(workoutMeta.get(wa.workoutId), activityMeta.get(wa.id))),
  );
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
            WORKOUT_HISTORY_PAGE_LIMIT,
          );
          return enrichWorkoutActivities(
            ctx,
            userId,
            token,
            tonalUserId,
            items,
            0,
            WORKOUT_HISTORY_PAGE_LIMIT,
          );
        },
      });
      return limit != null ? activities.slice(0, limit) : activities;
    }),
});

/** Fetch one page of workout history at the given offset. Used by backfill to
 *  avoid loading all 1000+ workouts into one action's 64MB memory limit. */
interface PageResult {
  activities: Activity[];
  pageSize: number;
  pgTotal: number;
}

/** Fetch one page of workout history at the given offset. Cached by userId+offset
 *  so backfill batching (20 items/invocation from a 200-item page) doesn't re-fetch. */
export const fetchWorkoutHistoryPage = internalAction({
  args: { userId: v.id("users"), offset: v.number() },
  handler: async (ctx, { userId, offset }): Promise<PageResult> =>
    withTokenRetry(ctx, userId, async (token, tonalUserId) =>
      cachedFetch<PageResult>(ctx, {
        userId,
        dataType: `workoutPage:${offset}`,
        ttl: CACHE_TTLS.workoutHistory,
        fetcher: async () => {
          const { items, pgTotal } = await fetchWorkoutActivitiesPage<WorkoutActivityDetail>(
            token,
            tonalUserId,
            offset,
            WORKOUT_HISTORY_PAGE_LIMIT,
          );
          const activities = await enrichWorkoutActivities(
            ctx,
            userId,
            token,
            tonalUserId,
            items,
            offset,
            WORKOUT_HISTORY_PAGE_LIMIT,
          );
          return { activities, pageSize: items.length, pgTotal };
        },
      }),
    ),
});
