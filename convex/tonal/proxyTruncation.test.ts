import { describe, expect, it } from "vitest";
import { isConvexSizeError, truncateWorkoutDetail } from "./proxy";
import type { SetActivity, WorkoutActivityDetail } from "./types";

function makeSet(id: string): SetActivity {
  return {
    id,
    movementId: "m",
    prescribedReps: 1,
    repetition: 1,
    repetitionTotal: 1,
    blockNumber: 1,
    spotter: false,
    eccentric: false,
    chains: false,
    flex: false,
    warmUp: false,
    beginTime: "2026-04-17T00:00:00Z",
    sideNumber: 0,
  };
}

function makeDetail(setCount: number): WorkoutActivityDetail {
  return {
    id: "a",
    userId: "u",
    workoutId: "w",
    workoutType: "guided",
    timezone: "UTC",
    beginTime: "2026-04-17T00:00:00Z",
    endTime: "2026-04-17T01:00:00Z",
    totalDuration: 3600,
    activeDuration: 3000,
    restDuration: 600,
    totalMovements: 10,
    totalSets: setCount,
    totalReps: setCount,
    totalVolume: 0,
    totalConcentricWork: 0,
    percentCompleted: 100,
    workoutSetActivity: Array.from({ length: setCount }, (_, i) => makeSet(String(i))),
  };
}

describe("truncateWorkoutDetail", () => {
  it("returns null unchanged", () => {
    expect(truncateWorkoutDetail(null)).toBeNull();
  });

  it("passes through details under the cap", () => {
    const detail = makeDetail(100);
    const result = truncateWorkoutDetail(detail);
    expect(result?.workoutSetActivity?.length).toBe(100);
  });

  it("truncates workoutSetActivity arrays above the cap", () => {
    const detail = makeDetail(9000);
    const result = truncateWorkoutDetail(detail);
    expect(result?.workoutSetActivity?.length).toBe(4000);
  });

  it("truncates arbitrary oversized top-level array fields from upstream payloads", () => {
    const detail = {
      ...makeDetail(10),
      extraTimeline: Array.from({ length: 9000 }, (_, i) => i),
    } as WorkoutActivityDetail & { extraTimeline: number[] };

    const result = truncateWorkoutDetail(detail) as unknown as {
      extraTimeline: number[];
      workoutSetActivity: SetActivity[];
    };
    expect(result.extraTimeline.length).toBe(4000);
    expect(result.workoutSetActivity.length).toBe(10);
  });
});

describe("isConvexSizeError", () => {
  it.each([
    "Array length is too long (8988 > maximum length 8192)",
    "Value is too large (1.26 MiB > maximum size 1 MiB)",
    "Arguments for setCacheEntry are too large (17.96 MiB, limit: 16 MiB)",
  ])("detects %s", (msg) => {
    expect(isConvexSizeError(new Error(msg))).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isConvexSizeError(new Error("Not authenticated"))).toBe(false);
  });

  it("tolerates non-Error values", () => {
    expect(isConvexSizeError("too large: plain string")).toBe(true);
    expect(isConvexSizeError({})).toBe(false);
  });
});
