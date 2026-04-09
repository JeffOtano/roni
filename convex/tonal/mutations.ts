import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { rateLimiter } from "../rateLimits";
import type { Id } from "../_generated/dataModel";
import { TonalApiError, tonalFetch } from "./client";
import { type BlockInput, expandBlocksToSets } from "./transforms";
import { validateWorkoutBlocks } from "./validation";
import type { Activity, WorkoutEstimate, WorkoutSetInput } from "./types";
import { cachedFetch } from "./proxy";
import { withTokenRetry } from "./tokenRetry";
import { blockInputValidator } from "../validators";

/**
 * Correct sets where a duration-based movement was incorrectly assigned prescribedReps.
 * Mutates the sets in place; returns the number of corrections made.
 */
export function correctDurationRepsMismatch(
  sets: WorkoutSetInput[],
  catalog: Array<{ id: string; name?: string; countReps: boolean }>,
): number {
  const catalogMap = new Map(catalog.map((m) => [m.id, m]));
  let corrections = 0;
  for (const set of sets) {
    const movement = catalogMap.get(set.movementId);
    if (movement && !movement.countReps && set.prescribedReps != null) {
      console.warn(
        `Duration/reps mismatch: ${movement.name ?? set.movementId} has countReps=false but got prescribedReps=${set.prescribedReps}. Correcting to duration.`,
      );
      set.prescribedReps = undefined;
      set.prescribedDuration = set.prescribedDuration ?? 30;
      set.prescribedResistanceLevel = set.prescribedResistanceLevel ?? 5;
      corrections++;
    }
  }
  return corrections;
}

/** Build an error message that includes workout context for debugging push failures. */
export function enrichPushErrorMessage(
  originalError: string,
  title: string,
  movementIds: string[],
): string {
  const unique = [...new Set(movementIds)];
  return `Push failed for "${title}" (movements: ${unique.join(", ")}). Tonal error: ${originalError}`;
}

/** Tonal API only; returns { id }. Used by createWorkout and retryPush. */
export const doTonalCreateWorkout = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    blocks: blockInputValidator,
  },
  handler: async (ctx, { userId, title, blocks }): Promise<{ id: string }> => {
    const catalog = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);
    if (catalog.length === 0) {
      throw new Error(
        "Movement catalog is empty — cannot validate or create workout. Run movement sync first.",
      );
    }
    const validation = validateWorkoutBlocks(blocks as BlockInput[], catalog);
    if (!validation.valid) {
      throw new Error(
        `Invalid movement IDs. You must use search_exercises to get real IDs from Tonal's catalog. Do not fabricate IDs. Errors: ${validation.errors.join(", ")}`,
      );
    }
    const rawSets = expandBlocksToSets(blocks as BlockInput[], catalog);
    correctDurationRepsMismatch(rawSets, catalog);

    // Strip undefined fields from each set before sending to Tonal.
    // JSON.stringify drops undefined values, but Tonal's Go backend
    // may reject null values for optional fields like prescribedReps/prescribedDuration.
    const sets = rawSets.map((s) =>
      Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)),
    );

    const payload = { title, sets, createdSource: "WorkoutBuilder" };
    console.log(
      `createWorkout: "${title}", ${sets.length} sets, movements: ${[...new Set(sets.map((s) => s.movementId))].join(", ")}`,
    );

    return withTokenRetry(ctx, userId, async (token) => {
      let workout: { id: string };
      const MAX_RETRIES = 2;
      for (let attempt = 0; ; attempt++) {
        try {
          workout = await tonalFetch<{ id: string }>(token, "/v6/user-workouts", {
            method: "POST",
            body: payload,
          });
          break;
        } catch (err) {
          const is5xx = err instanceof TonalApiError && err.status >= 500;
          if (!is5xx || attempt >= MAX_RETRIES) {
            console.error(`createWorkout payload that failed:`, JSON.stringify(payload, null, 2));
            const movementIds = sets.map((s) => s.movementId as string);
            const errMsg = err instanceof Error ? err.message : String(err);
            throw new Error(enrichPushErrorMessage(errMsg, title, movementIds));
          }
          const delay = 3000 * (attempt + 1);
          console.warn(
            `createWorkout: Tonal ${(err as TonalApiError).status} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay / 1000}s`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      const tonalWorkoutId = workout.id;

      // Soft verification: read back custom workouts list to confirm push
      try {
        const customWorkouts = await tonalFetch<Array<{ id: string }>>(token, `/v6/user-workouts`);
        const verified = customWorkouts?.some((w) => w.id === tonalWorkoutId);
        if (!verified) {
          console.warn(`Push verification: workout ${tonalWorkoutId} not found in read-back`);
        }
      } catch {
        console.warn(`Push verification: could not read back custom workouts list`);
      }

      return { id: tonalWorkoutId };
    });
  },
});

