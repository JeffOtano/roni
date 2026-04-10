import { describe, expect, it } from "vitest";
import { blocksFromMovementIds } from "./weekProgrammingHelpers";
import { TONAL_REST_MOVEMENT_ID } from "../tonal/transforms";

// ---------------------------------------------------------------------------
// blocksFromMovementIds
// ---------------------------------------------------------------------------

const blockCatalog = [
  {
    id: "bench",
    countReps: true,
    isAlternating: false,
    onMachineInfo: { accessory: "Smart Bar" },
  },
  {
    id: "row",
    countReps: true,
    isAlternating: false,
    onMachineInfo: { accessory: "Smart Bar" },
  },
  {
    id: "curl",
    countReps: true,
    isAlternating: false,
    onMachineInfo: { accessory: "Handle" },
  },
  {
    id: "fly",
    countReps: true,
    isAlternating: false,
    onMachineInfo: { accessory: "Handle" },
  },
  {
    id: "extension",
    countReps: true,
    isAlternating: false,
    onMachineInfo: { accessory: "Handle" },
  },
  {
    id: "pushdown",
    countReps: true,
    isAlternating: false,
    onMachineInfo: { accessory: "Rope" },
  },
  {
    id: "pushup",
    countReps: false,
    isAlternating: false,
    // no onMachineInfo — bodyweight/duration-based
  },
];

describe("blocksFromMovementIds", () => {
  it("returns empty array for empty input", () => {
    expect(blocksFromMovementIds([])).toEqual([]);
  });

  it("groups exercises by accessory into 2-exercise superset blocks", () => {
    // Pre-sorted by accessory: Smart Bar x2, Handle x2
    const ids = ["bench", "row", "curl", "fly"];
    const blocks = blocksFromMovementIds(ids, undefined, { catalog: blockCatalog });

    expect(blocks).toHaveLength(2);
    expect(blocks[0].exercises.map((e) => e.movementId)).toEqual(["bench", "row"]);
    expect(blocks[1].exercises.map((e) => e.movementId)).toEqual(["curl", "fly"]);
  });

  it("puts odd exercise in its own straight-set block", () => {
    // Handle x3 = 2 in superset + 1 solo (solo gets rest injected)
    const ids = ["curl", "fly", "extension"];
    const blocks = blocksFromMovementIds(ids, undefined, { catalog: blockCatalog });

    expect(blocks).toHaveLength(2);
    expect(blocks[0].exercises).toHaveLength(2);
    expect(blocks[1].exercises).toHaveLength(2);
    expect(blocks[1].exercises[0].movementId).toBe("extension");
    expect(blocks[1].exercises[1].movementId).toBe(TONAL_REST_MOVEMENT_ID);
  });

  it("creates separate blocks per accessory group", () => {
    // Smart Bar x1, Handle x1, Rope x1 = 3 solo blocks (each gets rest injected)
    const ids = ["bench", "curl", "pushdown"];
    const blocks = blocksFromMovementIds(ids, undefined, { catalog: blockCatalog });

    expect(blocks).toHaveLength(3);
    expect(blocks[0].exercises).toHaveLength(2);
    expect(blocks[0].exercises[0].movementId).toBe("bench");
    expect(blocks[0].exercises[1].movementId).toBe(TONAL_REST_MOVEMENT_ID);
    expect(blocks[1].exercises).toHaveLength(2);
    expect(blocks[1].exercises[0].movementId).toBe("curl");
    expect(blocks[1].exercises[1].movementId).toBe(TONAL_REST_MOVEMENT_ID);
    expect(blocks[2].exercises).toHaveLength(2);
    expect(blocks[2].exercises[0].movementId).toBe("pushdown");
    expect(blocks[2].exercises[1].movementId).toBe(TONAL_REST_MOVEMENT_ID);
  });

  it("groups bodyweight exercises together", () => {
    const ids = ["pushup", "curl"];
    const blocks = blocksFromMovementIds(ids, undefined, { catalog: blockCatalog });

    // pushup = bodyweight group (1 solo block + rest), curl = Handle group (1 solo block + rest)
    expect(blocks).toHaveLength(2);
    expect(blocks[0].exercises).toHaveLength(2);
    expect(blocks[0].exercises[0].movementId).toBe("pushup");
    expect(blocks[0].exercises[1].movementId).toBe(TONAL_REST_MOVEMENT_ID);
    expect(blocks[1].exercises).toHaveLength(2);
    expect(blocks[1].exercises[0].movementId).toBe("curl");
    expect(blocks[1].exercises[1].movementId).toBe(TONAL_REST_MOVEMENT_ID);
  });

  it("uses duration for non-countReps exercises", () => {
    const ids = ["pushup"];
    const blocks = blocksFromMovementIds(ids, undefined, { catalog: blockCatalog });

    expect(blocks[0].exercises).toHaveLength(2);
    expect(blocks[0].exercises[0].duration).toBe(30);
    expect(blocks[0].exercises[0].reps).toBeUndefined();
    expect(blocks[0].exercises[1].movementId).toBe(TONAL_REST_MOVEMENT_ID);
  });

  it("applies suggested reps from progressive overload", () => {
    const ids = ["bench"];
    const suggestions = [{ movementId: "bench", suggestedReps: 8 }];
    const blocks = blocksFromMovementIds(ids, suggestions, { catalog: blockCatalog });

    expect(blocks[0].exercises[0].reps).toBe(8);
  });

  it("defaults to 3 sets and 10 reps without suggestions", () => {
    const ids = ["bench"];
    const blocks = blocksFromMovementIds(ids, undefined, { catalog: blockCatalog });

    expect(blocks[0].exercises[0].sets).toBe(3);
    expect(blocks[0].exercises[0].reps).toBe(10);
  });

  it("works without catalog (all exercises in one accessory group)", () => {
    const ids = ["a", "b", "c", "d"];
    const blocks = blocksFromMovementIds(ids);

    // Without catalog, all are same accessory group (bodyweight fallback), paired into supersets
    expect(blocks).toHaveLength(2);
    expect(blocks[0].exercises.map((e) => e.movementId)).toEqual(["a", "b"]);
    expect(blocks[1].exercises.map((e) => e.movementId)).toEqual(["c", "d"]);
  });
});

