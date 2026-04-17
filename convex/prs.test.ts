import { describe, expect, it } from "vitest";
import {
  aggregateAllTimePRs,
  buildHistoryFromRows,
  buildRecentPRSummary,
  type PerfRow,
} from "./prs";

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

let rowCounter = 0;

function row(
  movementId: string,
  date: string,
  sets: number,
  totalReps: number,
  avgWeightLbs?: number,
): PerfRow {
  return { activityId: `act-${++rowCounter}`, movementId, date, sets, totalReps, avgWeightLbs };
}

const meta = new Map([
  ["bench", { name: "Bench Press", muscleGroups: ["Chest", "Triceps"] }],
  ["squat", { name: "Squat", muscleGroups: ["Quads", "Glutes"] }],
  ["curl", { name: "Bicep Curl", muscleGroups: ["Biceps"] }],
]);

const names = new Map([
  ["bench", "Bench Press"],
  ["squat", "Squat"],
  ["curl", "Bicep Curl"],
]);

// ---------------------------------------------------------------------------
// aggregateAllTimePRs
// ---------------------------------------------------------------------------

describe("aggregateAllTimePRs", () => {
  it("returns empty array for no rows", () => {
    expect(aggregateAllTimePRs([], meta)).toEqual([]);
  });

  it("finds the best weight per movement", () => {
    const rows = [
      row("bench", "2025-03-14", 3, 30, 100),
      row("bench", "2025-03-10", 3, 30, 90),
      row("bench", "2025-03-07", 3, 30, 95),
      row("squat", "2025-03-14", 4, 40, 150),
      row("squat", "2025-03-10", 4, 40, 140),
    ];

    const result = aggregateAllTimePRs(rows, meta);

    expect(result).toHaveLength(2);
    // Sorted by best weight desc — squat first
    expect(result[0]).toEqual({
      movementId: "squat",
      movementName: "Squat",
      bestWeightLbs: 150,
      achievedDate: "2025-03-14",
      muscleGroups: ["Quads", "Glutes"],
      totalSessions: 2,
    });
    expect(result[1]).toEqual({
      movementId: "bench",
      movementName: "Bench Press",
      bestWeightLbs: 100,
      achievedDate: "2025-03-14",
      muscleGroups: ["Chest", "Triceps"],
      totalSessions: 3,
    });
  });

  it("skips rows with no weight or zero weight", () => {
    const rows = [
      row("bench", "2025-03-14", 3, 30, 100),
      row("bench", "2025-03-10", 3, 30, undefined),
      row("squat", "2025-03-14", 4, 40, 0),
    ];

    const result = aggregateAllTimePRs(rows, meta);

    expect(result).toHaveLength(1);
    expect(result[0].movementId).toBe("bench");
    expect(result[0].totalSessions).toBe(1);
  });

  it("uses 'Unknown' for movements not in the meta map", () => {
    const rows = [row("unknown-id", "2025-03-14", 3, 30, 50)];

    const result = aggregateAllTimePRs(rows, meta);

    expect(result[0].movementName).toBe("Unknown");
    expect(result[0].muscleGroups).toEqual([]);
  });

  it("tracks the date of the best weight, not the latest date", () => {
    const rows = [
      row("bench", "2025-03-14", 3, 30, 80), // latest, lower weight
      row("bench", "2025-03-07", 3, 30, 100), // older, best weight
    ];

    const result = aggregateAllTimePRs(rows, meta);

    expect(result[0].bestWeightLbs).toBe(100);
    expect(result[0].achievedDate).toBe("2025-03-07");
  });

  it("rounds fractional weights", () => {
    const rows = [row("bench", "2025-03-14", 3, 30, 97.7)];

    const result = aggregateAllTimePRs(rows, meta);

    expect(result[0].bestWeightLbs).toBe(98);
  });

  it("uses workoutDateMap date when available", () => {
    const rows = [
      row("bench", "2025-03-08", 3, 30, 100), // UTC date is 03-08
    ];
    // completedWorkouts has the local date as 03-07
    const workoutDateMap = new Map([[rows[0].activityId, "2025-03-07"]]);

    const result = aggregateAllTimePRs(rows, meta, workoutDateMap);

    expect(result[0].achievedDate).toBe("2025-03-07");
  });

  it("falls back to exercisePerformance date when workoutDateMap has no entry", () => {
    const rows = [row("bench", "2025-03-08", 3, 30, 100)];
    const workoutDateMap = new Map<string, string>(); // empty

    const result = aggregateAllTimePRs(rows, meta, workoutDateMap);

    expect(result[0].achievedDate).toBe("2025-03-08");
  });
});

