import { describe, expect, it } from "vitest";
import { buildHistoryFromRows, buildRecentPRSummary, isoDateDaysAgo, type PerfRow } from "./prs";

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

const names = new Map([
  ["bench", "Bench Press"],
  ["squat", "Squat"],
  ["curl", "Bicep Curl"],
]);

// ---------------------------------------------------------------------------
// isoDateDaysAgo
// ---------------------------------------------------------------------------

describe("isoDateDaysAgo", () => {
  it("returns YYYY-MM-DD N days before the given date", () => {
    expect(isoDateDaysAgo(new Date("2026-04-15T12:00:00Z"), 0)).toBe("2026-04-15");
    expect(isoDateDaysAgo(new Date("2026-04-15T12:00:00Z"), 7)).toBe("2026-04-08");
    expect(isoDateDaysAgo(new Date("2026-04-15T12:00:00Z"), 120)).toBe("2025-12-16");
  });

  it("handles year boundaries", () => {
    expect(isoDateDaysAgo(new Date("2026-01-05T12:00:00Z"), 10)).toBe("2025-12-26");
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
