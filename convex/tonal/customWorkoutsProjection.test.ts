import { describe, expect, it } from "vitest";
import { projectCustomWorkouts, projectCustomWorkoutsStrict } from "./customWorkoutsProjection";
import { estimateCacheValueBytes } from "./proxyCacheLimits";

const VALID_WORKOUT = {
  id: "uw-1",
  createdAt: "2026-04-01T00:00:00Z",
  title: "Upper Body Strength",
  shortDescription: "Push focus",
  description: "Custom workout",
  duration: 1800,
  level: "Intermediate",
  targetArea: "Upper Body",
  tags: ["strength"],
  bodyRegions: ["upper"],
  type: "custom",
  userId: "u-1",
  style: "strength",
  trainingType: "Strength",
  movementIds: ["m-1", "m-2"],
  accessories: ["SmartHandles"],
  playbackType: "guided",
  isImported: false,
};

describe("projectCustomWorkouts", () => {
  it("returns an empty array for non-array payloads", () => {
    expect(projectCustomWorkouts(null)).toEqual([]);
    expect(projectCustomWorkouts({ data: [] })).toEqual([]);
  });

  it("retains every declared UserWorkout field", () => {
    const result = projectCustomWorkouts([VALID_WORKOUT]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(VALID_WORKOUT);
  });

  it("drops undeclared fields that bloat each cached entry", () => {
    const raw = [
      {
        ...VALID_WORKOUT,
        sets: Array.from({ length: 200 }, (_, i) => ({
          movementId: "m-1",
          repCount: i,
          weightPercentage: 0.5,
        })),
        blocks: Array.from({ length: 12 }, (_, i) => ({ name: `Block ${i}` })),
        rawCoachNotes: "x".repeat(2000),
      },
    ];

    const result = projectCustomWorkouts(raw) as unknown as Record<string, unknown>[];

    expect(result[0]).not.toHaveProperty("sets");
    expect(result[0]).not.toHaveProperty("blocks");
    expect(result[0]).not.toHaveProperty("rawCoachNotes");
  });

  it("rejects payloads missing required fields", () => {
    const malformed = [{ ...VALID_WORKOUT, title: undefined }];
    expect(projectCustomWorkouts(malformed)).toEqual([]);
  });

  it("produces a smaller cache footprint than the raw response", () => {
    const raw = Array.from({ length: 30 }, (_, i) => ({
      ...VALID_WORKOUT,
      id: `uw-${i}`,
      sets: Array.from({ length: 50 }, (_, ri) => ({
        movementId: "m-1",
        repCount: ri,
        weightPercentage: 0.5,
      })),
    }));

    const projected = projectCustomWorkouts(raw);

    expect(estimateCacheValueBytes(projected)).toBeLessThan(estimateCacheValueBytes(raw));
  });
});

describe("projectCustomWorkoutsStrict", () => {
  it("projects valid input the same as the lenient variant", () => {
    const result = projectCustomWorkoutsStrict([VALID_WORKOUT]);
    expect(result).toEqual([VALID_WORKOUT]);
  });

  it("throws on non-array input so cachedFetch falls back to stale data", () => {
    expect(() => projectCustomWorkoutsStrict(null)).toThrow(/expected array/);
    expect(() => projectCustomWorkoutsStrict({ data: [] })).toThrow(/expected array/);
  });

  it("throws on schema mismatch instead of returning an empty array", () => {
    const malformed = [{ ...VALID_WORKOUT, title: undefined }];
    expect(() => projectCustomWorkoutsStrict(malformed)).toThrow();
  });
});