// ---------------------------------------------------------------------------
// blocksFromMovementIds - rest injection
// ---------------------------------------------------------------------------

const blockCatalogWithMuscles = [
  {
    id: "bench",
    countReps: true,
    isAlternating: false,
    muscleGroups: ["Chest", "Triceps"],
    onMachineInfo: { accessory: "Smart Bar" },
  },
  {
    id: "row",
    countReps: true,
    isAlternating: false,
    muscleGroups: ["Back", "Biceps"],
    onMachineInfo: { accessory: "Smart Bar" },
  },
  {
    id: "curl",
    countReps: true,
    isAlternating: false,
    muscleGroups: ["Biceps"],
    onMachineInfo: { accessory: "Handle" },
  },
  {
    id: "fly",
    countReps: true,
    isAlternating: false,
    muscleGroups: ["Chest"],
    onMachineInfo: { accessory: "Handle" },
  },
  {
    id: "extension",
    countReps: true,
    isAlternating: false,
    muscleGroups: ["Triceps"],
    onMachineInfo: { accessory: "Handle" },
  },
  {
    id: "pushdown",
    countReps: true,
    isAlternating: false,
    muscleGroups: ["Triceps"],
    onMachineInfo: { accessory: "Rope" },
  },
  {
    id: "pushup",
    countReps: false,
    isAlternating: false,
    muscleGroups: ["Chest", "Triceps"],
  },
  {
    id: TONAL_REST_MOVEMENT_ID,
    countReps: false,
    isAlternating: false,
    muscleGroups: [],
  },
];

describe("blocksFromMovementIds - rest injection", () => {
  it("injects rest into single-exercise blocks", () => {
    const ids = ["bench"];
    const blocks = blocksFromMovementIds(ids, undefined, {
      catalog: blockCatalogWithMuscles,
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].exercises).toHaveLength(2);
    expect(blocks[0].exercises[0].movementId).toBe("bench");
    expect(blocks[0].exercises[1].movementId).toBe(TONAL_REST_MOVEMENT_ID);
    expect(blocks[0].exercises[1].duration).toBe(90); // compound = 2+ muscle groups
    expect(blocks[0].exercises[1].sets).toBe(3);
  });

  it("uses 60s rest for isolation exercises (1 muscle group)", () => {
    const ids = ["curl"];
    const blocks = blocksFromMovementIds(ids, undefined, {
      catalog: blockCatalogWithMuscles,
    });

    expect(blocks[0].exercises[1].movementId).toBe(TONAL_REST_MOVEMENT_ID);
    expect(blocks[0].exercises[1].duration).toBe(60);
  });

  it("does not inject rest into superset blocks (2 exercises)", () => {
    const ids = ["bench", "row"];
    const blocks = blocksFromMovementIds(ids, undefined, {
      catalog: blockCatalogWithMuscles,
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].exercises).toHaveLength(2);
    expect(blocks[0].exercises[0].movementId).toBe("bench");
    expect(blocks[0].exercises[1].movementId).toBe("row");
  });

  it("injects rest only into the odd solo block, not the superset", () => {
    // Handle x3: curl+fly superset, extension solo
    const ids = ["curl", "fly", "extension"];
    const blocks = blocksFromMovementIds(ids, undefined, {
      catalog: blockCatalogWithMuscles,
    });

    expect(blocks).toHaveLength(2);
    // Superset block: no rest
    expect(blocks[0].exercises).toHaveLength(2);
    expect(blocks[0].exercises.map((e) => e.movementId)).toEqual(["curl", "fly"]);
    // Solo block: has rest
    expect(blocks[1].exercises).toHaveLength(2);
    expect(blocks[1].exercises[0].movementId).toBe("extension");
    expect(blocks[1].exercises[1].movementId).toBe(TONAL_REST_MOVEMENT_ID);
  });

  it("rest sets match the main exercise sets", () => {
    const ids = ["bench"];
    const blocks = blocksFromMovementIds(ids, undefined, {
      catalog: blockCatalogWithMuscles,
      isDeload: true,
    });

    const mainSets = blocks[0].exercises[0].sets;
    const restSets = blocks[0].exercises[1].sets;
    expect(mainSets).toBe(2);
    expect(restSets).toBe(mainSets);
  });
});
