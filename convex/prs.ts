import { query } from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";
import { generatePerformanceSummary } from "./coach/prDetection";
import type { PerMovementHistoryEntry } from "./progressiveOverload";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AllTimePREntry {
  movementId: string;
  movementName: string;
  bestWeightLbs: number;
  achievedDate: string;
  muscleGroups: string[];
  totalSessions: number;
}

export interface RecentPRSummary {
  recentPRs: Array<{
    movementId: string;
    movementName: string;
    newWeightLbs: number;
    previousBestLbs: number;
    improvementPct: number;
  }>;
  plateauCount: number;
  regressionCount: number;
  steadyCount: number;
  totalMovementsTracked: number;
}

/** Max exercisePerformance rows to scan per user (bounds query cost). */
const MAX_PERFORMANCE_ROWS = 5000;

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Minimal shape needed from an exercisePerformance row. */
export interface PerfRow {
  activityId: string;
  movementId: string;
  date: string;
  sets: number;
  totalReps: number;
  avgWeightLbs?: number;
}

interface MovementMeta {
  name: string;
  muscleGroups: string[];
}

/** Group performance rows into all-time bests per movement. */
export function aggregateAllTimePRs(
  rows: readonly PerfRow[],
  metaMap: ReadonlyMap<string, MovementMeta>,
  /** Map activityId → date from completedWorkouts (corrected local date). */
  workoutDateMap?: ReadonlyMap<string, string>,
): AllTimePREntry[] {
  const byMovement = new Map<
    string,
    { bestWeight: number; bestDate: string; bestActivityId: string; sessions: number }
  >();

  for (const row of rows) {
    const weight = row.avgWeightLbs;
    if (weight == null || weight <= 0) continue;

    const existing = byMovement.get(row.movementId);
    if (existing) {
      existing.sessions += 1;
      if (weight > existing.bestWeight) {
        existing.bestWeight = weight;
        existing.bestDate = row.date;
        existing.bestActivityId = row.activityId;
      }
    } else {
      byMovement.set(row.movementId, {
        bestWeight: weight,
        bestDate: row.date,
        bestActivityId: row.activityId,
        sessions: 1,
      });
    }
  }

  const entries: AllTimePREntry[] = [];
  for (const [movementId, data] of byMovement) {
    const meta = metaMap.get(movementId);
    // Prefer the completedWorkouts date (local time) over exercisePerformance date (UTC)
    const date = workoutDateMap?.get(data.bestActivityId) ?? data.bestDate;
    entries.push({
      movementId,
      movementName: meta?.name ?? "Unknown",
      bestWeightLbs: Math.round(data.bestWeight),
      achievedDate: date,
      muscleGroups: meta?.muscleGroups ?? [],
      totalSessions: data.sessions,
    });
  }

  entries.sort((a, b) => b.bestWeightLbs - a.bestWeightLbs);
  return entries;
}

/** Group performance rows into PerMovementHistoryEntry[] for prDetection. */
export function buildHistoryFromRows(rows: readonly PerfRow[]): PerMovementHistoryEntry[] {
  const sessionMap = new Map<
    string,
    Array<{
      sessionDate: string;
      sets: number;
      totalReps: number;
      repsPerSet: number;
      avgWeightLbs?: number;
    }>
  >();

  for (const row of rows) {
    const snapshot = {
      sessionDate: row.date,
      sets: row.sets,
      totalReps: row.totalReps,
      repsPerSet: row.sets > 0 ? Math.round(row.totalReps / row.sets) : 0,
      avgWeightLbs: row.avgWeightLbs ?? undefined,
    };
    const sessions = sessionMap.get(row.movementId);
    if (sessions) {
      sessions.push(snapshot);
    } else {
      sessionMap.set(row.movementId, [snapshot]);
    }
  }

  return Array.from(sessionMap, ([movementId, sessions]) => ({
    movementId,
    sessions,
  }));
}

/** Build RecentPRSummary from history + name map. */
export function buildRecentPRSummary(
  history: PerMovementHistoryEntry[],
  nameMap: ReadonlyMap<string, string>,
): RecentPRSummary {
  const summary = generatePerformanceSummary(history, nameMap);
  return {
    recentPRs: summary.prs,
    plateauCount: summary.plateaus.length,
    regressionCount: summary.regressions.length,
    steadyCount: summary.steadyProgressionCount,
    totalMovementsTracked: history.length,
  };
}

// ---------------------------------------------------------------------------
// getAllTimePRs — best avgWeightLbs per movement, all time
// ---------------------------------------------------------------------------

export const getAllTimePRs = query({
  args: {},
  handler: async (ctx): Promise<AllTimePREntry[]> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rows = await ctx.db
      .query("exercisePerformance")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_PERFORMANCE_ROWS);

    // Build date map from completedWorkouts (local dates, not UTC)
    const workouts = await ctx.db
      .query("completedWorkouts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(MAX_PERFORMANCE_ROWS);
    const workoutDateMap = new Map(workouts.map((w) => [w.activityId, w.date]));

    const movementDocs = await ctx.db.query("movements").take(5000);
    const metaMap = new Map(
      movementDocs.map((m) => [m.tonalId, { name: m.name, muscleGroups: m.muscleGroups }]),
    );

    return aggregateAllTimePRs(rows, metaMap, workoutDateMap);
  },
});

// ---------------------------------------------------------------------------
// getRecentPRSummary — recent PRs, plateaus, regressions via prDetection
// ---------------------------------------------------------------------------

export const getRecentPRSummary = query({
  args: {},
  handler: async (ctx): Promise<RecentPRSummary> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rows = await ctx.db
      .query("exercisePerformance")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_PERFORMANCE_ROWS);

    const history = buildHistoryFromRows(rows);

    const movementDocs = await ctx.db.query("movements").take(5000);
    const nameMap = new Map(movementDocs.map((m) => [m.tonalId, m.name]));

    return buildRecentPRSummary(history, nameMap);
  },
});
