import { describe, expect, it } from "vitest";
import { selectExercises } from "./exerciseSelection";
import type { Movement } from "../tonal/types";

const movementDefaults: Omit<
  Movement,
  "id" | "name" | "shortName" | "muscleGroups" | "skillLevel"
> = {
  inFreeLift: false,
  onMachine: true,
  countReps: true,
  isTwoSided: false,
  isBilateral: true,
  isAlternating: false,
  descriptionHow: "",
  descriptionWhy: "",
  thumbnailMediaUrl: "",
  publishState: "published",
  sortOrder: 0,
};

function movement(
  overrides: Partial<Movement> & Pick<Movement, "id" | "name" | "muscleGroups" | "skillLevel">,
): Movement {
  return {
    ...movementDefaults,
    shortName: overrides.shortName ?? overrides.name,
    ...overrides,
  };
}

const CHEST_TRICEPS = ["Chest", "Triceps"];

describe("selectExercises target and repeat", () => {
  it("returns only exercises for target muscles", () => {
    const catalog: Movement[] = [
      movement({
        id: "m1",
        name: "Bench Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
      }),
      movement({ id: "m2", name: "Bicep Curl", muscleGroups: ["Biceps"], skillLevel: 1 }),
      movement({ id: "m3", name: "Tricep Pushdown", muscleGroups: ["Triceps"], skillLevel: 1 }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
    });

    expect(result).toEqual(["m1", "m3"]);
    expect(result).not.toContain("m2");
  });

  it("does not repeat last session's exercises for same group", () => {
    const catalog: Movement[] = [
      movement({
        id: "m1",
        name: "Bench Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
      }),
      movement({
        id: "m2",
        name: "Incline Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
      }),
      movement({ id: "m3", name: "Tricep Pushdown", muscleGroups: ["Triceps"], skillLevel: 1 }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: ["m1", "m3"],
    });

    expect(result).toEqual(["m2"]);
    expect(result).not.toContain("m1");
    expect(result).not.toContain("m3");
  });
});

describe("selectExercises duration and order", () => {
  it("respects duration (exercise count)", () => {
    const catalog: Movement[] = [
      movement({ id: "m1", name: "Bench", muscleGroups: ["Chest", "Triceps"], skillLevel: 1 }),
      movement({ id: "m2", name: "Incline", muscleGroups: ["Chest", "Triceps"], skillLevel: 1 }),
      movement({ id: "m3", name: "Fly", muscleGroups: ["Chest"], skillLevel: 1 }),
      movement({ id: "m4", name: "Pushdown", muscleGroups: ["Triceps"], skillLevel: 1 }),
      movement({ id: "m5", name: "Extension", muscleGroups: ["Triceps"], skillLevel: 1 }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 3,
      lastUsedMovementIds: [],
    });

    expect(result).toHaveLength(3);
    expect(result).toEqual(["m1", "m2", "m3"]);
  });

  it("orders compound first then isolation", () => {
    const catalog: Movement[] = [
      movement({ id: "iso1", name: "Fly", muscleGroups: ["Chest"], skillLevel: 1 }),
      movement({
        id: "compound1",
        name: "Bench",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
      }),
      movement({ id: "iso2", name: "Pushdown", muscleGroups: ["Triceps"], skillLevel: 1 }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
    });

    expect(result).toEqual(["compound1", "iso1", "iso2"]);
  });
});

describe("selectExercises difficulty and exclude", () => {
  it("respects difficulty (excludes movements too far above user level)", () => {
    const catalog: Movement[] = [
      movement({ id: "m1", name: "Bench", muscleGroups: ["Chest", "Triceps"], skillLevel: 1 }),
      movement({
        id: "m2",
        name: "Advanced Bench",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 3,
      }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
    });

    expect(result).toEqual(["m1"]);
    expect(result).not.toContain("m2");
  });

  it("applies excludeNameSubstrings constraint (e.g. no overhead pressing)", () => {
    const catalog: Movement[] = [
      movement({
        id: "m1",
        name: "Bench Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
      }),
      movement({
        id: "m2",
        name: "Overhead Press",
        muscleGroups: ["Shoulders", "Triceps"],
        skillLevel: 1,
      }),
      movement({
        id: "m3",
        name: "Incline Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
      }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: ["Chest", "Triceps", "Shoulders"],
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      constraints: { excludeNameSubstrings: ["Overhead"] },
    });

    expect(result).not.toContain("m2");
    expect(result).toContain("m1");
    expect(result).toContain("m3");
  });
});