/** Share a custom workout to get a deep link URL. */
export const shareWorkout = internalAction({
  args: {
    userId: v.id("users"),
    workoutId: v.string(),
  },
  handler: async (ctx, { userId, workoutId }): Promise<{ deepLinkUrl: string }> => {
    return withTokenRetry(ctx, userId, async (token, tonalUserId) => {
      const result = await tonalFetch<{ deepLinkUrl: string }>(
        token,
        `/v6/users/${tonalUserId}/user-workouts/${workoutId}/share`,
        { method: "POST" },
      );
      return { deepLinkUrl: result.deepLinkUrl };
    });
  },
});

/** Delete all custom workouts from a user's Tonal account. */
export const deleteAllCustomWorkouts = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ deleted: number }> => {
    return withTokenRetry(ctx, userId, async (token) => {
      const workouts = await tonalFetch<Array<{ id: string }>>(token, "/v6/user-workouts");
      let deleted = 0;
      for (const w of workouts) {
        try {
          await tonalFetch(token, `/v6/user-workouts/${w.id}`, { method: "DELETE" });
          deleted++;
          // Rate limit
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (e) {
          console.error(`Failed to delete workout ${w.id}:`, e);
        }
      }
      return { deleted };
    });
  },
});

/** Activities for activation eligibility check (separate cache key). */
export const fetchWorkoutHistoryForEligibility = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<Activity[]> =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<Activity[]>(ctx, {
        userId,
        dataType: "workoutHistoryEligibility",
        ttl: 60 * 5,
        fetcher: () =>
          tonalFetch<Activity[]>(token, `/v6/users/${tonalUserId}/activities?limit=100`),
      }),
    ),
});

export function formatTonalTitle(title: string, now?: Date): string {
  const date = (now ?? new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${date} · ${title}`;
}

/** Create a custom workout on Tonal and record the plan in Convex. */
export const createWorkout = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    blocks: blockInputValidator,
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
    await rateLimiter.limit(ctx, "createTonalWorkout", { key: userId, throws: true });
    const sets = expandBlocksToSets(blocks as BlockInput[]);
    try {
      const tonalTitle = title;
      const { id } = await ctx.runAction(internal.tonal.mutations.doTonalCreateWorkout, {
        userId,
        title: tonalTitle,
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
      console.error("[createWorkout] Tonal push failed", e);
      void ctx.runAction(internal.discord.notifyError, {
        source: "createWorkout",
        message: `Workout push failed for "${title}": ${message}`,
        userId,
      });
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
  handler: async (ctx, { userId, workoutId }): Promise<{ deleted: true }> =>
    withTokenRetry(ctx, userId, async (token) => {
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
    }),
});

/** Estimate workout duration from exercise blocks. */
export const estimateWorkout = internalAction({
  args: {
    userId: v.id("users"),
    blocks: blockInputValidator,
  },
  handler: async (ctx, { userId, blocks }): Promise<WorkoutEstimate> => {
    const catalog = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);
    const sets = expandBlocksToSets(blocks as BlockInput[], catalog);
    return withTokenRetry(ctx, userId, async (token) =>
      tonalFetch<WorkoutEstimate>(token, "/v6/user-workouts/estimate", {
        method: "POST",
        body: { sets },
      }),
    );
  },
});
