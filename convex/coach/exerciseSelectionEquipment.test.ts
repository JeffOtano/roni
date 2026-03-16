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

function machineInfo(accessory: string) {
  return {
    accessory,
    resistanceType: "cable",
    spotterDisabled: false,
    eccentricDisabled: false,
    chainsDisabled: false,
    burnoutDisabled: false,
  };
}

const CHEST_TRICEPS = ["Chest", "Triceps"];

describe("selectExercises equipment filtering (excludeAccessories)", () => {
  it("excludes movements requiring excluded accessories", () => {
    const catalog: Movement[] = [
      movement({
        id: "m1",
        name: "Bench Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
        onMachineInfo: machineInfo("Smart Bar"),
      }),
      movement({
        id: "m2",
        name: "Cable Fly",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        onMachineInfo: machineInfo("Smart Handles"),
      }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      constraints: { excludeAccessories: ["Smart Bar"] },
    });

    expect(result).not.toContain("m1");
    expect(result).toContain("m2");
  });

  it("does not exclude movements with no accessory data", () => {
    const catalog: Movement[] = [
      movement({
        id: "m1",
        name: "Bench Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
      }),
      movement({
        id: "m2",
        name: "Cable Fly",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        onMachineInfo: machineInfo("Smart Handles"),
      }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      constraints: { excludeAccessories: ["Smart Handles"] },
    });

    expect(result).toContain("m1");
    expect(result).not.toContain("m2");
  });

  it("empty excludeAccessories list does not filter anything", () => {
    const catalog: Movement[] = [
      movement({
        id: "m1",
        name: "Bench Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
        onMachineInfo: machineInfo("Smart Bar"),
      }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: CHEST_TRICEPS,
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      constraints: { excludeAccessories: [] },
    });

    expect(result).toContain("m1");
  });

  it("equipment filtering works alongside name substring exclusion", () => {
    const catalog: Movement[] = [
      movement({
        id: "m1",
        name: "Overhead Press",
        muscleGroups: ["Shoulders", "Triceps"],
        skillLevel: 1,
        onMachineInfo: machineInfo("Smart Handles"),
      }),
      movement({
        id: "m2",
        name: "Cable Fly",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        onMachineInfo: machineInfo("Rope"),
      }),
      movement({
        id: "m3",
        name: "Bench Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
        onMachineInfo: machineInfo("Smart Handles"),
      }),
    ];

    const result = selectExercises({
      catalog,
      targetMuscleGroups: ["Chest", "Triceps", "Shoulders"],
      userLevel: 1,
      maxExercises: 10,
      lastUsedMovementIds: [],
      constraints: {
        excludeNameSubstrings: ["Overhead"],
        excludeAccessories: ["Rope"],
      },
    });

    expect(result).not.toContain("m1");
    expect(result).not.toContain("m2");
    expect(result).toContain("m3");
  });
});
