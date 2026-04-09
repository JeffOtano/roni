import { describe, expect, it } from "vitest";
import { selectCooldownExercises, selectWarmupExercises } from "./exerciseSelection";
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

describe("selectWarmupExercises", () => {
  it("returns movements tagged Warm-up or Mobility matching target muscles", () => {
    const catalog: Movement[] = [
      movement({
        id: "warmup1",
        name: "Chest Opener",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Warm-up"],
      }),
      movement({
        id: "mobility1",
        name: "Shoulder Mobility",
        muscleGroups: ["Shoulders"],
        skillLevel: 1,
        trainingTypes: ["Mobility"],
      }),
      movement({
        id: "strength1",
        name: "Bench Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
        trainingTypes: ["Strength"],
      }),
      movement({ id: "untagged", name: "Cable Fly", muscleGroups: ["Chest"], skillLevel: 1 }),
    ];

    const result = selectWarmupExercises({
      catalog,
      targetMuscleGroups: ["Chest", "Shoulders"],
      maxExercises: 3,
    });

    expect(result).toHaveLength(2);
    expect(result).toContain("warmup1");
    expect(result).toContain("mobility1");
    expect(result).not.toContain("strength1");
    expect(result).not.toContain("untagged");
  });

  it("falls back to Recovery and Yoga when primary tags have no matches", () => {
    const catalog: Movement[] = [
      movement({
        id: "recovery1",
        name: "Light Stretch",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Recovery"],
      }),
      movement({
        id: "yoga1",
        name: "Chest Yoga",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Yoga"],
      }),
    ];

    const result = selectWarmupExercises({
      catalog,
      targetMuscleGroups: ["Chest"],
      maxExercises: 3,
    });

    expect(result).toContain("recovery1");
    expect(result).toContain("yoga1");
  });

  it("returns empty array when no movements match any fallback type", () => {
    const catalog: Movement[] = [
      movement({
        id: "s1",
        name: "Bench Press",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Strength"],
      }),
    ];

    const result = selectWarmupExercises({
      catalog,
      targetMuscleGroups: ["Chest"],
      maxExercises: 3,
    });

    expect(result).toEqual([]);
  });

  it("respects excludeAccessories constraint", () => {
    const catalog: Movement[] = [
      movement({
        id: "warmup-bar",
        name: "Bar Mobility",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Warm-up"],
        onMachineInfo: {
          accessory: "Smart Bar",
          resistanceType: "",
          spotterDisabled: false,
          eccentricDisabled: false,
          chainsDisabled: false,
          burnoutDisabled: false,
        },
      }),
      movement({
        id: "warmup-none",
        name: "Chest Opener",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Warm-up"],
      }),
    ];

    const result = selectWarmupExercises({
      catalog,
      targetMuscleGroups: ["Chest"],
      maxExercises: 3,
      constraints: { excludeAccessories: ["Smart Bar"] },
    });

    expect(result).toEqual(["warmup-none"]);
  });

  it("does not filter by skill level", () => {
    const catalog: Movement[] = [
      movement({
        id: "advanced-warmup",
        name: "Advanced Mobility",
        muscleGroups: ["Chest"],
        skillLevel: 5,
        trainingTypes: ["Warm-up"],
      }),
    ];

    const result = selectWarmupExercises({
      catalog,
      targetMuscleGroups: ["Chest"],
      maxExercises: 3,
    });

    expect(result).toEqual(["advanced-warmup"]);
  });
});

describe("selectCooldownExercises", () => {
  it("returns movements tagged Recovery or Mobility matching target muscles", () => {
    const catalog: Movement[] = [
      movement({
        id: "recovery1",
        name: "Light Stretch",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Recovery"],
      }),
      movement({
        id: "mobility1",
        name: "Chest Mobility",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Mobility"],
      }),
      movement({
        id: "warmup1",
        name: "Chest Opener",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Warm-up"],
      }),
    ];

    const result = selectCooldownExercises({
      catalog,
      targetMuscleGroups: ["Chest"],
      maxExercises: 2,
    });

    expect(result).toContain("recovery1");
    expect(result).toContain("mobility1");
    expect(result).not.toContain("warmup1");
  });

  it("falls back to Yoga when primary tags have no matches", () => {
    const catalog: Movement[] = [
      movement({
        id: "yoga1",
        name: "Chest Yoga",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Yoga"],
      }),
    ];

    const result = selectCooldownExercises({
      catalog,
      targetMuscleGroups: ["Chest"],
      maxExercises: 2,
    });

    expect(result).toEqual(["yoga1"]);
  });

  it("returns empty when no matching movements exist", () => {
    const result = selectCooldownExercises({
      catalog: [],
      targetMuscleGroups: ["Chest"],
      maxExercises: 2,
    });
    expect(result).toEqual([]);
  });
});
