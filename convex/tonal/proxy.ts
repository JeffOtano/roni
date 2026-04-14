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

  // Circuit breaker: if Tonal is unhealthy, serve stale data without attempting fetch
  const circuitOpen = await ctx.runQuery(internal.systemHealth.isCircuitOpen, { service: "tonal" });
  if (circuitOpen && cached) {
    console.warn(`cachedFetch(${dataType}): circuit open, serving stale data`);
    return cached.data as T;
  }

  // Stale-while-revalidate: try to refresh, fall back to stale data
  try {
    const data = await fetcher();
    const now = Date.now();

    // Truncate large arrays before caching to stay within Convex's
    // 8192 element limit per array field. The full data is still
    // returned to the caller; only the cached copy is truncated.
    const MAX_CACHE_ARRAY_LENGTH = 500;
    const cacheData =
      Array.isArray(data) && data.length > MAX_CACHE_ARRAY_LENGTH
        ? data.slice(0, MAX_CACHE_ARRAY_LENGTH)
        : data;

    try {
      await ctx.runMutation(internal.tonal.cache.setCacheEntry, {
        userId,
        dataType,
        data: cacheData,
        fetchedAt: now,
        expiresAt: now + ttl,
      });
    } catch (cacheErr) {
      // If caching fails (e.g., data still too large), log and continue.
      // The caller still gets fresh data; it just won't be cached.
      console.warn(`cachedFetch(${dataType}): cache write failed, returning fresh data`, cacheErr);
    }

    // Record success for circuit breaker
    await ctx.runMutation(internal.systemHealth.recordSuccess, { service: "tonal" });

    return data;
  } catch (error) {
    // Never swallow auth errors -- the user must reconnect
    if (error instanceof TonalApiError && error.status === 401) throw error;
    if (error instanceof Error && error.message.includes("session expired")) throw error;

    // Record failure for circuit breaker (non-auth errors only)
    await ctx.runMutation(internal.systemHealth.recordFailure, { service: "tonal" });

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

/** Minimal shape from GET /v6/workouts/{id} for enrichment. */
interface WorkoutMeta {
  title?: string;
  targetArea?: string;
}

const WORKOUT_META_BATCH_SIZE = 10;

/** Batch-fetch workout metadata for unique workoutIds. Failures are silently skipped. */
async function fetchWorkoutMetaBatch(
  ctx: ActionCtx,
  token: string,
  workoutIds: string[],
): Promise<Map<string, WorkoutMeta>> {
  const meta = new Map<string, WorkoutMeta>();
  for (let i = 0; i < workoutIds.length; i += WORKOUT_META_BATCH_SIZE) {
    const batch = workoutIds.slice(i, i + WORKOUT_META_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const data = await cachedFetch<WorkoutMeta>(ctx, {
          dataType: `workoutMeta:${id}`,
          ttl: CACHE_TTLS.profile,
          fetcher: () => tonalFetch<WorkoutMeta>(token, `/v6/workouts/${id}`),
        });
        return { id, data };
      }),
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        meta.set(result.value.id, result.value.data);
      }
    }
  }
  return meta;
}

/** Map a WorkoutActivityDetail list item to the Activity shape the sync pipeline expects. */
function toActivity(wa: WorkoutActivityDetail, meta?: WorkoutMeta): Activity {
  return {
    activityId: wa.id,
    userId: wa.userId,
    activityTime: wa.beginTime,
    activityType: wa.workoutType,
    workoutPreview: {
      activityId: wa.id,
      workoutId: wa.workoutId,
      workoutTitle: meta?.title ?? "Tonal Workout",
      programName: "",
      coachName: "",
      level: "",
      targetArea: meta?.targetArea ?? "Full Body",
      isGuidedWorkout: false,
      workoutType: wa.workoutType,
      beginTime: wa.beginTime,
      totalDuration: wa.totalDuration,
      totalVolume: wa.totalVolume,
      totalWork: wa.totalConcentricWork,
      totalAchievements: 0,
      activityType: wa.workoutType,
    },
  };
}

export const fetchWorkoutHistory = internalAction({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 20 }): Promise<Activity[]> =>
    withTokenRetry(ctx, userId, async (token, tonalUserId) => {
      const items = await cachedFetch<WorkoutActivityDetail[]>(ctx, {
        userId,
        dataType: `workoutHistory_v2:${limit}`,
        ttl: CACHE_TTLS.workoutHistory,
        fetcher: () =>
          tonalFetch<WorkoutActivityDetail[]>(
            token,
            `/v6/users/${tonalUserId}/workout-activities?limit=${limit}`,
          ),
      });

      if (items.length === 0) return [];

      // Enrich with title/targetArea from workout catalog
      const uniqueWorkoutIds = [...new Set(items.map((w) => w.workoutId))];
      const meta = await fetchWorkoutMetaBatch(ctx, token, uniqueWorkoutIds);

      return items.map((wa) => toActivity(wa, meta.get(wa.workoutId)));
    }),
});

// Convex caps array fields at 8192 elements. Tonal can return thousands of
// set entries for some activities. Apply after every return path (fresh + cached).
const MAX_SETS_RETURN = 4000;
function truncateWorkoutDetail(detail: WorkoutActivityDetail | null): WorkoutActivityDetail | null {
  if (!detail?.workoutSetActivity || detail.workoutSetActivity.length <= MAX_SETS_RETURN)
    return detail;
  return { ...detail, workoutSetActivity: detail.workoutSetActivity.slice(0, MAX_SETS_RETURN) };
}

export const fetchWorkoutDetail = internalAction({
  args: {
    userId: v.id("users"),
    activityId: v.string(),
  },
  handler: async (ctx, { userId, activityId }): Promise<WorkoutActivityDetail | null> => {
    const result = await withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<WorkoutActivityDetail | null>(ctx, {
        userId,
        dataType: `workoutDetail:${activityId}`,
        ttl: CACHE_TTLS.workoutHistory,
        fetcher: async () => {
          try {
            const detail = await tonalFetch<WorkoutActivityDetail>(
              token,
              `/v6/users/${tonalUserId}/workout-activities/${activityId}`,
            );
            return truncateWorkoutDetail(detail);
          } catch (error) {
            if (error instanceof TonalApiError && error.status === 404) {
              return null;
            }
            throw error;
          }
        },
      }),
    );
    // Truncate after cachedFetch too: stale cache may predate the truncation.
    return truncateWorkoutDetail(result);
  },
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