describe("selectExercises empty and case-insensitive", () => {
  it("returns empty when all candidates are excluded or catalog empty", () => {
    const catalog: Movement[] = [
      movement({ id: "m1", name: "Bench", muscleGroups: ["Chest", "Triceps"], skillLevel: 1 }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: ["m1"],
    });

    expect(result).toEqual([]);
  });

  it("matches target muscle groups case-insensitively", () => {
    const catalog: Movement[] = [
      movement({ id: "m1", name: "Bench", muscleGroups: ["chest", "triceps"], skillLevel: 1 }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: ["Chest", "Triceps"],
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
    });

    expect(result).toEqual(["m1"]);
  });
});

describe("selectExercises rotation (recentWeeksMovementIds)", () => {
  it("deprioritises exercises in recentWeeksMovementIds but does not exclude them", () => {
    const catalog: Movement[] = [
      movement({ id: "m1", name: "Bench", muscleGroups: ["Chest", "Triceps"], skillLevel: 1 }),
      movement({ id: "m2", name: "Incline", muscleGroups: ["Chest", "Triceps"], skillLevel: 1 }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      recentWeeksMovementIds: ["m1"],
    });

    expect(result).toContain("m1");
    expect(result).toContain("m2");
    expect(result.indexOf("m2")).toBeLessThan(result.indexOf("m1"));
  });

  it("includes all recentWeeksMovementIds in the result (not excluded)", () => {
    const catalog: Movement[] = [
      movement({ id: "r1", name: "Fly", muscleGroups: ["Chest"], skillLevel: 1 }),
      movement({ id: "r2", name: "Pushdown", muscleGroups: ["Triceps"], skillLevel: 1 }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      recentWeeksMovementIds: ["r1", "r2"],
    });

    expect(result).toContain("r1");
    expect(result).toContain("r2");
  });

  it("selection is unchanged when recentWeeksMovementIds is omitted", () => {
    const catalog: Movement[] = [
      movement({ id: "m1", name: "Bench", muscleGroups: ["Chest", "Triceps"], skillLevel: 1 }),
      movement({ id: "m2", name: "Incline", muscleGroups: ["Chest", "Triceps"], skillLevel: 1 }),
    ];

    const withoutRecent = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
    });

    const withEmptyRecent = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      recentWeeksMovementIds: [],
    });

    expect(withoutRecent).toEqual(withEmptyRecent);
  });

  it("rotation penalty sorts within groups", () => {
    const catalog: Movement[] = [
      movement({
        id: "recent-compound",
        name: "Bench Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
      }),
      movement({
        id: "fresh-compound",
        name: "Incline Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
      }),
      movement({
        id: "fresh-iso",
        name: "Cable Fly",
        muscleGroups: ["Chest"],
        skillLevel: 1,
      }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      recentWeeksMovementIds: ["recent-compound"],
    });

    expect(result.indexOf("fresh-compound")).toBeLessThan(result.indexOf("recent-compound"));
    expect(result.indexOf("recent-compound")).toBeLessThan(result.indexOf("fresh-iso"));
  });

  it("does not confuse recentWeeksMovementIds with lastUsedMovementIds", () => {
    const catalog: Movement[] = [
      movement({ id: "m1", name: "Bench", muscleGroups: ["Chest", "Triceps"], skillLevel: 1 }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      recentWeeksMovementIds: ["m1"],
    });

    expect(result).toContain("m1");
  });

  it("excludes exercises in lastUsedMovementIds even if also in recentWeeksMovementIds", () => {
    const catalog: Movement[] = [
      movement({ id: "m1", name: "Bench", muscleGroups: ["Chest", "Triceps"], skillLevel: 1 }),
      movement({ id: "m2", name: "Incline", muscleGroups: ["Chest", "Triceps"], skillLevel: 1 }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: ["m1"],
      recentWeeksMovementIds: ["m1"],
    });

    expect(result).not.toContain("m1");
    expect(result).toContain("m2");
  });
});
