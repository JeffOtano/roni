import { v } from "convex/values";
import { internalAction, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { decrypt } from "./encryption";
import { tonalFetch } from "./client";
import { CACHE_TTLS } from "./cache";
import { expandBlocksToSets, type BlockInput } from "./transforms";
import { validateWorkoutBlocks } from "./validation";
import type {
  TonalUser,
  StrengthScore,
  StrengthDistribution,
  StrengthScoreHistoryEntry,
  MuscleReadiness,
  Activity,
  WorkoutActivityDetail,
  FormattedWorkoutSummary,
  Movement,
  UserWorkout,
  WorkoutEstimate,
} from "./types";

// ---------------------------------------------------------------------------
// Helper: resolve encrypted token + tonalUserId for a given Convex user
// ---------------------------------------------------------------------------

async function withTonalToken(
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

// ---------------------------------------------------------------------------
// Generic cache-check-then-fetch helper
// ---------------------------------------------------------------------------

async function cachedFetch<T>(
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
}

// ---------------------------------------------------------------------------
// 1. fetchUserProfile
// ---------------------------------------------------------------------------

export const fetchUserProfile = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<TonalUser> => {
    const { token, tonalUserId } = await withTonalToken(ctx, userId);
    return cachedFetch<TonalUser>(ctx, {
      userId,
      dataType: "profile",
      ttl: CACHE_TTLS.profile,
      fetcher: () => tonalFetch<TonalUser>(token, `/v6/users/${tonalUserId}`),
    });
  },
});

// ---------------------------------------------------------------------------
// 2. fetchStrengthScores
// ---------------------------------------------------------------------------

export const fetchStrengthScores = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<StrengthScore[]> => {
    const { token, tonalUserId } = await withTonalToken(ctx, userId);
    return cachedFetch<StrengthScore[]>(ctx, {
      userId,
      dataType: "strengthScores",
      ttl: CACHE_TTLS.strengthScores,
      fetcher: () =>
        tonalFetch<StrengthScore[]>(
          token,
          `/v6/users/${tonalUserId}/strength-scores/current`,
        ),
    });
  },
});

// ---------------------------------------------------------------------------
// 3. fetchStrengthDistribution
// ---------------------------------------------------------------------------

export const fetchStrengthDistribution = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<StrengthDistribution> => {
    const { token, tonalUserId } = await withTonalToken(ctx, userId);
    return cachedFetch<StrengthDistribution>(ctx, {
      userId,
      dataType: "strengthDistribution",
      ttl: CACHE_TTLS.strengthDistribution,
      fetcher: () =>
        tonalFetch<StrengthDistribution>(
          token,
          `/v6/users/${tonalUserId}/strength-scores/distribution`,
        ),
    });
  },
});

// ---------------------------------------------------------------------------
// 4. fetchStrengthHistory
// ---------------------------------------------------------------------------

export const fetchStrengthHistory = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<StrengthScoreHistoryEntry[]> => {
    const { token, tonalUserId } = await withTonalToken(ctx, userId);
    return cachedFetch<StrengthScoreHistoryEntry[]>(ctx, {
      userId,
      dataType: "strengthHistory",
      ttl: CACHE_TTLS.strengthHistory,
      fetcher: () =>
        tonalFetch<StrengthScoreHistoryEntry[]>(
          token,
          `/v6/users/${tonalUserId}/strength-scores/history`,
        ),
    });
  },
});

// ---------------------------------------------------------------------------
// 5. fetchMuscleReadiness
// ---------------------------------------------------------------------------

export const fetchMuscleReadiness = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<MuscleReadiness> => {
    const { token, tonalUserId } = await withTonalToken(ctx, userId);
    return cachedFetch<MuscleReadiness>(ctx, {
      userId,
      dataType: "muscleReadiness",
      ttl: CACHE_TTLS.muscleReadiness,
      fetcher: () =>
        tonalFetch<MuscleReadiness>(
          token,
          `/v6/users/${tonalUserId}/muscle-readiness/current`,
        ),
    });
  },
});

// ---------------------------------------------------------------------------
// 6. fetchWorkoutHistory
// ---------------------------------------------------------------------------

export const fetchWorkoutHistory = internalAction({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 20 }): Promise<Activity[]> => {
    const { token, tonalUserId } = await withTonalToken(ctx, userId);
    return cachedFetch<Activity[]>(ctx, {
      userId,
      dataType: "workoutHistory",
      ttl: CACHE_TTLS.workoutHistory,
      fetcher: () =>
        tonalFetch<Activity[]>(
          token,
          `/v6/users/${tonalUserId}/activities?limit=${limit}`,
        ),
    });
  },
});

// ---------------------------------------------------------------------------
// 7. fetchWorkoutDetail
// ---------------------------------------------------------------------------

export const fetchWorkoutDetail = internalAction({
  args: {
    userId: v.id("users"),
    activityId: v.string(),
  },
  handler: async (
    ctx,
    { userId, activityId },
  ): Promise<WorkoutActivityDetail> => {
    const { token, tonalUserId } = await withTonalToken(ctx, userId);
    const dataType = `workoutDetail:${activityId}`;
    return cachedFetch<WorkoutActivityDetail>(ctx, {
      userId,
      dataType,
      ttl: CACHE_TTLS.workoutHistory,
      fetcher: () =>
        tonalFetch<WorkoutActivityDetail>(
          token,
          `/v6/users/${tonalUserId}/workout-activities/${activityId}`,
        ),
    });
  },
});

