import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { decrypt } from "./encryption";
import { TonalApiError, tonalFetch } from "./client";
import { CACHE_TTLS } from "./cache";
import { isCacheValueWithinLimit, isConvexSizeError } from "./proxyCacheLimits";
import { withTokenRetry } from "./tokenRetry";
import { projectWorkoutDetail } from "./workoutDetailProjection";
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

const MAX_CACHE_ARRAY_LENGTH = 500;

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

  let cached: { data: unknown; expiresAt: number } | null = null;
  try {
    cached = await ctx.runQuery(internal.tonal.cache.getCacheEntry, { userId, dataType });
  } catch (readErr) {
    if (!isConvexSizeError(readErr)) throw readErr;
    console.warn(`cachedFetch(${dataType}): cached entry invalid on read, evicting`, readErr);
    await ctx
      .runMutation(internal.tonal.cache.deleteCacheEntryByType, { userId, dataType })
      .catch((err: unknown) => console.warn(`cachedFetch(${dataType}): eviction failed`, err));
  }

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  const circuitOpen = await ctx.runQuery(internal.systemHealth.isCircuitOpen, { service: "tonal" });
  if (circuitOpen && cached) {
    console.warn(`cachedFetch(${dataType}): circuit open, serving stale data`);
    return cached.data as T;
  }

  try {
    const data = await fetcher();
    const now = Date.now();

    const cacheData =
      Array.isArray(data) && data.length > MAX_CACHE_ARRAY_LENGTH
        ? data.slice(0, MAX_CACHE_ARRAY_LENGTH)
        : data;

    if (!isCacheValueWithinLimit(cacheData)) {
      console.warn(`cachedFetch(${dataType}): payload too large to cache, skipping write`);
    } else {
      try {
        await ctx.runMutation(internal.tonal.cache.setCacheEntry, {
          userId,
          dataType,
          data: cacheData,
          fetchedAt: now,
          expiresAt: now + ttl,
        });
      } catch (cacheErr) {
        console.warn(
          `cachedFetch(${dataType}): cache write failed, returning fresh data`,
          cacheErr,
        );
      }
    }

    await ctx
      .runMutation(internal.systemHealth.recordSuccess, { service: "tonal" })
      .catch((err: unknown) => console.warn("[circuitBreaker] recordSuccess failed", err));

    return data;
  } catch (error) {
    // Never swallow auth errors -- the user must reconnect
    if (error instanceof TonalApiError && error.status === 401) throw error;
    if (error instanceof Error && error.message.includes("session expired")) throw error;

    await ctx
      .runMutation(internal.systemHealth.recordFailure, { service: "tonal" })
      .catch((err: unknown) => console.warn("[circuitBreaker] recordFailure failed", err));

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
export interface WorkoutMeta {
  title?: string;
  targetArea?: string;
}

export function projectWorkoutMeta(raw: unknown): WorkoutMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const candidate = raw as { title?: unknown; targetArea?: unknown };
  return {
    title: typeof candidate.title === "string" ? candidate.title : undefined,
    targetArea: typeof candidate.targetArea === "string" ? candidate.targetArea : undefined,
  };
}

const WORKOUT_META_BATCH_SIZE = 10;

/** Batch-fetch workout metadata for unique workoutIds. Failures are silently skipped. */
export async function fetchWorkoutMetaBatch(
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
          fetcher: async () => {
            const raw = await tonalFetch<{ title?: unknown; targetArea?: unknown }>(
              token,
              `/v6/workouts/${id}`,
            );
            return projectWorkoutMeta(raw);
          },
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
export function toActivity(wa: WorkoutActivityDetail, meta?: WorkoutMeta): Activity {
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

// fetchWorkoutHistory and fetchWorkoutHistoryPage live in workoutHistoryProxy.ts
// to keep this file under the 400-line cap.

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
            const raw = await tonalFetch<unknown>(
              token,
              `/v6/users/${tonalUserId}/workout-activities/${activityId}`,
            );
            const detail = projectWorkoutDetail(raw);
            if (detail === null) {
              // Schema drift — projectWorkoutDetail already logged Zod issues.
              // Return null so the caller gracefully renders "not found"; the
              // cache short-circuits repeat requests for CACHE_TTLS.workoutHistory.
              console.error(
                `fetchWorkoutDetail: projectWorkoutDetail rejected payload for activity ${activityId}`,
              );
              return null;
            }
            return detail;
          } catch (error) {
            if (error instanceof TonalApiError && error.status === 404) {
              return null;
            }
            throw error;
          }
        },
      }),
    );
    // Project after cachedFetch too: stale cache may predate the projection.
    return projectWorkoutDetail(result);
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
