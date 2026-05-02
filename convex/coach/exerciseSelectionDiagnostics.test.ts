import { describe, expect, it } from "vitest";
import { selectExercises, selectExercisesWithDiagnostics } from "./exerciseSelection";
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

const mk = (id: string, name: string, groups: string[]) =>
  movement({ id, name, muscleGroups: groups, skillLevel: 1 });

describe("selectExercisesWithDiagnostics", () => {
  it("flags degeneration when injury keywords strip catalog to a single muscle group", () => {
    const catalog = [
      mk("m1", "Bench Press", ["Chest"]),
      mk("m2", "Overhead Press", ["Shoulders"]),
      mk("m3", "Dip", ["Triceps"]),
      mk("m4", "Fly Machine", ["Chest"]),
      mk("m5", "Reverse Lunge", ["Quads"]),
    ];
    const result = selectExercisesWithDiagnostics({
      catalog,
      targetMuscleGroups: ["Chest", "Shoulders", "Triceps", "Quads"],
      userLevel: 2,
      maxExercises: 5,
      lastUsedMovementIds: [],
      constraints: { excludeNameSubstrings: ["bench", "overhead", "dip", "fly"] },
    });
    expect(result.ids).toEqual(["m5"]);
    expect(result.diagnostics.eliminatedByInjury).toBe(4);
    expect(result.diagnostics.eligibleCount).toBe(1);
    expect(result.diagnostics.fellThroughDiversity).toBe(true);
  });

  it("does not flag degeneration when the filter leaves at least 2 muscle groups", () => {
    const catalog = [
      mk("m1", "Goblet Squat", ["Quads", "Glutes"]),
      mk("m2", "Romanian Deadlift", ["Hamstrings"]),
      mk("m3", "Walking Lunge", ["Quads"]),
    ];
    const result = selectExercisesWithDiagnostics({
      catalog,
      targetMuscleGroups: ["Quads", "Glutes", "Hamstrings"],
      userLevel: 2,
      maxExercises: 3,
      lastUsedMovementIds: [],
    });
    expect(result.diagnostics.fellThroughDiversity).toBe(false);
    expect(result.diagnostics.eligibleCount).toBe(3);
  });

  it("counts lastUsed eliminations regardless of muscle group match", () => {
    const catalog = [
      mk("m-quads-1", "Squat", ["Quads"]),
      mk("m-other", "Bench Press", ["Chest"]), // Different muscle group
    ];
    const result = selectExercisesWithDiagnostics({
      catalog,
      targetMuscleGroups: ["Quads"],
      userLevel: 2,
      maxExercises: 5,
      lastUsedMovementIds: ["m-quads-1", "m-other"], // Both flagged as last-used
    });
    expect(result.diagnostics.eliminatedByLastUsed).toBe(2); // Both counted
  });

  it("returns the same ids as selectExercises for equivalent input", () => {
    const catalog = [
      mk("c1", "Bench Press", ["Chest", "Triceps"]),
      mk("c2", "Overhead Press", ["Shoulders", "Triceps"]),
      mk("iso1", "Fly", ["Chest"]),
    ];
    const input = {
      catalog,
      targetMuscleGroups: ["Chest", "Triceps", "Shoulders"],
      userLevel: 2,
      maxExercises: 5,
      lastUsedMovementIds: [],
    };
    expect(selectExercisesWithDiagnostics(input).ids).toEqual(selectExercises(input));
  });

  it("counts exact movement ID exclusions separately from injury keywords", () => {
    const catalog = [
      mk("c1", "Bench Press", ["Chest", "Triceps"]),
      mk("c2", "Overhead Press", ["Shoulders", "Triceps"]),
      mk("iso1", "Fly", ["Chest"]),
    ];

    const result = selectExercisesWithDiagnostics({
      catalog,
      targetMuscleGroups: ["Chest", "Triceps", "Shoulders"],
      userLevel: 2,
      maxExercises: 5,
      lastUsedMovementIds: [],
      constraints: { excludeMovementIds: ["c2"] },
    });

    expect(result.ids).toEqual(["c1", "iso1"]);
    expect(result.diagnostics.eliminatedByMovementId).toBe(1);
    expect(result.diagnostics.eliminatedByInjury).toBe(0);
  });

  it("counts exact movement ID exclusions before target muscle filtering", () => {
    const catalog = [
      mk("c1", "Bench Press", ["Chest", "Triceps"]),
      mk("leg1", "Goblet Squat", ["Quads", "Glutes"]),
    ];

    const result = selectExercisesWithDiagnostics({
      catalog,
      targetMuscleGroups: ["Chest", "Triceps"],
      userLevel: 2,
      maxExercises: 5,
      lastUsedMovementIds: [],
      constraints: { excludeMovementIds: ["leg1"] },
    });

    expect(result.ids).toEqual(["c1"]);
    expect(result.diagnostics.eliminatedByMovementId).toBe(1);
  });
});
