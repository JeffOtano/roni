import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type {
  Activity,
  FormattedWorkoutSummary,
  Movement,
  UserWorkout,
  WorkoutActivityDetail,
} from "./tonal/types";

// ---------------------------------------------------------------------------
// getWorkoutDetail — fetch workout detail enriched with movement names
// ---------------------------------------------------------------------------

export interface EnrichedSetActivity {
  id: string;
  movementId: string;
  movementName: string | null;
  muscleGroups: string[];
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

export interface MovementSummary {
  movementId: string;
  movementName: string;
  muscleGroups: string[];
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  avgWeightLbs: number;
}

export interface EnrichedWorkoutDetail extends Omit<WorkoutActivityDetail, "workoutSetActivity"> {
  workoutSetActivity: EnrichedSetActivity[];
  movementSummaries: MovementSummary[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getWorkoutDetail = action({
  args: { activityId: v.string() },
  handler: async (ctx, args): Promise<EnrichedWorkoutDetail> => {
    if (!UUID_RE.test(args.activityId)) {
      throw new Error(`Invalid activityId: expected UUID, got "${args.activityId}"`);
    }
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const [detail, movements, formattedSummary]: [unknown, Movement[], unknown] = await Promise.all(
      [
        ctx.runAction(internal.tonal.proxy.fetchWorkoutDetail, {
          userId,
          activityId: args.activityId,
        }),
        ctx.runQuery(internal.tonal.movementSync.getAllMovements),
        ctx
          .runAction(internal.tonal.proxy.fetchFormattedSummary, {
            userId,
            summaryId: args.activityId,
          })
          .catch((): null => null),
      ],
    );
    if (!detail) throw new Error("Workout not found");
    const movementMap = new Map(movements.map((m) => [m.id, m]));

    const typedDetail = detail as WorkoutActivityDetail;

    // Volume per movement from formatted summary
    const volumeMap = new Map<string, number>();
    if (formattedSummary) {
      const typed = formattedSummary as FormattedWorkoutSummary;
      for (const ms of typed.movementSets) {
        volumeMap.set(ms.movementId, ms.totalVolume);
      }
    }

    // Enrich sets with movement name and muscle groups
    const enrichedSets = (typedDetail.workoutSetActivity ?? []).map((set) => {
      const movement = movementMap.get(set.movementId);
      return {
        ...set,
        movementName: movement?.name ?? null,
        muscleGroups: movement?.muscleGroups ?? [],
      };
    });

    // Build movement summaries grouped by movementId
    const movementSummaries = buildMovementSummaries(enrichedSets, volumeMap);

    return {
      ...typedDetail,
      workoutSetActivity: enrichedSets,
      movementSummaries,
    };
  },
});

/** Aggregate sets into per-movement summaries. Exported for testing. */
export function buildMovementSummaries(
  sets: readonly EnrichedSetActivity[],
  volumeMap: ReadonlyMap<string, number>,
): MovementSummary[] {
  const grouped = new Map<
    string,
    { name: string; muscleGroups: string[]; totalSets: number; totalReps: number }
  >();

  for (const set of sets) {
    const existing = grouped.get(set.movementId);
    if (existing) {
      existing.totalSets += 1;
      existing.totalReps += set.repetition;
    } else {
      grouped.set(set.movementId, {
        name: set.movementName ?? "Unknown",
        muscleGroups: set.muscleGroups,
        totalSets: 1,
        totalReps: set.repetition,
      });
    }
  }

  return Array.from(grouped.entries()).map(([movementId, data]) => {
    const totalVolume = volumeMap.get(movementId) ?? 0;
    return {
      movementId,
      movementName: data.name,
      muscleGroups: data.muscleGroups,
      totalVolume,
      totalSets: data.totalSets,
      totalReps: data.totalReps,
      avgWeightLbs:
        data.totalReps > 0 && totalVolume > 0 ? Math.round(totalVolume / data.totalReps) : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// getExerciseCatalog — search the global movement catalog
// ---------------------------------------------------------------------------

interface CatalogEntry {
  id: string;
  name: string;
  muscleGroups: string[];
  skillLevel: number;
  thumbnailMediaUrl?: string;
  onMachine: boolean;
}

export const getExerciseCatalog = action({
  args: {
    search: v.optional(v.string()),
    muscleGroup: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<CatalogEntry[]> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const catalog = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);

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
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
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
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

    const all = (await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
      userId,
      limit: limit + 10,
    })) as Activity[];

    return all.filter((a) => a.workoutPreview?.totalVolume > 0).slice(0, limit);
  },
});
