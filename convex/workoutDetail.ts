import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { normalizeTargetArea } from "./lib/targetArea";
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
  prescribedReps?: number;
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
  avgWeight?: number;
  baseWeight?: number;
  volume?: number;
  repCount?: number;
  oneRepMax?: number;
}

export interface MovementSummary {
  movementId: string;
  movementName: string;
  muscleGroups: string[];
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  avgWeightLbs: number;
  /** True when this session's avgWeightLbs is the user's all-time best. */
  isPR?: boolean;
}

export interface EnrichedWorkoutDetail extends Omit<WorkoutActivityDetail, "workoutSetActivity"> {
  workoutSetActivity: EnrichedSetActivity[];
  movementSummaries: MovementSummary[];
  /** Human-readable workout title from activity history (e.g. "Arms Burnout"). */
  workoutTitle?: string;
  /** Target area from activity history (e.g. "Upper Body"). */
  targetArea?: string;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Return the movementIds that got a new all-time PR in the given activity.
 *
 * Reads the materialized `personalRecords` projection: a movement's PR row
 * points back to the single activity that set the best weight
 * (`achievedActivityId`), with ties broken by earliest insertion. So a
 * movement's PR belongs to this activity iff its projection row points here
 * AND there were prior weighted sessions (`totalSessions > 1`) — otherwise
 * the very first session of every movement would falsely register as a PR.
 */
export const getPRMovementIdsForActivity = internalQuery({
  args: { userId: v.id("users"), activityId: v.string() },
  handler: async (ctx, { userId, activityId }): Promise<string[]> => {
    const records = await ctx.db
      .query("personalRecords")
      .withIndex("by_userId_movementId", (q) => q.eq("userId", userId))
      .collect();
    return records
      .filter((r) => r.achievedActivityId === activityId && r.totalSessions > 1)
      .map((r) => r.movementId);
  },
});

/** Look up completed-workout metadata (title, targetArea) for the activity page header. */
export const getCompletedWorkoutMeta = internalQuery({
  args: { userId: v.id("users"), activityId: v.string() },
  handler: async (ctx, { userId, activityId }) => {
    const row = await ctx.db
      .query("completedWorkouts")
      .withIndex("by_userId_activityId", (q) => q.eq("userId", userId).eq("activityId", activityId))
      .first();
    if (!row) return null;
    return { title: row.title, targetArea: row.targetArea, workoutType: row.workoutType };
  },
});

export const getWorkoutDetail = action({
  args: { activityId: v.string() },
  handler: async (ctx, args): Promise<EnrichedWorkoutDetail | null> => {
    if (!UUID_RE.test(args.activityId)) {
      console.warn(`getWorkoutDetail: invalid activityId format "${args.activityId}"`);
      return null;
    }
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    // Session expired or user not signed in — AppShell will redirect to /login.
    // Returning null keeps this out of Sentry (vs. throwing "Not authenticated").
    if (!userId) return null;

    const [detail, movements, formattedSummary, workoutMeta, prMovementIdList]: [
      unknown,
      Movement[],
      unknown,
      { title: string; targetArea: string; workoutType: string } | null,
      string[],
    ] = await Promise.all([
      ctx
        .runAction(internal.tonal.proxy.fetchWorkoutDetail, {
          userId,
          activityId: args.activityId,
        })
        .catch((): null => null),
      ctx.runQuery(internal.tonal.movementSync.getAllMovements),
      ctx
        .runAction(internal.tonal.proxyProjected.fetchFormattedSummary, {
          userId,
          summaryId: args.activityId,
        })
        .catch((): null => null),
      ctx.runQuery(internal.workoutDetail.getCompletedWorkoutMeta, {
        userId,
        activityId: args.activityId,
      }),
      ctx.runQuery(internal.workoutDetail.getPRMovementIdsForActivity, {
        userId,
        activityId: args.activityId,
      }),
    ]);
    if (!detail) return null;
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

    // StraightBar avgWeight is per-motor; double it to get the actual bar weight.
    const enrichedSets = (typedDetail.workoutSetActivity ?? []).map((set) => {
      const movement = movementMap.get(set.movementId);
      const isStraightBar = movement?.onMachineInfo?.accessory === "StraightBar";
      return {
        ...set,
        movementName: movement?.name ?? null,
        muscleGroups: movement?.muscleGroups ?? [],
        avgWeight: isStraightBar && set.avgWeight != null ? set.avgWeight * 2 : set.avgWeight,
      };
    });

    const prMovementIds = new Set(prMovementIdList);

    // Build movement summaries grouped by movementId
    const movementSummaries = buildMovementSummaries(enrichedSets, volumeMap, prMovementIds);

    return {
      ...typedDetail,
      workoutSetActivity: enrichedSets,
      movementSummaries,
      workoutTitle: workoutMeta?.title ?? undefined,
      targetArea: workoutMeta ? normalizeTargetArea(workoutMeta.targetArea) : undefined,
    };
  },
});

/** Aggregate sets into per-movement summaries. Exported for testing. */
export function buildMovementSummaries(
  sets: readonly EnrichedSetActivity[],
  volumeMap: ReadonlyMap<string, number>,
  prMovementIds?: ReadonlySet<string>,
): MovementSummary[] {
  const grouped = new Map<
    string,
    {
      name: string;
      muscleGroups: string[];
      totalSets: number;
      totalReps: number;
      weightedWeightSum: number;
      weightedReps: number;
    }
  >();

  for (const set of sets) {
    const existing = grouped.get(set.movementId);
    const reps = set.repetition ?? 0;
    const hasWeight = set.avgWeight != null && set.avgWeight > 0 && reps > 0;
    if (existing) {
      existing.totalSets += 1;
      existing.totalReps += reps;
      if (hasWeight) {
        existing.weightedWeightSum += set.avgWeight! * reps;
        existing.weightedReps += reps;
      }
    } else {
      grouped.set(set.movementId, {
        name: set.movementName ?? "Unknown",
        muscleGroups: set.muscleGroups,
        totalSets: 1,
        totalReps: reps,
        weightedWeightSum: hasWeight ? set.avgWeight! * reps : 0,
        weightedReps: hasWeight ? reps : 0,
      });
    }
  }

  return Array.from(grouped.entries()).map(([movementId, data]) => {
    const totalVolume = volumeMap.get(movementId) ?? 0;
    const avgWeightLbs =
      data.weightedReps > 0 ? Math.round(data.weightedWeightSum / data.weightedReps) : 0;
    return {
      movementId,
      movementName: data.name,
      muscleGroups: data.muscleGroups,
      totalVolume,
      totalSets: data.totalSets,
      totalReps: data.totalReps,
      avgWeightLbs,
      isPR: prMovementIds?.has(movementId) || undefined,
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

    return (await ctx.runAction(internal.tonal.proxyProjected.fetchCustomWorkouts, {
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

    const all = (await ctx.runAction(internal.tonal.workoutHistoryProxy.fetchWorkoutHistory, {
      userId,
    })) as Activity[];

    return all.filter((a) => a.workoutPreview?.totalVolume > 0).slice(0, limit);
  },
});
