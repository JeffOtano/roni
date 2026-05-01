import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { decrypt } from "./encryption";
import { TonalApiError, tonalFetch } from "./client";
import { CACHE_TTLS } from "./cache";
import { isCacheValueWithinLimit, isConvexSizeError } from "./proxyCacheLimits";
import { getCachedFetchMemo, getTokenMemo, type TokenEntry } from "./proxyMemo";
import { withTokenRetry } from "./tokenRetry";
import { projectWorkoutDetail } from "./workoutDetailProjection";
import {
  DEFAULT_TARGET_AREA,
  formatWorkoutDisplayTitle,
  projectWorkoutMeta,
  type WorkoutMeta,
} from "./workoutMeta";
import type {
  Activity,
  MuscleReadiness,
  StrengthDistribution,
  StrengthScore,
  TonalUser,
  WorkoutActivityDetail,
} from "./types";

/** Resolve encrypted token + tonalUserId for a given Convex user. */
export async function withTonalToken(ctx: ActionCtx, userId: Id<"users">): Promise<TokenEntry> {
  const memo = getTokenMemo(ctx);
  const cached = memo.get(userId);
  if (cached) return cached;

  const promise = (async () => {
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
  })();

  promise.catch(() => memo.delete(userId));
  memo.set(userId, promise);
  return promise;
}

const MAX_CACHE_ARRAY_LENGTH = 500;

interface CachedFetchOptions<T> {
  ctx: ActionCtx;
  userId?: Id<"users">;
  dataType: string;
  ttl: number;
  fetcher: () => Promise<T>;
  /** Return false to skip the cache write (e.g. negative results). */
  shouldCache?: (data: T) => boolean;
}

/** Generic cache-check-then-fetch helper with stale-while-revalidate. */
export async function cachedFetch<T>(
  ctx: ActionCtx,
  opts: Omit<CachedFetchOptions<T>, "ctx">,
): Promise<T> {
  const memo = getCachedFetchMemo(ctx);
  const memoKey = `${opts.userId ?? "global"}:${opts.dataType}`;
  const inflight = memo.get(memoKey);
  if (inflight) return inflight as Promise<T>;

  const promise = doCachedFetch<T>({ ctx, ...opts });
  promise.catch(() => memo.delete(memoKey));
  memo.set(memoKey, promise);
  return promise;
}

async function doCachedFetch<T>(opts: CachedFetchOptions<T>): Promise<T> {
  const { ctx, userId, dataType, ttl, fetcher, shouldCache } = opts;
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

  try {
    const data = await fetcher();
    const now = Date.now();

    const cacheData =
      Array.isArray(data) && data.length > MAX_CACHE_ARRAY_LENGTH
        ? data.slice(0, MAX_CACHE_ARRAY_LENGTH)
        : data;

    if (shouldCache && !shouldCache(data)) {
      // Caller opted out — skip the write.
    } else if (!isCacheValueWithinLimit(cacheData)) {
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

    return data;
  } catch (error) {
    // Never swallow auth errors -- the user must reconnect
    if (error instanceof TonalApiError && error.status === 401) throw error;
    if (error instanceof Error && error.message.includes("session expired")) throw error;

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

// fetchStrengthHistory lives in proxyProjected.ts (along with the other
// projected fetchers) to keep this file under the 400-line cap.

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
          ttl: CACHE_TTLS.immutableWorkout,
          fetcher: async () => {
            const raw = await tonalFetch<{ title?: unknown; targetArea?: unknown }>(
              token,
              `/v6/workouts/${id}`,
            );
            return projectWorkoutMeta(raw);
          },
          // Empty projection — don't pin a missing title for the 30-day TTL.
          shouldCache: (meta) =>
            meta.title != null || meta.targetArea != null || meta.programName != null,
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
      workoutTitle: formatWorkoutDisplayTitle(meta),
      programName: meta?.programName ?? "",
      coachName: "",
      level: "",
      targetArea: meta?.targetArea ?? DEFAULT_TARGET_AREA,
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
        ttl: CACHE_TTLS.immutableWorkout,
        // Null = 404 or projection rejection — don't pin for the 30-day TTL.
        shouldCache: (d) => d !== null,
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
              // cache short-circuits repeat requests for CACHE_TTLS.immutableWorkout.
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

// fetchFormattedSummary, fetchCustomWorkouts, and fetchExternalActivities
// live in proxyProjected.ts to keep this file under the 400-line cap.
