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

describe("selectExercises exact movement exclusions", () => {
  it("applies excludeMovementIds without excluding similarly named movements", () => {
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
      movement({
        id: "m3",
        name: "Tricep Pushdown",
        muscleGroups: ["Triceps"],
        skillLevel: 1,
      }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: ["Chest", "Triceps"],
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      constraints: { excludeMovementIds: ["m2"] },
    });

    expect(result).toContain("m1");
    expect(result).not.toContain("m2");
    expect(result).toContain("m3");
  });

  it("returns an empty array when all catalog movements are excluded", () => {
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
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: ["Chest", "Triceps"],
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      constraints: { excludeMovementIds: ["m1", "m2"] },
    });

    expect(result).toEqual([]);
  });

  it("ignores excluded movement IDs that are not in the catalog", () => {
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
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: ["Chest", "Triceps"],
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      constraints: { excludeMovementIds: ["missing"] },
    });

    expect(result).toEqual(["m1", "m2"]);
  });
});
