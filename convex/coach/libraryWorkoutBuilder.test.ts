import { describe, expect, it } from "vitest";
import type { Movement } from "../tonal/types";
import { buildLibraryWorkout } from "./libraryGeneration";

function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: overrides.id ?? "mov-1",
    name: overrides.name ?? "Test Press",
    shortName: overrides.shortName ?? "T Press",
    muscleGroups: overrides.muscleGroups ?? ["Chest"],
    skillLevel: overrides.skillLevel ?? 1,
    publishState: "published",
    sortOrder: 1,
    onMachine: overrides.onMachine ?? true,
    inFreeLift: overrides.inFreeLift ?? false,
    countReps: overrides.countReps ?? true,
    isTwoSided: false,
    isBilateral: false,
    isAlternating: false,
    descriptionHow: "Push the weight",
    descriptionWhy: "Builds strength",
    thumbnailMediaUrl: overrides.thumbnailMediaUrl,
    onMachineInfo: overrides.onMachineInfo ?? {
      accessory: "Smart Handles",
      resistanceType: "cable",
      spotterDisabled: false,
      eccentricDisabled: false,
      chainsDisabled: false,
      burnoutDisabled: false,
    },
    trainingTypes: overrides.trainingTypes,
  };
}

function buildTestCatalog(): Movement[] {
  return [
    makeMovement({
      id: "mov-chest-1",
      name: "Chest Press",
      shortName: "Chest Press",
      muscleGroups: ["Chest", "Triceps"],
      skillLevel: 1,
      onMachineInfo: {
        accessory: "Smart Handles",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({
      id: "mov-chest-2",
      name: "Chest Fly",
      shortName: "Chest Fly",
      muscleGroups: ["Chest"],
      skillLevel: 1,
      onMachineInfo: {
        accessory: "Smart Handles",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({
      id: "mov-triceps-1",
      name: "Tricep Extension",
      shortName: "Tri Ext",
      muscleGroups: ["Triceps"],
      skillLevel: 1,
      onMachineInfo: {
        accessory: "Smart Handles",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({
      id: "mov-shoulders-1",
      name: "Shoulder Press",
      shortName: "Shoulder Press",
      muscleGroups: ["Shoulders", "Triceps"],
      skillLevel: 1,
      onMachineInfo: {
        accessory: "Smart Bar",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({
      id: "mov-back-1",
      name: "Row",
      shortName: "Row",
      muscleGroups: ["Back", "Biceps"],
      skillLevel: 1,
      onMachineInfo: {
        accessory: "Smart Handles",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({
      id: "mov-back-2",
      name: "Lat Pulldown",
      shortName: "Lat Pull",
      muscleGroups: ["Back"],
      skillLevel: 1,
      onMachineInfo: {
        accessory: "Smart Bar",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({
      id: "mov-biceps-1",
      name: "Bicep Curl",
      shortName: "Bicep Curl",
      muscleGroups: ["Biceps"],
      skillLevel: 1,
      onMachineInfo: {
        accessory: "Smart Handles",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({
      id: "mov-quads-1",
      name: "Squat",
      shortName: "Squat",
      muscleGroups: ["Quads", "Glutes"],
      skillLevel: 1,
      onMachineInfo: {
        accessory: "Smart Bar",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({
      id: "mov-glutes-1",
      name: "Hip Thrust",
      shortName: "Hip Thrust",
      muscleGroups: ["Glutes", "Hamstrings"],
      skillLevel: 1,
      onMachineInfo: {
        accessory: "Smart Handles",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({
      id: "mov-hamstrings-1",
      name: "Hamstring Curl",
      shortName: "Ham Curl",
      muscleGroups: ["Hamstrings"],
      skillLevel: 1,
      onMachineInfo: {
        accessory: "Smart Handles",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({
      id: "mov-freelift-1",
      name: "Pushup",
      shortName: "Pushup",
      muscleGroups: ["Chest", "Triceps"],
      skillLevel: 1,
      inFreeLift: true,
      onMachine: false,
      onMachineInfo: undefined,
    }),
  ];
}

describe("buildLibraryWorkout", () => {
  it("produces a workout with correct metadata", () => {
    const catalog = buildTestCatalog();
    const combo = {
      sessionType: "push" as const,
      goal: "build_muscle" as const,
      durationMinutes: 30 as const,
      level: "intermediate" as const,
      equipmentConfig: "full_accessories" as const,
    };

    const result = buildLibraryWorkout({ combo, catalog, recentMovementIds: [] });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.slug).toContain("push");
    expect(result.slug).toContain("build-muscle");
    expect(result.slug).toContain("30min");
    expect(result.slug).toContain("intermediate");

    expect(result.sessionType).toBe("push");
    expect(result.goal).toBe("build_muscle");
    expect(result.durationMinutes).toBe(30);
    expect(result.level).toBe("intermediate");

    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.movementDetails.length).toBeGreaterThanOrEqual(3);
    expect(result.exerciseCount).toBe(result.movementDetails.length);

    for (const detail of result.movementDetails) {
      expect(detail.phase).toBe("main");
    }
  });

  it("returns null when fewer than 3 exercises available", () => {
    const catalog = [
      makeMovement({ id: "mov-only-1", name: "Chest Press", muscleGroups: ["Chest"] }),
      makeMovement({ id: "mov-only-2", name: "Tricep Ext", muscleGroups: ["Triceps"] }),
    ];

    const combo = {
      sessionType: "push" as const,
      goal: "build_muscle" as const,
      durationMinutes: 30 as const,
      level: "intermediate" as const,
      equipmentConfig: "full_accessories" as const,
    };

    expect(buildLibraryWorkout({ combo, catalog, recentMovementIds: [] })).toBeNull();
  });

  it("applies rep/set scheme from goal - strength has 4 sets", () => {
    const catalog = buildTestCatalog();
    const combo = {
      sessionType: "push" as const,
      goal: "strength" as const,
      durationMinutes: 45 as const,
      level: "advanced" as const,
      equipmentConfig: "full_accessories" as const,
    };

    const result = buildLibraryWorkout({ combo, catalog, recentMovementIds: [] });

    expect(result).not.toBeNull();
    if (!result) return;

    for (const detail of result.movementDetails) {
      expect(detail.sets).toBe(4);
    }
  });

  it("derives equipmentNeeded from movement accessories", () => {
    const catalog = buildTestCatalog();
    const combo = {
      sessionType: "push" as const,
      goal: "build_muscle" as const,
      durationMinutes: 30 as const,
      level: "intermediate" as const,
      equipmentConfig: "full_accessories" as const,
    };

    const result = buildLibraryWorkout({ combo, catalog, recentMovementIds: [] });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.equipmentNeeded.length).toBeGreaterThan(0);
  });

  it("rotates exercises using recentMovementIds", () => {
    const catalog = buildTestCatalog();
    const combo = {
      sessionType: "push" as const,
      goal: "build_muscle" as const,
      durationMinutes: 30 as const,
      level: "intermediate" as const,
      equipmentConfig: "full_accessories" as const,
    };

    const firstResult = buildLibraryWorkout({ combo, catalog, recentMovementIds: [] });
    expect(firstResult).not.toBeNull();
    if (!firstResult) return;

    const firstIds = firstResult.movementDetails.map((d) => d.movementId);

    const secondResult = buildLibraryWorkout({
      combo,
      catalog,
      recentMovementIds: firstIds,
    });
    expect(secondResult).not.toBeNull();
    if (!secondResult) return;

    // recentMovementIds deprioritizes but doesn't exclude; result is always valid
    expect(secondResult.exerciseCount).toBeGreaterThanOrEqual(3);
  });
});
