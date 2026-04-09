import { describe, expect, it } from "vitest";
import { aggregateDetailToSessions } from "./progressiveOverload";
import type { WorkoutActivityDetail } from "./tonal/types";

function makeDetail(overrides: Partial<WorkoutActivityDetail> = {}): WorkoutActivityDetail {
  return {
    id: "d1",
    userId: "u1",
    workoutId: "w1",
    workoutType: "custom",
    timezone: "America/New_York",
    beginTime: "2026-03-10T10:00:00Z",
    endTime: "2026-03-10T10:45:00Z",
    totalDuration: 2700,
    activeDuration: 2400,
    restDuration: 300,
    totalMovements: 2,
    totalSets: 4,
    totalReps: 40,
    totalVolume: 5000,
    totalConcentricWork: 3000,
    percentCompleted: 100,
    ...overrides,
  };
}

describe("aggregateDetailToSessions", () => {
  it("groups sets by movementId and computes reps/set counts", () => {
    const detail = makeDetail({
      workoutSetActivity: [
        {
          id: "s1",
          movementId: "m1",
          prescribedReps: 10,
          repetition: 10,
          repetitionTotal: 3,
          blockNumber: 1,
          spotter: false,
          eccentric: false,
          chains: false,
          flex: false,
          warmUp: false,
          beginTime: "2026-03-10T10:00:00Z",
          sideNumber: 0,
        },
        {
          id: "s2",
          movementId: "m1",
          prescribedReps: 10,
          repetition: 10,
          repetitionTotal: 3,
          blockNumber: 1,
          spotter: false,
          eccentric: false,
          chains: false,
          flex: false,
          warmUp: false,
          beginTime: "2026-03-10T10:02:00Z",
          sideNumber: 0,
        },
        {
          id: "s3",
          movementId: "m2",
          prescribedReps: 8,
          repetition: 8,
          repetitionTotal: 2,
          blockNumber: 2,
          spotter: false,
          eccentric: false,
          chains: false,
          flex: false,
          warmUp: false,
          beginTime: "2026-03-10T10:05:00Z",
          sideNumber: 0,
        },
      ],
    });

    const result = aggregateDetailToSessions(detail);

    expect(result.size).toBe(2);

    const m1 = result.get("m1");
    expect(m1).toBeDefined();
    expect(m1!.sets).toBe(2);
    expect(m1!.totalReps).toBe(20);
    expect(m1!.repsPerSet).toBe(10);
    expect(m1!.sessionDate).toBe("2026-03-10");

    const m2 = result.get("m2");
    expect(m2).toBeDefined();
    expect(m2!.sets).toBe(1);
    expect(m2!.totalReps).toBe(8);
  });

  it("returns empty map when workoutSetActivity is undefined", () => {
    const detail = makeDetail({ workoutSetActivity: undefined });

    const result = aggregateDetailToSessions(detail);

    expect(result.size).toBe(0);
  });

  it("returns empty map when workoutSetActivity is an empty array", () => {
    const detail = makeDetail({ workoutSetActivity: [] });

    const result = aggregateDetailToSessions(detail);

    expect(result.size).toBe(0);
  });

  it("computes avgWeightLbs when volumeByMovement is provided", () => {
    const detail = makeDetail({
      workoutSetActivity: [
        {
          id: "s1",
          movementId: "m1",
          prescribedReps: 10,
          repetition: 10,
          repetitionTotal: 2,
          blockNumber: 1,
          spotter: false,
          eccentric: false,
          chains: false,
          flex: false,
          warmUp: false,
          beginTime: "2026-03-10T10:00:00Z",
          sideNumber: 0,
        },
        {
          id: "s2",
          movementId: "m1",
          prescribedReps: 10,
          repetition: 10,
          repetitionTotal: 2,
          blockNumber: 1,
          spotter: false,
          eccentric: false,
          chains: false,
          flex: false,
          warmUp: false,
          beginTime: "2026-03-10T10:02:00Z",
          sideNumber: 0,
        },
      ],
    });
    const volumeByMovement = new Map([["m1", 2000]]);

    const result = aggregateDetailToSessions(detail, volumeByMovement);

    const m1 = result.get("m1");
    expect(m1!.avgWeightLbs).toBe(100); // 2000 / 20 = 100
  });

  it("omits avgWeightLbs when volume data is not provided", () => {
    const detail = makeDetail({
      workoutSetActivity: [
        {
          id: "s1",
          movementId: "m1",
          prescribedReps: 10,
          repetition: 10,
          repetitionTotal: 1,
          blockNumber: 1,
          spotter: false,
          eccentric: false,
          chains: false,
          flex: false,
          warmUp: false,
          beginTime: "2026-03-10T10:00:00Z",
          sideNumber: 0,
        },
      ],
    });

    const result = aggregateDetailToSessions(detail);

    const m1 = result.get("m1");
    expect(m1!.avgWeightLbs).toBeUndefined();
  });
});