// ---------------------------------------------------------------------------
// 8. fetchFormattedSummary
// ---------------------------------------------------------------------------

export const fetchFormattedSummary = internalAction({
  args: {
    userId: v.id("users"),
    summaryId: v.string(),
  },
  handler: async (
    ctx,
    { userId, summaryId },
  ): Promise<FormattedWorkoutSummary> => {
    const { token, tonalUserId } = await withTonalToken(ctx, userId);
    const dataType = `formattedSummary:${summaryId}`;
    return cachedFetch<FormattedWorkoutSummary>(ctx, {
      userId,
      dataType,
      ttl: CACHE_TTLS.workoutHistory,
      fetcher: () =>
        tonalFetch<FormattedWorkoutSummary>(
          token,
          `/v6/formatted/users/${tonalUserId}/workout-summaries/${summaryId}`,
        ),
    });
  },
});

// ---------------------------------------------------------------------------
// 9. fetchMovements (global catalog — no userId in cache key)
// ---------------------------------------------------------------------------

export const fetchMovements = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<Movement[]> => {
    const { token } = await withTonalToken(ctx, userId);
    return cachedFetch<Movement[]>(ctx, {
      userId: undefined,
      dataType: "movements",
      ttl: CACHE_TTLS.movements,
      fetcher: () => tonalFetch<Movement[]>(token, `/v6/movements`),
    });
  },
});

// ---------------------------------------------------------------------------
// 10. fetchCustomWorkouts
// ---------------------------------------------------------------------------

export const fetchCustomWorkouts = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<UserWorkout[]> => {
    const { token } = await withTonalToken(ctx, userId);
    return cachedFetch<UserWorkout[]>(ctx, {
      userId,
      dataType: "customWorkouts",
      ttl: CACHE_TTLS.customWorkouts,
      fetcher: () => tonalFetch<UserWorkout[]>(token, `/v6/user-workouts`),
    });
  },
});

// ---------------------------------------------------------------------------
// 11. createWorkout
// ---------------------------------------------------------------------------

export const createWorkout = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    blocks: v.any(),
  },
  handler: async (
    ctx,
    { userId, title, blocks },
  ): Promise<{ workoutId: string; title: string; setCount: number }> => {
    const { token } = await withTonalToken(ctx, userId);

    // Validate movement IDs against cached catalog
    const cached = await ctx.runQuery(internal.tonal.cache.getCacheEntry, {
      userId: undefined,
      dataType: "movements",
    });
    if (cached) {
      const catalog = cached.data as Array<{ id: string }>;
      const validation = validateWorkoutBlocks(blocks as BlockInput[], catalog);
      if (!validation.valid) {
        throw new Error(
          `Invalid movement IDs: ${validation.errors.join(", ")}`,
        );
      }
    }

    // Transform blocks to flat set array
    const sets = expandBlocksToSets(blocks as BlockInput[]);

    // Create on Tonal
    const workout = await tonalFetch<{ id: string }>(
      token,
      "/v6/user-workouts",
      {
        method: "POST",
        body: { title, sets, createdSource: "WorkoutBuilder" },
      },
    );

    // Record in workoutPlans
    const now = Date.now();
    await ctx.runMutation(internal.workoutPlans.create, {
      userId,
      tonalWorkoutId: workout.id,
      title,
      blocks,
      status: "pushed",
      createdAt: now,
      pushedAt: now,
    });

    // Invalidate custom workouts cache
    await ctx.runMutation(internal.tonal.cache.setCacheEntry, {
      userId,
      dataType: "customWorkouts",
      data: null,
      fetchedAt: 0,
      expiresAt: 0,
    });

    return { workoutId: workout.id, title, setCount: sets.length };
  },
});

// ---------------------------------------------------------------------------
// 12. deleteWorkout
// ---------------------------------------------------------------------------

export const deleteWorkout = internalAction({
  args: {
    userId: v.id("users"),
    workoutId: v.string(),
  },
  handler: async (ctx, { userId, workoutId }): Promise<{ deleted: true }> => {
    const { token } = await withTonalToken(ctx, userId);

    await tonalFetch(token, `/v6/user-workouts/${workoutId}`, {
      method: "DELETE",
    });

    // Update workoutPlans status
    await ctx.runMutation(internal.workoutPlans.markDeleted, {
      tonalWorkoutId: workoutId,
    });

    // Invalidate custom workouts cache
    await ctx.runMutation(internal.tonal.cache.setCacheEntry, {
      userId,
      dataType: "customWorkouts",
      data: null,
      fetchedAt: 0,
      expiresAt: 0,
    });

    return { deleted: true };
  },
});

// ---------------------------------------------------------------------------
// 13. estimateWorkout
// ---------------------------------------------------------------------------

export const estimateWorkout = internalAction({
  args: {
    userId: v.id("users"),
    blocks: v.any(),
  },
  handler: async (ctx, { userId, blocks }): Promise<WorkoutEstimate> => {
    const { token } = await withTonalToken(ctx, userId);
    const sets = expandBlocksToSets(blocks as BlockInput[]);
    return tonalFetch<WorkoutEstimate>(token, "/v6/user-workouts/estimate", {
      method: "POST",
      body: { sets },
    });
  },
});
