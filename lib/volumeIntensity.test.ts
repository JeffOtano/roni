import { describe, expect, it } from "vitest";
import {
  computeLastTimeAndSuggested,
  defaultReadiness,
  detectPlateau,
  formatLastTimeDisplay,
  getProgressiveOverloadSuggestions,
  getReadinessOnDay,
  getSuggestedWeightRange,
  getWeeklyVolumeTargets,
  type MovementSessionSnapshot,
  MUSCLE_GROUPS,
  type MuscleGroup,
  type OverloadSuggestion,
  type PerExerciseHistoryEntry,
  projectReadinessByDay,
} from "./volumeIntensity";

function historyEntry(overrides: Partial<PerExerciseHistoryEntry>): PerExerciseHistoryEntry {
  return {
    movementId: "mov-1",
    muscleGroups: ["Chest" as MuscleGroup],
    lastVolume: 2800,
    lastWeightAvg: 70,
    lastSets: 4,
    lastRepsPerSet: 10,
    lastSessionDate: "2026-03-09",
    ...overrides,
  };
}

describe("defaultReadiness", () => {
  it("returns 100 for every muscle group", () => {
    const r = defaultReadiness();
    for (const g of MUSCLE_GROUPS) {
      expect(r[g]).toBe(100);
    }
  });
});

describe("getProgressiveOverloadSuggestions", () => {
  it("returns add_weight suggestion when preferWeightOverRep is true and weight > 0", () => {
    const history = [historyEntry({ movementId: "bench", lastWeightAvg: 69 })];
    const out = getProgressiveOverloadSuggestions(history, { preferWeightOverRep: true });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("add_weight");
    expect(out[0].weightDeltaLbs).toBe(2.5);
    expect(out[0].label).toBe("+2.5 lbs");
  });

  it("returns add_rep suggestion when preferWeightOverRep is false and reps > 0", () => {
    const history = [historyEntry({ movementId: "bench", lastRepsPerSet: 10 })];
    const out = getProgressiveOverloadSuggestions(history, { preferWeightOverRep: false });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("add_rep");
    expect(out[0].repDelta).toBe(1);
    expect(out[0].label).toContain("+1 rep");
  });

  it("returns add_1_set when lastWeightAvg is 0 and lastRepsPerSet is 0", () => {
    const history = [
      historyEntry({ movementId: "new-mov", lastWeightAvg: 0, lastRepsPerSet: 0, lastVolume: 0 }),
    ];
    const out = getProgressiveOverloadSuggestions(history);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("add_1_set");
    expect(out[0].label).toBe("add 1 set");
  });

  it("respects maxWeightDeltaLbs cap", () => {
    const history = [historyEntry({ movementId: "bench", lastWeightAvg: 100 })];
    const out = getProgressiveOverloadSuggestions(history, { maxWeightDeltaLbs: 5 });
    expect(out[0].weightDeltaLbs).toBe(2.5);
    const out2 = getProgressiveOverloadSuggestions(history, { maxWeightDeltaLbs: 2 });
    expect(out2[0].weightDeltaLbs).toBe(2);
  });

  it("returns one suggestion per history entry", () => {
    const history = [historyEntry({ movementId: "a" }), historyEntry({ movementId: "b" })];
    const out = getProgressiveOverloadSuggestions(history);
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.movementId)).toEqual(["a", "b"]);
  });

  it("returns empty array for empty history", () => {
    const out = getProgressiveOverloadSuggestions([]);
    expect(out).toEqual([]);
  });
});

describe("getWeeklyVolumeTargets", () => {
  it("returns one target per muscle group", () => {
    const out = getWeeklyVolumeTargets("intermediate", 45);
    expect(out).toHaveLength(MUSCLE_GROUPS.length);
    expect(out.every((t) => MUSCLE_GROUPS.includes(t.muscleGroup))).toBe(true);
  });

  it("returns higher target sets for advanced than beginner", () => {
    const beginner = getWeeklyVolumeTargets("beginner", 60);
    const advanced = getWeeklyVolumeTargets("advanced", 60);
    expect(advanced[0].targetSetsPerWeek).toBeGreaterThanOrEqual(beginner[0].targetSetsPerWeek);
  });

  it("accepts preferredSplit without throwing", () => {
    const out = getWeeklyVolumeTargets("intermediate", 30, { preferredSplit: "upper_lower" });
    expect(out.length).toBe(MUSCLE_GROUPS.length);
  });
});

describe("projectReadinessByDay", () => {
  it("drops chest readiness on Monday when chest is trained Monday", () => {
    const schedule = { 0: ["Chest" as MuscleGroup] };
    const current = { Chest: 100 };
    const byDay = projectReadinessByDay(current, schedule);
    expect(byDay[0].Chest).toBe(30);
  });

  it("projects chest readiness Thursday when chest trained Monday (simple rule)", () => {
    const schedule = { 0: ["Chest" as MuscleGroup] };
    const current = { Chest: 100 };
    const byDay = projectReadinessByDay(current, schedule);
    const thursday = 3 as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    expect(byDay[thursday].Chest).toBe(100);
  });

  it("shows partial recovery on Tuesday when chest trained Monday", () => {
    const schedule = { 0: ["Chest" as MuscleGroup] };
    const current = { Chest: 100 };
    const byDay = projectReadinessByDay(current, schedule);
    const tuesday = 1 as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    expect(byDay[tuesday].Chest).toBeGreaterThan(30);
    expect(byDay[tuesday].Chest).toBeLessThan(100);
  });

  it("leaves untrained muscles at base readiness on day 0", () => {
    const schedule = { 0: ["Chest" as MuscleGroup] };
    const current = { Back: 80, Chest: 100 };
    const byDay = projectReadinessByDay(current, schedule);
    expect(byDay[0].Back).toBe(80);
    expect(byDay[0].Chest).toBe(30);
  });
});

