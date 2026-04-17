import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Return the best avgWeightLbs per movement from exercisePerformance, including the current activity.
 *  We include the current activity so the comparison uses the same stored value for both sides. */
export const getHistoricalBests = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const PAGE_SIZE = 1000;
    const allRows: Doc<"exercisePerformance">[] = [];
    let cursor: string | null = null;

    // Paginate through all results to avoid truncation
    while (true) {
      const query = ctx.db
        .query("exercisePerformance")
        .withIndex("by_userId_date", (q) => q.eq("userId", userId));

      const result = await query.paginate({ numItems: PAGE_SIZE, cursor });

      allRows.push(...result.page);
      cursor = result.continueCursor;

      if (!cursor || result.page.length < PAGE_SIZE) break;
    }

    // Warn if results approach the old 5000 limit
    if (allRows.length >= 5000) {
      console.warn(
        `getHistoricalBests: fetched ${allRows.length} rows for user ${userId}. ` +
          `Consider maintaining a dedicated personal bests table for better performance.`,
      );
    }

    const bests = new Map<string, { best: number; count: number }>();
    for (const row of allRows) {
      if (row.avgWeightLbs == null || row.avgWeightLbs <= 0) continue;
      const existing = bests.get(row.movementId);
      if (existing) {
        existing.count += 1;
        if (row.avgWeightLbs > existing.best) {
          existing.best = row.avgWeightLbs;
        }
      } else {
        bests.set(row.movementId, { best: row.avgWeightLbs, count: 1 });
      }
    }
    return Object.fromEntries([...bests].map(([id, { best, count }]) => [id, { best, count }]));
  },
});

/** Get exercisePerformance rows for a specific workout — used for PR comparison. */
export const getWorkoutPerformanceRows = internalQuery({
  args: { userId: v.id("users"), activityId: v.string() },
  handler: async (ctx, { userId, activityId }) => {
    const rows = await ctx.db
      .query("exercisePerformance")
      .withIndex("by_userId_activityId", (q) => q.eq("userId", userId).eq("activityId", activityId))
      .take(100);
    return rows.map((r) => ({ movementId: r.movementId, avgWeightLbs: r.avgWeightLbs }));
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
  handler: async (ctx, args): Promise<EnrichedWorkoutDetail> => {
    if (!UUID_RE.test(args.activityId)) {
      throw new Error(`Invalid activityId: expected UUID, got "${args.activityId}"`);
    }
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const [detail, movements, formattedSummary, workoutMeta, historicalBests, thisWorkoutPerf]: [
      unknown,
      Movement[],
      unknown,
      { title: string; targetArea: string; workoutType: string } | null,
      Record<string, { best: number; count: number }>,
      Array<{ movementId: string; avgWeightLbs?: number }>,
    ] = await Promise.all([
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
      ctx.runQuery(internal.workoutDetail.getCompletedWorkoutMeta, {
        userId,
        activityId: args.activityId,
      }),
      ctx.runQuery(internal.workoutDetail.getHistoricalBests, {
        userId,
      }),
      ctx.runQuery(internal.workoutDetail.getWorkoutPerformanceRows, {
        userId,
        activityId: args.activityId,
      }),
    ]);
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

    // Detect PRs by comparing this workout's stored exercisePerformance values
    // against all-time bests (same metric, same source — avoids computation mismatches).
    const prMovementIds = new Set<string>();
    for (const perf of thisWorkoutPerf) {
      if (perf.avgWeightLbs == null || perf.avgWeightLbs <= 0) continue;
      const hist = historicalBests[perf.movementId];
      if (!hist) continue;
      // PR if this workout's stored value equals the all-time best and there are 2+ sessions
      if (perf.avgWeightLbs >= hist.best && hist.count >= 2) {
        prMovementIds.add(perf.movementId);
      }
    }

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

    const all = (await ctx.runAction(internal.tonal.workoutHistoryProxy.fetchWorkoutHistory, {
      userId,
    })) as Activity[];

    return all.filter((a) => a.workoutPreview?.totalVolume > 0).slice(0, limit);
  },
});
