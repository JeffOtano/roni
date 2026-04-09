import { describe, expect, it } from "vitest";
import type { MovementSessionSnapshot, PerMovementHistoryEntry } from "../progressiveOverload";
import {
  detectPlateaus,
  detectPRs,
  detectRegressions,
  formatPerformanceHighlights,
  generatePerformanceSummary,
  type PRRecord,
  type WorkoutPerformanceSummary,
} from "./prDetection";

function session(
  date: string,
  sets: number,
  reps: number,
  weight?: number,
): MovementSessionSnapshot {
  return {
    sessionDate: date,
    sets,
    totalReps: sets * reps,
    repsPerSet: reps,
    avgWeightLbs: weight,
  };
}

function entry(id: string, sessions: MovementSessionSnapshot[]): PerMovementHistoryEntry {
  return { movementId: id, sessions };
}

function pr(overrides: Partial<PRRecord> & Pick<PRRecord, "movementId">): PRRecord {
  return {
    movementName: overrides.movementId,
    newWeightLbs: 0,
    previousBestLbs: 0,
    improvementPct: 0,
    ...overrides,
  };
}

function summary(overrides: Partial<WorkoutPerformanceSummary> = {}): WorkoutPerformanceSummary {
  return { prs: [], plateaus: [], regressions: [], steadyProgressionCount: 0, ...overrides };
}

const names = new Map([
  ["bench", "Bench Press"],
  ["ohp", "Overhead Press"],
  ["row", "Barbell Row"],
  ["squat", "Squat"],
]);

describe("detectPRs", () => {
  it("detects PR when latest weight exceeds all previous sessions", () => {
    const h = [
      entry("bench", [
        session("03-14", 3, 10, 75),
        session("03-10", 3, 10, 70),
        session("03-07", 3, 10, 65),
      ]),
    ];
    const result = detectPRs(h, names);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      movementId: "bench",
      movementName: "Bench Press",
      newWeightLbs: 75,
      previousBestLbs: 70,
      improvementPct: 7.1,
    });
  });

  it("returns no PR when latest matches previous best exactly", () => {
    const h = [
      entry("bench", [
        session("03-14", 3, 10, 70),
        session("03-10", 3, 10, 70),
        session("03-07", 3, 10, 65),
      ]),
    ];
    expect(detectPRs(h, names)).toHaveLength(0);
  });

  it("returns no PR when latest is below previous best", () => {
    const h = [entry("bench", [session("03-14", 3, 10, 65), session("03-10", 3, 10, 70)])];
    expect(detectPRs(h, names)).toHaveLength(0);
  });

  it("returns no PR with only one session", () => {
    expect(detectPRs([entry("bench", [session("03-14", 3, 10, 100)])], names)).toHaveLength(0);
  });

  it("returns no PR when latest has no weight data", () => {
    const h = [entry("bench", [session("03-14", 3, 10), session("03-10", 3, 10, 70)])];
    expect(detectPRs(h, names)).toHaveLength(0);
  });

  it("detects multiple PRs across different exercises", () => {
    const h = [
      entry("bench", [session("03-14", 3, 10, 75), session("03-10", 3, 10, 70)]),
      entry("ohp", [session("03-14", 3, 8, 55), session("03-10", 3, 8, 50)]),
    ];
    const result = detectPRs(h, names);
    expect(result).toHaveLength(2);
    expect(result[0].movementId).toBe("bench");
    expect(result[1].movementId).toBe("ohp");
  });

  it("calculates improvement percentage to one decimal place", () => {
    const h = [entry("bench", [session("03-14", 3, 10, 73), session("03-10", 3, 10, 69)])];
    // ((73 - 69) / 69) * 100 = 5.7971... -> 5.8
    expect(detectPRs(h, names)[0].improvementPct).toBe(5.8);
  });

  it("skips previous sessions without weight when finding best", () => {
    const h = [
      entry("bench", [
        session("03-14", 3, 10, 75),
        session("03-10", 3, 10),
        session("03-07", 3, 10, 70),
      ]),
    ];
    const result = detectPRs(h, names);
    expect(result).toHaveLength(1);
    expect(result[0].previousBestLbs).toBe(70);
  });

  it("returns no PR when all previous sessions lack weight", () => {
    const h = [
      entry("bench", [
        session("03-14", 3, 10, 75),
        session("03-10", 3, 10),
        session("03-07", 3, 10),
      ]),
    ];
    expect(detectPRs(h, names)).toHaveLength(0);
  });

  it("uses movementId as name when not in lookup map", () => {
    const h = [entry("unknown_move", [session("03-14", 3, 10, 80), session("03-10", 3, 10, 70)])];
    expect(detectPRs(h, names)[0].movementName).toBe("unknown_move");
  });
});

