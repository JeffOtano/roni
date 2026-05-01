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
import { WORKOUT_SOURCE } from "../workoutPlans";
import { withTokenRetry } from "./tokenRetry";
import { blockInputValidator } from "../validators";

export interface PushDivergence {
  missingMovements: string[];
  extraMovements: string[];
  setCountMismatches: { movementId: string; intended: number; stored: number }[];
}

interface IntendedSet {
  movementId: string;
  sets: number;
}

interface StoredSet {
  movementId: string;
  prescribedReps?: number;
  prescribedDuration?: number;
}

/**
 * Compare intended (what we sent to Tonal) vs stored (what Tonal actually saved).
 * Returns null when they match exactly. Returns a structured divergence object
 * listing missing movements, extra movements, and per-movement set-count mismatches
 * when they don't.
 *
 * "Intended" is in (movementId, sets) compact form. "Stored" is one entry per
 * actual set in Tonal's response. The function expands intended into per-set
 * counts internally for comparison.
 */
export function computePushDivergence(
  intended: IntendedSet[],
  storedSets: StoredSet[],
): PushDivergence | null {
  const intendedCounts = new Map<string, number>();
  for (const it of intended) {
    intendedCounts.set(it.movementId, (intendedCounts.get(it.movementId) ?? 0) + it.sets);
  }
  const storedCounts = new Map<string, number>();
  for (const s of storedSets) {
    storedCounts.set(s.movementId, (storedCounts.get(s.movementId) ?? 0) + 1);
  }

  const missingMovements: string[] = [];
  const setCountMismatches: PushDivergence["setCountMismatches"] = [];
  for (const [movementId, intendedSetCount] of intendedCounts) {
    const storedCount = storedCounts.get(movementId) ?? 0;
    if (storedCount === 0) missingMovements.push(movementId);
    else if (storedCount !== intendedSetCount) {
      setCountMismatches.push({ movementId, intended: intendedSetCount, stored: storedCount });
    }
  }

  const extraMovements: string[] = [];
  for (const movementId of storedCounts.keys()) {
    if (!intendedCounts.has(movementId)) extraMovements.push(movementId);
  }

  if (
    missingMovements.length === 0 &&
    extraMovements.length === 0 &&
    setCountMismatches.length === 0
  ) {
    return null;
  }

  return { missingMovements, extraMovements, setCountMismatches };
}

/** Mutates `sets` in place; returns the number of corrections made. */
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

export function enrichPushErrorMessage(
  originalError: string,
  title: string,
  movementIds: string[],
): string {
  const unique = [...new Set(movementIds)];
  return `Push failed for "${title}" (movements: ${unique.join(", ")}). Tonal error: ${originalError}`;
}

/** 3s/6s backoff on Tonal 5xx; 4xx/401/non-Tonal bubble immediately. */
export async function retryOn5xx<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is5xx = err instanceof TonalApiError && err.status >= 500;
      if (!is5xx || attempt >= maxRetries) throw err;
      const delayMs = 3000 * (attempt + 1);
      console.warn(
        `Tonal ${(err as TonalApiError).status} (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs / 1000}s`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/** Pushes to Tonal only — the caller records the plan. Used by createWorkout and retryPush. */
export const pushWorkoutToTonal = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    blocks: blockInputValidator,
  },
  handler: async (
    ctx,
    { userId, title, blocks },
  ): Promise<{ id: string; pushDivergence: PushDivergence | null }> => {
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
    const sets = expandBlocksToSets(blocks as BlockInput[], catalog);
    correctDurationRepsMismatch(sets, catalog);

    const payload = { title, sets, createdSource: "WorkoutBuilder" };
    console.log(
      `createWorkout: "${title}", ${sets.length} sets, movements: ${[...new Set(sets.map((s) => s.movementId))].join(", ")}`,
    );

    return withTokenRetry(ctx, userId, async (token) => {
      let workout: { id: string };
      try {
        workout = await retryOn5xx(() =>
          tonalFetch<{ id: string }>(token, "/v6/user-workouts", {
            method: "POST",
            body: payload,
          }),
        );
      } catch (err) {
        // Let 401s propagate to withTokenRetry for automatic token refresh
        if (err instanceof TonalApiError && err.status === 401) throw err;
        console.error(`createWorkout payload that failed:`, JSON.stringify(payload, null, 2));
        const movementIds = sets.map((s) => s.movementId);
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new Error(enrichPushErrorMessage(errMsg, title, movementIds));
      }
      const tonalWorkoutId = workout.id;

      // Real verification: fetch the stored workout and diff against intent.
      let pushDivergence: PushDivergence | null = null;
      try {
        const stored = await tonalFetch<{
          id: string;
          sets?: { movementId: string; prescribedReps?: number; prescribedDuration?: number }[];
        }>(token, `/v6/user-workouts/${tonalWorkoutId}`);
        if (stored.sets !== undefined) {
          // sets[] in the request is already expanded one-per-set, so each row counts as 1.
          const intended = sets.map((s) => ({ movementId: s.movementId, sets: 1 }));
          pushDivergence = computePushDivergence(intended, stored.sets);
          if (pushDivergence) {
            console.warn(
              `Push divergence on workout ${tonalWorkoutId}:`,
              JSON.stringify(pushDivergence),
            );
          }
        }
        // If stored.sets is undefined, we cannot verify; leave pushDivergence null.
      } catch (err) {
        console.warn(`Push verification: read-back failed for ${tonalWorkoutId}`, err);
      }

      return { id: tonalWorkoutId, pushDivergence };
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
          retryOn5xx(() =>
            tonalFetch<Activity[]>(token, `/v6/users/${tonalUserId}/activities?limit=100`),
          ),
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
        pushDivergence: PushDivergence | null;
      }
    | { success: false; error: string; planId: Id<"workoutPlans"> }
  > => {
    await rateLimiter.limit(ctx, "createTonalWorkout", { key: userId, throws: true });
    const sets = expandBlocksToSets(blocks as BlockInput[]);
    try {
      const tonalTitle = title;
      const { id, pushDivergence } = await ctx.runAction(
        internal.tonal.mutations.pushWorkoutToTonal,
        {
          userId,
          title: tonalTitle,
          blocks,
        },
      );
      const now = Date.now();
      const planId = await ctx.runMutation(internal.workoutPlans.create, {
        userId,
        tonalWorkoutId: id,
        source: WORKOUT_SOURCE,
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
        pushDivergence,
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

export const estimateWorkout = internalAction({
  args: {
    userId: v.id("users"),
    blocks: blockInputValidator,
  },
  handler: async (ctx, { userId, blocks }): Promise<WorkoutEstimate> => {
    const catalog = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);
    const sets = expandBlocksToSets(blocks as BlockInput[], catalog);
    // Reject empty payloads up front; Tonal would otherwise return its
    // misleading "cannot unmarshal object into Go value of type content.SetList"
    // 400 for both empty arrays and JSON-object wrappers.
    if (sets.length === 0) {
      throw new Error(
        "estimateWorkout: no sets to estimate. Verify every exercise has a valid movementId resolvable in the catalog.",
      );
    }
    // Endpoint expects a bare SetList array, not a wrapper object.
    return withTokenRetry(ctx, userId, async (token) =>
      tonalFetch<WorkoutEstimate>(token, "/v6/user-workouts/estimate", {
        method: "POST",
        body: sets,
      }),
    );
  },
});
