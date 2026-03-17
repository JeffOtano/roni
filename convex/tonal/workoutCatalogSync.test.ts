import { describe, expect, it } from "vitest";
import { buildMovementTrainingTypeMap } from "./workoutCatalogSync";

describe("buildMovementTrainingTypeMap", () => {
  const typeMap = new Map([
    ["type-1", "Warm-up"],
    ["type-2", "Mobility"],
    ["type-3", "Strength"],
  ]);

  it("tags movement with all training types from workouts it appears in", () => {
    const workoutTiles = [
      { workoutId: "w1", trainingTypeIds: ["type-1"] },
      { workoutId: "w2", trainingTypeIds: ["type-2"] },
    ];
    const workoutDetails = new Map([
      ["w1", ["mov-a", "mov-b"]],
      ["w2", ["mov-a", "mov-c"]],
    ]);

    const result = buildMovementTrainingTypeMap(workoutTiles, workoutDetails, typeMap);

    expect(result.get("mov-a")).toEqual(expect.arrayContaining(["Warm-up", "Mobility"]));
    expect(result.get("mov-b")).toEqual(["Warm-up"]);
    expect(result.get("mov-c")).toEqual(["Mobility"]);
  });

  it("handles workout with multiple training type IDs", () => {
    const workoutTiles = [{ workoutId: "w1", trainingTypeIds: ["type-1", "type-3"] }];
    const workoutDetails = new Map([["w1", ["mov-a"]]]);

    const result = buildMovementTrainingTypeMap(workoutTiles, workoutDetails, typeMap);

    expect(result.get("mov-a")).toEqual(expect.arrayContaining(["Warm-up", "Strength"]));
  });

  it("skips workouts with no detail (failed fetch)", () => {
    const workoutTiles = [
      { workoutId: "w1", trainingTypeIds: ["type-1"] },
      { workoutId: "w-missing", trainingTypeIds: ["type-2"] },
    ];
    const workoutDetails = new Map([["w1", ["mov-a"]]]);

    const result = buildMovementTrainingTypeMap(workoutTiles, workoutDetails, typeMap);

    expect(result.get("mov-a")).toEqual(["Warm-up"]);
    expect(result.size).toBe(1);
  });

  it("skips unknown training type IDs", () => {
    const workoutTiles = [{ workoutId: "w1", trainingTypeIds: ["type-unknown"] }];
    const workoutDetails = new Map([["w1", ["mov-a"]]]);

    const result = buildMovementTrainingTypeMap(workoutTiles, workoutDetails, typeMap);

    expect(result.has("mov-a")).toBe(false);
  });

  it("returns empty map for empty inputs", () => {
    const result = buildMovementTrainingTypeMap([], new Map(), typeMap);
    expect(result.size).toBe(0);
  });
});
