import { describe, expect, it } from "vitest";
import { blocksFromMovementIds } from "./workoutBlocks";

const BENCH_CATALOG_ENTRY = {
  id: "bench",
  countReps: true,
  isAlternating: false,
  muscleGroups: ["Chest", "Triceps"],
  onMachineInfo: { accessory: "Smart Bar" },
};

const DURATION_MOVEMENT_ID = "plank";
const DURATION_CATALOG_ENTRY = {
  id: DURATION_MOVEMENT_ID,
  countReps: false,
  isAlternating: false,
  onMachineInfo: { accessory: "Handle" },
};
const MOBILITY_SCHEME = { sets: 2, duration: 35, restSeconds: 30 };
const SCHEME_WITHOUT_DURATION = { sets: 3, reps: 10, restSeconds: 90 };

describe("buildExercise duration selection", () => {
  it("uses goalScheme.duration when provided for a duration-based movement", () => {
    const ids = [DURATION_MOVEMENT_ID, "bench"];
    const catalog = [DURATION_CATALOG_ENTRY, BENCH_CATALOG_ENTRY];

    const blocks = blocksFromMovementIds(ids, undefined, {
      catalog,
      goalScheme: MOBILITY_SCHEME,
    });

    const exercise = blocks[0].exercises[0];
    expect(exercise.movementId).toBe(DURATION_MOVEMENT_ID);
    expect(exercise.duration).toBe(35);
    expect(exercise.reps).toBeUndefined();
  });

  it("falls back to 30s when no goalScheme is provided", () => {
    const ids = [DURATION_MOVEMENT_ID, "bench"];
    const catalog = [DURATION_CATALOG_ENTRY, BENCH_CATALOG_ENTRY];

    const blocks = blocksFromMovementIds(ids, undefined, { catalog });

    const exercise = blocks[0].exercises[0];
    expect(exercise.duration).toBe(30);
    expect(exercise.reps).toBeUndefined();
  });

  it("falls back to 30s when goalScheme has no duration field", () => {
    const ids = [DURATION_MOVEMENT_ID, "bench"];
    const catalog = [DURATION_CATALOG_ENTRY, BENCH_CATALOG_ENTRY];

    const blocks = blocksFromMovementIds(ids, undefined, {
      catalog,
      goalScheme: SCHEME_WITHOUT_DURATION,
    });

    const exercise = blocks[0].exercises[0];
    expect(exercise.duration).toBe(30);
    expect(exercise.reps).toBeUndefined();
  });

  it("uses goalScheme.reps for a rep-based movement", () => {
    const ids = ["bench"];
    const catalog = [BENCH_CATALOG_ENTRY];

    const blocks = blocksFromMovementIds(ids, undefined, {
      catalog,
      goalScheme: SCHEME_WITHOUT_DURATION,
    });

    const exercise = blocks[0].exercises[0];
    expect(exercise.reps).toBe(10);
    expect(exercise.duration).toBeUndefined();
  });
});
