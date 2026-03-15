import { v } from "convex/values";
import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Activity, Movement, UserWorkout, WorkoutActivityDetail } from "./tonal/types";

// ---------------------------------------------------------------------------
// getWorkoutDetail — fetch workout detail enriched with movement names
// ---------------------------------------------------------------------------

export interface EnrichedSetActivity {
  id: string;
  movementId: string;
  movementName: string | null;
  prescribedReps: number;
  repetition: number;
  repetitionTotal: number;
  blockNumber: number;
  spotter: boolean;
  eccentric: boolean;
  chains: boolean;
  flex: boolean;
  warmUp: boolean;
  beginTime: string;
  sideNumber: number;
  weightPercentage?: number;
}

export interface EnrichedWorkoutDetail extends Omit<WorkoutActivityDetail, "workoutSetActivity"> {
  workoutSetActivity: EnrichedSetActivity[];
}

export const getWorkoutDetail = action({
  args: { activityId: v.string() },
  handler: async (ctx, args): Promise<EnrichedWorkoutDetail> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const [detail, movementsCached] = await Promise.all([
      ctx.runAction(internal.tonal.proxy.fetchWorkoutDetail, {
        userId,
        activityId: args.activityId,
      }),
      ctx.runQuery(internal.tonal.cache.getCacheEntry, {
        userId: undefined,
        dataType: "movements",
      }),
    ]);

    const movements = (movementsCached?.data as Movement[] | undefined) ?? [];
    const movementMap = new Map(movements.map((m) => [m.id, m.name]));

    const typedDetail = detail as WorkoutActivityDetail;

    return {
      ...typedDetail,
      workoutSetActivity: typedDetail.workoutSetActivity.map((set) => ({
        ...set,
        movementName: movementMap.get(set.movementId) ?? null,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// getExerciseCatalog — search the global movement catalog
// ---------------------------------------------------------------------------

interface CatalogEntry {
  id: string;
  name: string;
  muscleGroups: string[];
  skillLevel: number;
  thumbnailMediaUrl: string;
  onMachine: boolean;
}

export const getExerciseCatalog = action({
  args: {
    search: v.optional(v.string()),
    muscleGroup: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<CatalogEntry[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const cached = await ctx.runQuery(internal.tonal.cache.getCacheEntry, {
      userId: undefined,
      dataType: "movements",
    });

    let catalog = (cached?.data as Movement[] | undefined) ?? [];

    // If cache is empty, fetch it via the proxy (requires a userId for token)
    if (catalog.length === 0) {
      catalog = (await ctx.runAction(internal.tonal.proxy.fetchMovements, {
        userId,
      })) as Movement[];
    }

    return filterCatalog(catalog, args);
  },
});

/** Filter and map the movement catalog. Exported for testing. */
export function filterCatalog(
  catalog: readonly Movement[],
  filters: { search?: string; muscleGroup?: string },
): CatalogEntry[] {
  let results = [...catalog];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter((m) => m.name.toLowerCase().includes(q));
  }

  if (filters.muscleGroup) {
    const g = filters.muscleGroup.toLowerCase();
    results = results.filter((m) => m.muscleGroups.some((mg) => mg.toLowerCase() === g));
  }

  return results.slice(0, 50).map((m) => ({
    id: m.id,
    name: m.name,
    muscleGroups: m.muscleGroups,
    skillLevel: m.skillLevel,
    thumbnailMediaUrl: m.thumbnailMediaUrl,
    onMachine: m.onMachine,
  }));
}

// ---------------------------------------------------------------------------
// getCustomWorkouts — fetch user's custom Tonal workouts
// ---------------------------------------------------------------------------

export const getCustomWorkouts = action({
  args: {},
  handler: async (ctx): Promise<UserWorkout[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return (await ctx.runAction(internal.tonal.proxy.fetchCustomWorkouts, {
      userId,
    })) as UserWorkout[];
  },
});

// ---------------------------------------------------------------------------
// getWorkoutHistoryFull — configurable-limit workout history
// ---------------------------------------------------------------------------

export const getWorkoutHistoryFull = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Activity[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

    const all = (await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
      userId,
      limit: limit + 10,
    })) as Activity[];

    return all
      .filter((a) => a.workoutPreview?.totalVolume > 0 || a.workoutPreview?.workoutId !== "")
      .slice(0, limit);
  },
});