describe("detectRegressions", () => {
  it("detects regression when latest is >10% below recent average", () => {
    const h = [
      entry("row", [
        session("03-14", 3, 10, 58),
        session("03-10", 3, 10, 65),
        session("03-07", 3, 10, 66),
      ]),
    ];
    const result = detectRegressions(h, names);
    expect(result).toHaveLength(1);
    expect(result[0].movementId).toBe("row");
    expect(result[0].movementName).toBe("Barbell Row");
    expect(result[0].currentWeightLbs).toBe(58);
  });

  it("returns no regression at exactly 10% drop", () => {
    const h = [entry("bench", [session("03-14", 3, 10, 90), session("03-10", 3, 10, 100)])];
    expect(detectRegressions(h, names)).toHaveLength(0);
  });

  it("returns no regression when weight data is missing on latest", () => {
    const h = [entry("bench", [session("03-14", 3, 10), session("03-10", 3, 10, 100)])];
    expect(detectRegressions(h, names)).toHaveLength(0);
  });

  it("returns no regression when previous sessions lack weight", () => {
    const h = [
      entry("bench", [
        session("03-14", 3, 10, 50),
        session("03-10", 3, 10),
        session("03-07", 3, 10),
      ]),
    ];
    expect(detectRegressions(h, names)).toHaveLength(0);
  });

  it("uses custom threshold", () => {
    // recent avg = 100, latest = 94 -> drop = 6%
    const h = [entry("bench", [session("03-14", 3, 10, 94), session("03-10", 3, 10, 100)])];
    expect(detectRegressions(h, names, 5)).toHaveLength(1);
    expect(detectRegressions(h, names, 10)).toHaveLength(0);
  });

  it("averages up to 3 previous sessions for recent average", () => {
    const h = [
      entry("bench", [
        session("03-14", 3, 10, 50),
        session("03-10", 3, 10, 60),
        session("03-07", 3, 10, 62),
        session("03-04", 3, 10, 64),
        session("03-01", 3, 10, 100), // session[4] not included
      ]),
    ];
    const result = detectRegressions(h, names);
    // recent avg = (60+62+64)/3 = 62, drop = (62-50)/62 = 19.4%
    expect(result).toHaveLength(1);
    expect(result[0].recentAvgLbs).toBe(62);
  });
});

describe("detectPlateaus", () => {
  it("detects plateau at 3 sessions within 2 lbs", () => {
    const h = [
      entry("ohp", [
        session("03-14", 3, 8, 54),
        session("03-10", 3, 8, 53),
        session("03-07", 3, 8, 55),
      ]),
    ];
    const result = detectPlateaus(h, names);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      movementId: "ohp",
      movementName: "Overhead Press",
      flatSessionCount: 3,
    });
  });

  it("returns no plateau with fewer than 3 sessions", () => {
    const h = [entry("ohp", [session("03-14", 3, 8, 54), session("03-10", 3, 8, 54)])];
    expect(detectPlateaus(h, names)).toHaveLength(0);
  });

  it("returns no plateau when weights vary more than threshold", () => {
    const h = [
      entry("ohp", [
        session("03-14", 3, 8, 54),
        session("03-10", 3, 8, 60),
        session("03-07", 3, 8, 55),
      ]),
    ];
    expect(detectPlateaus(h, names)).toHaveLength(0);
  });

  it("uses custom threshold and session count", () => {
    const h = [
      entry("ohp", [
        session("03-14", 3, 8, 50),
        session("03-10", 3, 8, 55),
        session("03-07", 3, 8, 52),
        session("03-04", 3, 8, 53),
      ]),
    ];
    expect(detectPlateaus(h, names)).toHaveLength(0); // range 5 > default 2
    expect(detectPlateaus(h, names, 5, 4)).toHaveLength(1); // range 5 <= 5
  });

  it("ignores sessions without weight data", () => {
    const h = [
      entry("ohp", [
        session("03-14", 3, 8, 54),
        session("03-12", 3, 8),
        session("03-10", 3, 8, 53),
        session("03-07", 3, 8, 55),
      ]),
    ];
    expect(detectPlateaus(h, names)).toHaveLength(1);
  });
});

