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

/**
 * Days of recent exercisePerformance history fed into the recent-trend
 * analyzer. Covers ~4 months of training, which is longer than every window
 * `generatePerformanceSummary` currently looks at.
 */
const RECENT_WINDOW_DAYS = 120;

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

/** YYYY-MM-DD string for `daysAgo` days before `now`, in UTC. */
export function isoDateDaysAgo(now: Date, daysAgo: number): string {
  const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return cutoff.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// getAllTimePRs — one indexed scan of the personalRecords projection.
// ---------------------------------------------------------------------------

export const getAllTimePRs = query({
  args: {},
  handler: async (ctx): Promise<AllTimePREntry[]> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const records = await ctx.db
      .query("personalRecords")
      .withIndex("by_userId_best", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    if (records.length === 0) return [];

    const movementDocs = await ctx.db.query("movements").collect();
    const metaMap = new Map(
      movementDocs.map((m) => [m.tonalId, { name: m.name, muscleGroups: m.muscleGroups }]),
    );

    return records.map((r) => {
      const meta = metaMap.get(r.movementId);
      return {
        movementId: r.movementId,
        movementName: meta?.name ?? "Unknown",
        bestWeightLbs: Math.round(r.bestAvgWeightLbs),
        achievedDate: r.achievedDate,
        muscleGroups: meta?.muscleGroups ?? [],
        totalSessions: r.totalSessions,
      };
    });
  },
});

// ---------------------------------------------------------------------------
// getRecentPRSummary — recent PRs, plateaus, regressions via prDetection.
// ---------------------------------------------------------------------------

export const getRecentPRSummary = query({
  args: {},
  handler: async (ctx): Promise<RecentPRSummary> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const since = isoDateDaysAgo(new Date(), RECENT_WINDOW_DAYS);

    const [rows, movementDocs] = await Promise.all([
      ctx.db
        .query("exercisePerformance")
        .withIndex("by_userId_date", (q) => q.eq("userId", userId).gte("date", since))
        .order("desc")
        .collect(),
      ctx.db.query("movements").collect(),
    ]);

    const history = buildHistoryFromRows(rows);
    const nameMap = new Map(movementDocs.map((m) => [m.tonalId, m.name]));

    return buildRecentPRSummary(history, nameMap);
  },
});