// ---------------------------------------------------------------------------
// buildHistoryFromRows
// ---------------------------------------------------------------------------

describe("buildHistoryFromRows", () => {
  it("returns empty array for no rows", () => {
    expect(buildHistoryFromRows([])).toEqual([]);
  });

  it("groups rows by movementId", () => {
    const rows = [
      row("bench", "2025-03-14", 3, 30, 100),
      row("squat", "2025-03-14", 4, 40, 150),
      row("bench", "2025-03-10", 3, 30, 90),
    ];

    const result = buildHistoryFromRows(rows);

    expect(result).toHaveLength(2);

    const bench = result.find((e) => e.movementId === "bench");
    expect(bench?.sessions).toHaveLength(2);
    expect(bench?.sessions[0].sessionDate).toBe("2025-03-14");
    expect(bench?.sessions[1].sessionDate).toBe("2025-03-10");
  });

  it("computes repsPerSet correctly", () => {
    const rows = [row("bench", "2025-03-14", 3, 27, 100)];

    const result = buildHistoryFromRows(rows);

    expect(result[0].sessions[0].repsPerSet).toBe(9);
  });

  it("handles zero sets gracefully", () => {
    const rows = [row("bench", "2025-03-14", 0, 0, 100)];

    const result = buildHistoryFromRows(rows);

    expect(result[0].sessions[0].repsPerSet).toBe(0);
  });

  it("converts null avgWeightLbs to undefined", () => {
    const rows = [row("bench", "2025-03-14", 3, 30, undefined)];

    const result = buildHistoryFromRows(rows);

    expect(result[0].sessions[0].avgWeightLbs).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildRecentPRSummary
// ---------------------------------------------------------------------------

describe("buildRecentPRSummary", () => {
  it("returns zero counts for empty history", () => {
    const result = buildRecentPRSummary([], names);

    expect(result.recentPRs).toEqual([]);
    expect(result.plateauCount).toBe(0);
    expect(result.regressionCount).toBe(0);
    expect(result.steadyCount).toBe(0);
    expect(result.totalMovementsTracked).toBe(0);
  });

  it("detects a PR when latest session beats previous best", () => {
    const history = buildHistoryFromRows([
      row("bench", "2025-03-14", 3, 30, 100),
      row("bench", "2025-03-10", 3, 30, 90),
      row("bench", "2025-03-07", 3, 30, 85),
    ]);

    const result = buildRecentPRSummary(history, names);

    expect(result.recentPRs).toHaveLength(1);
    expect(result.recentPRs[0].movementName).toBe("Bench Press");
    expect(result.recentPRs[0].newWeightLbs).toBe(100);
    expect(result.recentPRs[0].previousBestLbs).toBe(90);
  });

  it("does not detect a PR when latest is not the best", () => {
    const history = buildHistoryFromRows([
      row("bench", "2025-03-14", 3, 30, 80),
      row("bench", "2025-03-10", 3, 30, 90),
      row("bench", "2025-03-07", 3, 30, 85),
    ]);

    const result = buildRecentPRSummary(history, names);

    expect(result.recentPRs).toHaveLength(0);
  });

  it("detects plateau when recent sessions are within 2 lbs", () => {
    const history = buildHistoryFromRows([
      row("bench", "2025-03-14", 3, 30, 100),
      row("bench", "2025-03-10", 3, 30, 99),
      row("bench", "2025-03-07", 3, 30, 100),
    ]);

    const result = buildRecentPRSummary(history, names);

    expect(result.plateauCount).toBe(1);
  });

  it("counts total movements tracked", () => {
    const history = buildHistoryFromRows([
      row("bench", "2025-03-14", 3, 30, 100),
      row("squat", "2025-03-14", 4, 40, 150),
      row("curl", "2025-03-14", 3, 30, 30),
    ]);

    const result = buildRecentPRSummary(history, names);

    expect(result.totalMovementsTracked).toBe(3);
  });

  it("detects multiple PRs across different movements", () => {
    const history = buildHistoryFromRows([
      // bench: PR
      row("bench", "2025-03-14", 3, 30, 100),
      row("bench", "2025-03-10", 3, 30, 90),
      // squat: PR
      row("squat", "2025-03-14", 4, 40, 160),
      row("squat", "2025-03-10", 4, 40, 150),
    ]);

    const result = buildRecentPRSummary(history, names);

    expect(result.recentPRs).toHaveLength(2);
    const prNames = result.recentPRs.map((p) => p.movementName).sort();
    expect(prNames).toEqual(["Bench Press", "Squat"]);
  });
});