describe("getReadinessOnDay", () => {
  it("returns readiness for requested day only", () => {
    const schedule = { 0: ["Chest" as MuscleGroup] };
    const current = { Chest: 100 };
    const thursday = 3 as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const out = getReadinessOnDay(current, schedule, thursday);
    expect(out.Chest).toBe(100);
  });
});

describe("formatLastTimeDisplay", () => {
  it("includes weight when lastWeightAvg > 0", () => {
    const entry = historyEntry({ lastSets: 4, lastRepsPerSet: 10, lastWeightAvg: 69 });
    expect(formatLastTimeDisplay(entry)).toBe("4×10 @ 69 avg");
  });

  it("omits weight when lastWeightAvg is 0", () => {
    const entry = historyEntry({ lastSets: 3, lastRepsPerSet: 8, lastWeightAvg: 0 });
    expect(formatLastTimeDisplay(entry)).toBe("3×8");
  });
});

describe("getSuggestedWeightRange", () => {
  it("returns range for add_weight suggestion", () => {
    const suggestion: OverloadSuggestion = {
      movementId: "bench",
      kind: "add_weight",
      weightDeltaLbs: 2.5,
      label: "+2.5 lbs",
    };
    const range = getSuggestedWeightRange(suggestion, 69);
    expect(range).toEqual({ low: 71, high: 74 });
  });

  it("returns null for add_rep suggestion", () => {
    const suggestion: OverloadSuggestion = {
      movementId: "bench",
      kind: "add_rep",
      repDelta: 1,
      label: "+1 rep",
    };
    expect(getSuggestedWeightRange(suggestion, 69)).toBeNull();
  });
});

describe("detectPlateau", () => {
  it("returns true when same weight 3+ sessions within threshold", () => {
    const sessions: MovementSessionSnapshot[] = [
      { sessionDate: "2026-03-10", sets: 4, totalReps: 40, repsPerSet: 10, avgWeightLbs: 70 },
      { sessionDate: "2026-03-07", sets: 4, totalReps: 40, repsPerSet: 10, avgWeightLbs: 69 },
      { sessionDate: "2026-03-03", sets: 4, totalReps: 40, repsPerSet: 10, avgWeightLbs: 71 },
    ];
    expect(detectPlateau(sessions)).toBe(true);
  });

  it("returns false when fewer than 3 sessions", () => {
    const sessions: MovementSessionSnapshot[] = [
      { sessionDate: "2026-03-10", sets: 4, totalReps: 40, repsPerSet: 10, avgWeightLbs: 70 },
      { sessionDate: "2026-03-07", sets: 4, totalReps: 40, repsPerSet: 10, avgWeightLbs: 70 },
    ];
    expect(detectPlateau(sessions)).toBe(false);
  });

  it("returns false when weight varies beyond threshold", () => {
    const sessions: MovementSessionSnapshot[] = [
      { sessionDate: "2026-03-10", sets: 4, totalReps: 40, repsPerSet: 10, avgWeightLbs: 80 },
      { sessionDate: "2026-03-07", sets: 4, totalReps: 40, repsPerSet: 10, avgWeightLbs: 70 },
      { sessionDate: "2026-03-03", sets: 4, totalReps: 40, repsPerSet: 10, avgWeightLbs: 75 },
    ];
    expect(detectPlateau(sessions)).toBe(false);
  });
});

describe("computeLastTimeAndSuggested", () => {
  it("returns last time and suggested text per movement", () => {
    const sessions: MovementSessionSnapshot[] = [
      { sessionDate: "2026-03-10", sets: 4, totalReps: 40, repsPerSet: 10, avgWeightLbs: 69 },
    ];
    const map = new Map<string, MovementSessionSnapshot[]>([["mov-1", sessions]]);
    const out = computeLastTimeAndSuggested(map);
    expect(out).toHaveLength(1);
    expect(out[0].movementId).toBe("mov-1");
    expect(out[0].lastTimeText).toContain("4×10");
    expect(out[0].lastTimeText).toContain("69");
    expect(out[0].suggestedText).toMatch(/\d+–\d+ lbs/);
  });

  it("filters by movementIds when provided", () => {
    const sessions: MovementSessionSnapshot[] = [
      { sessionDate: "2026-03-10", sets: 3, totalReps: 24, repsPerSet: 8, avgWeightLbs: 50 },
    ];
    const map = new Map<string, MovementSessionSnapshot[]>([
      ["mov-a", sessions],
      ["mov-b", sessions],
    ]);
    const out = computeLastTimeAndSuggested(map, ["mov-a"]);
    expect(out).toHaveLength(1);
    expect(out[0].movementId).toBe("mov-a");
  });
});
