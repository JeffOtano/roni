/**
 * PR detection and workout performance analysis.
 *
 * Pure functions — no Convex runtime dependencies. Given per-movement history
 * (from progressiveOverload), detects personal records, plateaus, regressions,
 * and formats a concise performance summary for the training snapshot context.
 *
 * @module convex/coach/prDetection
 */

import type { MovementSessionSnapshot, PerMovementHistoryEntry } from "../progressiveOverload";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PRRecord {
  movementId: string;
  movementName: string;
  newWeightLbs: number;
  previousBestLbs: number;
  improvementPct: number;
}

export interface RegressionRecord {
  movementId: string;
  movementName: string;
  currentWeightLbs: number;
  recentAvgLbs: number;
  dropPct: number;
}

export interface PlateauRecord {
  movementId: string;
  movementName: string;
  weightLbs: number;
  flatSessionCount: number;
}

export interface WorkoutPerformanceSummary {
  prs: PRRecord[];
  plateaus: PlateauRecord[];
  regressions: RegressionRecord[];
  /** Count of exercises that are progressing normally (not PR, not plateau, not regression). */
  steadyProgressionCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get sessions that have valid avgWeightLbs. */
function sessionsWithWeight(
  sessions: readonly MovementSessionSnapshot[],
): MovementSessionSnapshot[] {
  return sessions.filter(
    (s): s is MovementSessionSnapshot & { avgWeightLbs: number } =>
      s.avgWeightLbs != null && s.avgWeightLbs > 0,
  );
}

function lookupName(movementId: string, names: ReadonlyMap<string, string>): string {
  return names.get(movementId) ?? movementId;
}

// ---------------------------------------------------------------------------
// Detection functions
// ---------------------------------------------------------------------------

/**
 * Detect personal records: latest session weight exceeds all previous sessions.
 *
 * For each movement with >= 2 sessions and weight data on the latest,
 * compares against the best avgWeightLbs from all prior sessions.
 */
export function detectPRs(
  history: PerMovementHistoryEntry[],
  movementNames: ReadonlyMap<string, string>,
): PRRecord[] {
  const prs: PRRecord[] = [];

  for (const entry of history) {
    const { movementId, sessions } = entry;
    if (sessions.length < 2) continue;

    const latest = sessions[0];
    if (latest.avgWeightLbs == null || latest.avgWeightLbs <= 0) continue;

    const previousSessions = sessionsWithWeight(sessions.slice(1));
    if (previousSessions.length === 0) continue;

    const previousBest = Math.max(...previousSessions.map((s) => s.avgWeightLbs!));

    if (latest.avgWeightLbs > previousBest) {
      const improvementPct =
        Math.round(((latest.avgWeightLbs - previousBest) / previousBest) * 100 * 10) / 10;

      prs.push({
        movementId,
        movementName: lookupName(movementId, movementNames),
        newWeightLbs: latest.avgWeightLbs,
        previousBestLbs: previousBest,
        improvementPct,
      });
    }
  }

  return prs;
}

/**
 * Detect regressions: latest session weight is significantly below recent average.
 *
 * Compares the latest session against the average of sessions[1:3] (the 2-3
 * sessions before current). If the latest is more than `thresholdPct`% below
 * that average, it's a regression.
 */
export function detectRegressions(
  history: PerMovementHistoryEntry[],
  movementNames: ReadonlyMap<string, string>,
  thresholdPct: number = 10,
): RegressionRecord[] {
  const regressions: RegressionRecord[] = [];

  for (const entry of history) {
    const { movementId, sessions } = entry;
    if (sessions.length < 2) continue;

    const latest = sessions[0];
    if (latest.avgWeightLbs == null || latest.avgWeightLbs <= 0) continue;

    const recentPrevious = sessionsWithWeight(sessions.slice(1, 4));
    if (recentPrevious.length === 0) continue;

    const recentAvg =
      recentPrevious.reduce((sum, s) => sum + s.avgWeightLbs!, 0) / recentPrevious.length;

    const dropPct = ((recentAvg - latest.avgWeightLbs) / recentAvg) * 100;

    if (dropPct > thresholdPct) {
      regressions.push({
        movementId,
        movementName: lookupName(movementId, movementNames),
        currentWeightLbs: latest.avgWeightLbs,
        recentAvgLbs: Math.round(recentAvg * 10) / 10,
        dropPct: Math.round(dropPct * 10) / 10,
      });
    }
  }

  return regressions;
}

/**
 * Detect plateaus: recent sessions all within a narrow weight range.
 *
 * Checks if the last `minSessions` sessions with weight data all have
 * avgWeightLbs within `thresholdLbs` of each other (max - min <= thresholdLbs).
 */
export function detectPlateaus(
  history: PerMovementHistoryEntry[],
  movementNames: ReadonlyMap<string, string>,
  thresholdLbs: number = 2,
  minSessions: number = 3,
): PlateauRecord[] {
  const plateaus: PlateauRecord[] = [];

  for (const entry of history) {
    const { movementId, sessions } = entry;

    const withWeight = sessionsWithWeight(sessions);
    if (withWeight.length < minSessions) continue;

    const recent = withWeight.slice(0, minSessions);
    const weights = recent.map((s) => s.avgWeightLbs!);
    const min = Math.min(...weights);
    const max = Math.max(...weights);

    if (max - min <= thresholdLbs) {
      const avgWeight = Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10;

      plateaus.push({
        movementId,
        movementName: lookupName(movementId, movementNames),
        weightLbs: avgWeight,
        flatSessionCount: minSessions,
      });
    }
  }

  return plateaus;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * Generate a full performance summary: PRs, plateaus, regressions, and steady count.
 *
 * A movement is "steady" if it has >= 2 sessions with weight data but doesn't
 * appear in any of the three detection categories.
 */
export function generatePerformanceSummary(
  history: PerMovementHistoryEntry[],
  movementNames: ReadonlyMap<string, string>,
): WorkoutPerformanceSummary {
  const prs = detectPRs(history, movementNames);
  const plateaus = detectPlateaus(history, movementNames);
  const regressions = detectRegressions(history, movementNames);

  const categorizedIds = new Set<string>([
    ...prs.map((r) => r.movementId),
    ...plateaus.map((r) => r.movementId),
    ...regressions.map((r) => r.movementId),
  ]);

  let steadyProgressionCount = 0;
  for (const entry of history) {
    if (categorizedIds.has(entry.movementId)) continue;
    const withWeight = sessionsWithWeight(entry.sessions);
    if (withWeight.length >= 2) {
      steadyProgressionCount++;
    }
  }

  return { prs, plateaus, regressions, steadyProgressionCount };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a concise text summary for the training snapshot context.
 *
 * Output is meant for system context, not chat — kept terse.
 */
export function formatPerformanceHighlights(summary: WorkoutPerformanceSummary): string {
  const lines: string[] = [];

  if (summary.prs.length > 0) {
    const prLines = summary.prs.map(
      (pr) =>
        `${pr.movementName} ${pr.newWeightLbs} avg (up from ${pr.previousBestLbs}, +${pr.improvementPct}%)`,
    );
    lines.push(`PRs: ${prLines.join("; ")}`);
  }

  if (summary.plateaus.length > 0) {
    const plateauLines = summary.plateaus.map(
      (p) => `${p.movementName} flat at ${p.weightLbs} for ${p.flatSessionCount} sessions`,
    );
    lines.push(`Plateaus: ${plateauLines.join("; ")}`);
  }

  if (summary.regressions.length > 0) {
    const regressionLines = summary.regressions.map(
      (r) => `${r.movementName} at ${r.currentWeightLbs}, recent avg was ${r.recentAvgLbs}`,
    );
    lines.push(`Down: ${regressionLines.join("; ")}`);
  }

  return lines.join("\n");
}
