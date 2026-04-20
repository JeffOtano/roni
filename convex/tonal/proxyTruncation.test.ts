import { describe, expect, it } from "vitest";
import { projectWorkoutMeta, toActivity } from "./proxy";
import {
  estimateCacheValueBytes,
  isCacheValueWithinLimit,
  isConvexSizeError,
  MAX_CACHE_VALUE_BYTES,
} from "./proxyCacheLimits";
import type { SetActivity, WorkoutActivityDetail } from "./types";
import { projectWorkoutDetail } from "./workoutDetailProjection";

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

describe("projectWorkoutDetail", () => {
  it("returns null for null and undefined", () => {
    expect(projectWorkoutDetail(null)).toBeNull();
    expect(projectWorkoutDetail(undefined)).toBeNull();
  });

  it("returns null for non-object payloads", () => {
    expect(projectWorkoutDetail("x")).toBeNull();
    expect(projectWorkoutDetail([1, 2, 3])).toBeNull();
  });

  it("passes through details under the cap", () => {
    const detail = makeDetail(100);
    const result = projectWorkoutDetail(detail);
    expect(result?.workoutSetActivity?.length).toBe(100);
  });

  it("truncates workoutSetActivity arrays above the cap", () => {
    const detail = makeDetail(9000);
    const result = projectWorkoutDetail(detail);
    expect(result?.workoutSetActivity?.length).toBe(4000);
  });

  it("drops undeclared array fields that exceed Convex's 8192 limit", () => {
    const detail: WorkoutActivityDetail & { heartRateSamples: number[] } = {
      ...makeDetail(10),
      heartRateSamples: Array.from({ length: 10_000 }, (_, i) => i),
    };
    const result = projectWorkoutDetail(detail) as unknown as Record<string, unknown>;

    expect(result).not.toHaveProperty("heartRateSamples");
    expect(result.workoutSetActivity).toHaveLength(10);
  });
});

describe("projectWorkoutMeta", () => {
  it("keeps only title and targetArea string fields", () => {
    const result = projectWorkoutMeta({
      title: "Push Day",
      targetArea: "Upper Body",
      description: "ignored",
      blocks: [{ id: "b1" }],
    });

    expect(result).toEqual({
      title: "Push Day",
      targetArea: "Upper Body",
    });
  });

  it("drops non-string metadata values", () => {
    const result = projectWorkoutMeta({
      title: 42,
      targetArea: ["Upper Body"],
    });

    expect(result).toEqual({
      title: undefined,
      targetArea: undefined,
    });
  });

  it("returns empty metadata for null and non-object payloads", () => {
    expect(projectWorkoutMeta(null)).toEqual({});
    expect(projectWorkoutMeta("Push Day")).toEqual({});
    expect(projectWorkoutMeta(["Push Day"])).toEqual({});
  });
});

describe("cache size helpers", () => {
  it("measures serializable values", () => {
    expect(estimateCacheValueBytes({ title: "Push Day" })).toBeGreaterThan(0);
  });

  it("treats unserializable values as oversized", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(estimateCacheValueBytes(circular)).toBe(Number.POSITIVE_INFINITY);
    expect(isCacheValueWithinLimit(circular)).toBe(false);
  });

  it("rejects payloads above the safe cache threshold", () => {
    const oversized = { data: "x".repeat(MAX_CACHE_VALUE_BYTES + 1) };

    expect(isCacheValueWithinLimit(oversized)).toBe(false);
  });
});

describe("toActivity", () => {
  it("fills default title and target area when metadata is missing", () => {
    const result = toActivity(makeDetail(1));

    expect(result.workoutPreview.workoutTitle).toBe("Tonal Workout");
    expect(result.workoutPreview.targetArea).toBe("Full Body");
  });

  it("uses projected metadata when available", () => {
    const result = toActivity(makeDetail(1), {
      title: "Leg Day",
      targetArea: "Lower Body",
    });

    expect(result.workoutPreview.workoutTitle).toBe("Leg Day");
    expect(result.workoutPreview.targetArea).toBe("Lower Body");
  });
});

describe("isConvexSizeError", () => {
  it.each([
    "Array length is too long (8988 > maximum length 8192)",
    "Value is too large (1.26 MiB > maximum size 1 MiB)",
    "Arguments for setCacheEntry are too large (17.96 MiB, limit: 16 MiB)",
  ])("detects Convex size error: %s", (msg) => {
    expect(isConvexSizeError(new Error(msg))).toBe(true);
  });

  it.each([
    "Not authenticated",
    "Request took too long",
    "Query took too long to complete",
    "too large a change to apply at once",
  ])("ignores unrelated message: %s", (msg) => {
    expect(isConvexSizeError(new Error(msg))).toBe(false);
  });

  it("reads size errors from plain string inputs", () => {
    expect(isConvexSizeError("Value is too large (1 MiB)")).toBe(true);
    expect(isConvexSizeError({})).toBe(false);
  });
});
