import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { tonalFetch } from "./client";
import { type BlockInput, expandBlocksToSets } from "./transforms";
import { validateWorkoutBlocks } from "./validation";
import type { Activity, WorkoutEstimate } from "./types";
import { cachedFetch, withTonalToken } from "./proxy";

/** Tonal API only; returns { id }. Used by createWorkout and retryPush. */
export const doTonalCreateWorkout = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    blocks: v.any(),
  },
  handler: async (ctx, { userId, title, blocks }): Promise<{ id: string }> => {
    const { token } = await withTonalToken(ctx, userId);
    const cached = await ctx.runQuery(internal.tonal.cache.getCacheEntry, {
      userId: undefined,
      dataType: "movements",
    });
    if (cached) {
      const catalog = cached.data as Array<{ id: string }>;
      const validation = validateWorkoutBlocks(blocks as BlockInput[], catalog);
      if (!validation.valid) {
        throw new Error(`Invalid movement IDs: ${validation.errors.join(", ")}`);
      }
    }
    const sets = expandBlocksToSets(blocks as BlockInput[]);
    const workout = await tonalFetch<{ id: string }>(token, "/v6/user-workouts", {
      method: "POST",
      body: { title, sets, createdSource: "WorkoutBuilder" },
    });
    return { id: workout.id };
  },
});

/** Activities for activation eligibility check (separate cache key). */
export const fetchWorkoutHistoryForEligibility = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<Activity[]> => {
    const { token, tonalUserId } = await withTonalToken(ctx, userId);
    return cachedFetch<Activity[]>(ctx, {
      userId,
      dataType: "workoutHistoryEligibility",
      ttl: 60 * 5,
      fetcher: () => tonalFetch<Activity[]>(token, `/v6/users/${tonalUserId}/activities?limit=100`),
    });
  },
});

/** Create a custom workout on Tonal and record the plan in Convex. */
export const createWorkout = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    blocks: v.any(),
  },
  handler: async (
    ctx,
    { userId, title, blocks },
  ): Promise<
    | {
        success: true;
        workoutId: string;
        title: string;
        setCount: number;
        planId: Id<"workoutPlans">;
      }
    | { success: false; error: string; planId: Id<"workoutPlans"> }
  > => {
    const sets = expandBlocksToSets(blocks as BlockInput[]);
    try {
      const { id } = await ctx.runAction(internal.tonal.mutations.doTonalCreateWorkout, {
        userId,
        title,
        blocks,
      });
      const now = Date.now();
      const planId = await ctx.runMutation(internal.workoutPlans.create, {
        userId,
        tonalWorkoutId: id,
        source: "tonal_coach",
        title,
        blocks,
        status: "pushed",
        createdAt: now,
        pushedAt: now,
      });
      await ctx.runMutation(internal.tonal.cache.setCacheEntry, {
        userId,
        dataType: "customWorkouts",
        data: null,
        fetchedAt: 0,
        expiresAt: 0,
      });
      return {
        success: true,
        workoutId: id,
        title,
        setCount: sets.length,
        planId,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const planId = await ctx.runMutation(internal.workoutPlans.create, {
        userId,
        title,
        blocks,
        status: "failed",
        pushErrorReason: message,
        createdAt: Date.now(),
      });
      return { success: false, error: message, planId };
    }
  },
});

/** Delete a custom workout from Tonal and update Convex records. */
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

    await ctx.runMutation(internal.workoutPlans.markDeleted, {
      tonalWorkoutId: workoutId,
    });

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

/** Estimate workout duration from exercise blocks. */
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
