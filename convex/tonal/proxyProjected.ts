/**
 * Cached Tonal proxy actions whose responses are projected before write.
 *
 * Fresh fetches use the strict projection variants so cachedFetch's
 * stale-while-revalidate fallback engages on schema drift instead of
 * overwriting valid stale data with an empty placeholder. The post-cache
 * read uses the lenient variant so legacy entries written before this
 * projection existed still pass through unchanged.
 *
 * Lives in its own file to keep convex/tonal/proxy.ts under the 400-line cap.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { tonalFetch } from "./client";
import { CACHE_TTLS } from "./cache";
import { cachedFetch } from "./proxy";
import { withTokenRetry } from "./tokenRetry";
import { projectCustomWorkouts, projectCustomWorkoutsStrict } from "./customWorkoutsProjection";
import {
  projectExternalActivities,
  projectExternalActivitiesStrict,
} from "./externalActivitiesProjection";
import {
  projectFormattedSummary,
  projectFormattedSummaryStrict,
} from "./formattedSummaryProjection";
import { projectStrengthHistory, projectStrengthHistoryStrict } from "./strengthHistoryProjection";
import type {
  ExternalActivity,
  FormattedWorkoutSummary,
  StrengthScoreHistoryEntry,
  UserWorkout,
} from "./types";

export const fetchStrengthHistory = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<StrengthScoreHistoryEntry[]> => {
    const result = await withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<StrengthScoreHistoryEntry[]>(ctx, {
        userId,
        dataType: "strengthHistory",
        ttl: CACHE_TTLS.strengthHistory,
        fetcher: async () => {
          const raw = await tonalFetch<unknown>(
            token,
            `/v6/users/${tonalUserId}/strength-scores/history?limit=200`,
          );
          return projectStrengthHistoryStrict(raw);
        },
      }),
    );
    return projectStrengthHistory(result);
  },
});

export const fetchFormattedSummary = internalAction({
  args: {
    userId: v.id("users"),
    summaryId: v.string(),
  },
  handler: async (ctx, { userId, summaryId }): Promise<FormattedWorkoutSummary> => {
    const result = await withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<FormattedWorkoutSummary>(ctx, {
        userId,
        dataType: `formattedSummary:${summaryId}`,
        ttl: CACHE_TTLS.workoutHistory,
        fetcher: async () => {
          const raw = await tonalFetch<unknown>(
            token,
            `/v6/formatted/users/${tonalUserId}/workout-summaries/${summaryId}`,
          );
          return projectFormattedSummaryStrict(raw);
        },
      }),
    );
    return projectFormattedSummary(result);
  },
});

export const fetchCustomWorkouts = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<UserWorkout[]> => {
    const result = await withTokenRetry(ctx, userId, (token) =>
      cachedFetch<UserWorkout[]>(ctx, {
        userId,
        dataType: "customWorkouts",
        ttl: CACHE_TTLS.customWorkouts,
        fetcher: async () => {
          const raw = await tonalFetch<unknown>(token, `/v6/user-workouts`);
          return projectCustomWorkoutsStrict(raw);
        },
      }),
    );
    return projectCustomWorkouts(result);
  },
});

export const fetchExternalActivities = internalAction({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 20 }): Promise<ExternalActivity[]> => {
    const result = await withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<ExternalActivity[]>(ctx, {
        userId,
        dataType: `externalActivities:${limit}`,
        ttl: CACHE_TTLS.workoutHistory,
        fetcher: async () => {
          const raw = await tonalFetch<unknown>(
            token,
            `/v6/users/${tonalUserId}/external-activities?limit=${limit}`,
          );
          return projectExternalActivitiesStrict(raw);
        },
      }),
    );
    return projectExternalActivities(result);
  },
});