describe("generatePerformanceSummary", () => {
  it("correctly categorizes movements into PRs/plateaus/regressions/steady", () => {
    const h = [
      entry("bench", [
        session("03-14", 3, 10, 80),
        session("03-10", 3, 10, 75),
        session("03-07", 3, 10, 70),
      ]),
      entry("ohp", [
        session("03-14", 3, 8, 54),
        session("03-10", 3, 8, 53),
        session("03-07", 3, 8, 55),
      ]),
      entry("row", [
        session("03-14", 3, 10, 50),
        session("03-10", 3, 10, 65),
        session("03-07", 3, 10, 63),
      ]),
      entry("squat", [
        session("03-14", 3, 10, 98),
        session("03-10", 3, 10, 100),
        session("03-07", 3, 10, 95),
      ]),
    ];
    const s = generatePerformanceSummary(h, names);
    expect(s.prs).toHaveLength(1);
    expect(s.prs[0].movementId).toBe("bench");
    expect(s.plateaus).toHaveLength(1);
    expect(s.plateaus[0].movementId).toBe("ohp");
    expect(s.regressions).toHaveLength(1);
    expect(s.regressions[0].movementId).toBe("row");
    expect(s.steadyProgressionCount).toBe(1);
  });

  it("counts steady only for movements with >= 2 weighted sessions", () => {
    const h = [
      entry("bench", [session("03-14", 3, 10, 80)]),
      entry("ohp", [session("03-14", 3, 8), session("03-10", 3, 8)]),
      entry("squat", [session("03-14", 3, 10, 98), session("03-10", 3, 10, 100)]),
    ];
    expect(generatePerformanceSummary(h, names).steadyProgressionCount).toBe(1);
  });

  it("returns empty summary for empty history", () => {
    const s = generatePerformanceSummary([], names);
    expect(s.prs).toHaveLength(0);
    expect(s.plateaus).toHaveLength(0);
    expect(s.regressions).toHaveLength(0);
    expect(s.steadyProgressionCount).toBe(0);
  });
});

describe("formatPerformanceHighlights", () => {
  it("formats PRs with exercise name, weight, and percentage", () => {
    const s = summary({
      prs: [
        pr({
          movementId: "bench",
          movementName: "Bench Press",
          newWeightLbs: 73,
          previousBestLbs: 69,
          improvementPct: 5.8,
        }),
      ],
    });
    expect(formatPerformanceHighlights(s)).toBe("PRs: Bench Press 73 avg (up from 69, +5.8%)");
  });

  it("returns empty string when no highlights", () => {
    expect(formatPerformanceHighlights(summary({ steadyProgressionCount: 3 }))).toBe("");
  });

  it("includes all categories when present", () => {
    const s = summary({
      prs: [
        pr({
          movementId: "bench",
          movementName: "Bench Press",
          newWeightLbs: 73,
          previousBestLbs: 69,
          improvementPct: 5.8,
        }),
      ],
      plateaus: [{ movementId: "ohp", movementName: "OHP", weightLbs: 54, flatSessionCount: 4 }],
      regressions: [
        {
          movementId: "row",
          movementName: "Rows",
          currentWeightLbs: 58,
          recentAvgLbs: 65,
          dropPct: 10.8,
        },
      ],
    });
    const result = formatPerformanceHighlights(s);
    expect(result).toContain("PRs: Bench Press 73 avg (up from 69, +5.8%)");
    expect(result).toContain("Plateaus: OHP flat at 54 for 4 sessions");
    expect(result).toContain("Down: Rows at 58, recent avg was 65");
    expect(result.split("\n")).toHaveLength(3);
  });

  it("joins multiple entries within a category with semicolons", () => {
    const s = summary({
      prs: [
        pr({
          movementId: "bench",
          movementName: "Bench Press",
          newWeightLbs: 80,
          previousBestLbs: 75,
          improvementPct: 6.7,
        }),
        pr({
          movementId: "ohp",
          movementName: "OHP",
          newWeightLbs: 55,
          previousBestLbs: 50,
          improvementPct: 10,
        }),
      ],
    });
    const result = formatPerformanceHighlights(s);
    expect(result).toContain("; ");
    expect(result.split("\n")).toHaveLength(1);
  });
});
