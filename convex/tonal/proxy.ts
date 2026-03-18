import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { decrypt } from "./encryption";
import { TonalApiError, tonalFetch } from "./client";
import { CACHE_TTLS } from "./cache";
import { withTokenRetry } from "./tokenRetry";
import type {
  Activity,
  ExternalActivity,
  FormattedWorkoutSummary,
  MuscleReadiness,
  StrengthDistribution,
  StrengthScore,
  StrengthScoreHistoryEntry,
  TonalUser,
  UserWorkout,
  WorkoutActivityDetail,
} from "./types";

/** Resolve encrypted token + tonalUserId for a given Convex user. */
export async function withTonalToken(
  ctx: ActionCtx,
  userId: Id<"users">,
): Promise<{ token: string; tonalUserId: string }> {
  const profile = await ctx.runQuery(internal.tonal.cache.getUserProfile, {
    userId,
  });
  if (!profile) {
    throw new Error("No Tonal profile found — user must link their account");
  }

  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("TOKEN_ENCRYPTION_KEY env var is not set");
  }

  const token = await decrypt(profile.tonalToken, keyHex);
  return { token, tonalUserId: profile.tonalUserId };
}

/** Generic cache-check-then-fetch helper with stale-while-revalidate. */
export async function cachedFetch<T>(
  ctx: ActionCtx,
  opts: {
    userId?: Id<"users">;
    dataType: string;
    ttl: number;
    fetcher: () => Promise<T>;
  },
): Promise<T> {
  const { userId, dataType, ttl, fetcher } = opts;

  const cached = await ctx.runQuery(internal.tonal.cache.getCacheEntry, {
    userId,
    dataType,
  });

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  // Stale-while-revalidate: try to refresh, fall back to stale data
  try {
    const data = await fetcher();
    const now = Date.now();

    await ctx.runMutation(internal.tonal.cache.setCacheEntry, {
      userId,
      dataType,
      data,
      fetchedAt: now,
      expiresAt: now + ttl,
    });

    return data;
  } catch (error) {
    // Never swallow auth errors — the user must reconnect
    if (error instanceof TonalApiError && error.status === 401) throw error;
    if (error instanceof Error && error.message.includes("session expired")) throw error;

    // For non-auth errors, fall back to stale data if available
    if (cached) {
      console.warn(`cachedFetch(${dataType}): refresh failed, serving stale data`, error);
      return cached.data as T;
    }
    throw error;
  }
}

export const fetchUserProfile = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<TonalUser> =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<TonalUser>(ctx, {
        userId,
        dataType: "profile",
        ttl: CACHE_TTLS.profile,
        fetcher: () => tonalFetch<TonalUser>(token, `/v6/users/${tonalUserId}`),
      }),
    ),
});

export const fetchStrengthScores = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<StrengthScore[]> =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<StrengthScore[]>(ctx, {
        userId,
        dataType: "strengthScores",
        ttl: CACHE_TTLS.strengthScores,
        fetcher: () =>
          tonalFetch<StrengthScore[]>(token, `/v6/users/${tonalUserId}/strength-scores/current`),
      }),
    ),
});

export const fetchStrengthDistribution = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<StrengthDistribution> =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<StrengthDistribution>(ctx, {
        userId,
        dataType: "strengthDistribution",
        ttl: CACHE_TTLS.strengthDistribution,
        fetcher: () =>
          tonalFetch<StrengthDistribution>(
            token,
            `/v6/users/${tonalUserId}/strength-scores/distribution`,
          ),
      }),
    ),
});

export const fetchStrengthHistory = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<StrengthScoreHistoryEntry[]> =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<StrengthScoreHistoryEntry[]>(ctx, {
        userId,
        dataType: "strengthHistory",
        ttl: CACHE_TTLS.strengthHistory,
        fetcher: () =>
          tonalFetch<StrengthScoreHistoryEntry[]>(
            token,
            `/v6/users/${tonalUserId}/strength-scores/history?limit=200`,
          ),
      }),
    ),
});

export const fetchMuscleReadiness = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<MuscleReadiness> =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<MuscleReadiness>(ctx, {
        userId,
        dataType: "muscleReadiness",
        ttl: CACHE_TTLS.muscleReadiness,
        fetcher: () =>
          tonalFetch<MuscleReadiness>(token, `/v6/users/${tonalUserId}/muscle-readiness/current`),
      }),
    ),
});

export const fetchWorkoutHistory = internalAction({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 20 }): Promise<Activity[]> =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<Activity[]>(ctx, {
        userId,
        dataType: `workoutHistory:${limit}`,
        ttl: CACHE_TTLS.workoutHistory,
        fetcher: () =>
          tonalFetch<Activity[]>(token, `/v6/users/${tonalUserId}/activities?limit=${limit}`),
      }),
    ),
});

export const fetchWorkoutDetail = internalAction({
  args: {
    userId: v.id("users"),
    activityId: v.string(),
  },
  handler: async (ctx, { userId, activityId }): Promise<WorkoutActivityDetail | null> =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<WorkoutActivityDetail | null>(ctx, {
        userId,
        dataType: `workoutDetail:${activityId}`,
        ttl: CACHE_TTLS.workoutHistory,
        fetcher: async () => {
          try {
            return await tonalFetch<WorkoutActivityDetail>(
              token,
              `/v6/users/${tonalUserId}/workout-activities/${activityId}`,
            );
          } catch (error) {
            if (error instanceof TonalApiError && error.status === 404) {
              return null;
            }
            throw error;
          }
        },
      }),
    ),
});

export const fetchFormattedSummary = internalAction({
  args: {
    userId: v.id("users"),
    summaryId: v.string(),
  },
  handler: async (ctx, { userId, summaryId }): Promise<FormattedWorkoutSummary> =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<FormattedWorkoutSummary>(ctx, {
        userId,
        dataType: `formattedSummary:${summaryId}`,
        ttl: CACHE_TTLS.workoutHistory,
        fetcher: () =>
          tonalFetch<FormattedWorkoutSummary>(
            token,
            `/v6/formatted/users/${tonalUserId}/workout-summaries/${summaryId}`,
          ),
      }),
    ),
});

export const fetchCustomWorkouts = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<UserWorkout[]> =>
    withTokenRetry(ctx, userId, (token) =>
      cachedFetch<UserWorkout[]>(ctx, {
        userId,
        dataType: "customWorkouts",
        ttl: CACHE_TTLS.customWorkouts,
        fetcher: () => tonalFetch<UserWorkout[]>(token, `/v6/user-workouts`),
      }),
    ),
});

export const fetchExternalActivities = internalAction({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 20 }): Promise<ExternalActivity[]> =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<ExternalActivity[]>(ctx, {
        userId,
        dataType: `externalActivities:${limit}`,
        ttl: CACHE_TTLS.workoutHistory,
        fetcher: () =>
          tonalFetch<ExternalActivity[]>(
            token,
            `/v6/users/${tonalUserId}/external-activities?limit=${limit}`,
          ),
      }),
    ),
});
