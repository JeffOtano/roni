/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, test } from "vitest";
import type { BlockInput } from "../tonal/transforms";
import { internal } from "../_generated/api";
import schema from "../schema";

// Vite normalizes same-directory glob keys to "./foo.ts" instead of
// "../coach/foo.ts", which breaks convex-test module resolution.
// Remap ./foo.ts -> ../coach/foo.ts to match the expected path format.
const rawModules = import.meta.glob("../**/*.*s");
const modules: typeof rawModules = {};
for (const [key, value] of Object.entries(rawModules)) {
  modules[key.startsWith("./") ? "../coach/" + key.slice(2) : key] = value;
}

/** Pure version of the swap logic from weekModifications.ts for unit testing. */
function swapMovementInBlocks(
  blocks: BlockInput[],
  oldMovementId: string,
  newMovementId: string,
): BlockInput[] {
  return blocks.map((block) => ({
    ...block,
    exercises: block.exercises.map((ex) =>
      ex.movementId === oldMovementId ? { ...ex, movementId: newMovementId } : ex,
    ),
  }));
}

describe("swapMovementInBlocks", () => {
  it("replaces the target movement ID", () => {
    const blocks: BlockInput[] = [
      {
        exercises: [
          { movementId: "aaa", sets: 3, reps: 10 },
          { movementId: "bbb", sets: 3, reps: 10 },
          { movementId: "ccc", sets: 3, reps: 12 },
        ],
      },
    ];
    const result = swapMovementInBlocks(blocks, "bbb", "ddd");
    expect(result[0].exercises[1].movementId).toBe("ddd");
    expect(result[0].exercises[0].movementId).toBe("aaa");
    expect(result[0].exercises[2].movementId).toBe("ccc");
  });

  it("preserves sets and reps on swapped exercise", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "aaa", sets: 4, reps: 8 }] }];
    const result = swapMovementInBlocks(blocks, "aaa", "bbb");
    expect(result[0].exercises[0]).toEqual({
      movementId: "bbb",
      sets: 4,
      reps: 8,
    });
  });

  it("no-ops when movement ID not found", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "aaa", sets: 3, reps: 10 }] }];
    const result = swapMovementInBlocks(blocks, "zzz", "bbb");
    expect(result).toEqual(blocks);
  });

  it("handles multiple blocks", () => {
    const blocks: BlockInput[] = [
      { exercises: [{ movementId: "aaa", sets: 3 }] },
      { exercises: [{ movementId: "aaa", sets: 4 }] },
    ];
    const result = swapMovementInBlocks(blocks, "aaa", "bbb");
    expect(result[0].exercises[0].movementId).toBe("bbb");
    expect(result[1].exercises[0].movementId).toBe("bbb");
  });

  it("preserves other exercise properties", () => {
    const blocks: BlockInput[] = [
      {
        exercises: [
          { movementId: "aaa", sets: 3, reps: 10, spotter: true, eccentric: true, warmUp: false },
        ],
      },
    ];
    const result = swapMovementInBlocks(blocks, "aaa", "bbb");
    expect(result[0].exercises[0].spotter).toBe(true);
    expect(result[0].exercises[0].eccentric).toBe(true);
    expect(result[0].exercises[0].warmUp).toBe(false);
  });
});

describe("day slot swap (pure logic)", () => {
  type DaySlot = { sessionType: string; status: string; workoutPlanId?: string };

  function swapDays(days: DaySlot[], from: number, to: number): DaySlot[] {
    const result = [...days];
    const temp = result[from];
    result[from] = result[to];
    result[to] = temp;
    return result;
  }

  it("swaps two day slots", () => {
    const days: DaySlot[] = [
      { sessionType: "push", status: "programmed", workoutPlanId: "wp1" },
      { sessionType: "rest", status: "programmed" },
      { sessionType: "pull", status: "programmed", workoutPlanId: "wp2" },
    ];
    const result = swapDays(days, 0, 2);
    expect(result[0].sessionType).toBe("pull");
    expect(result[2].sessionType).toBe("push");
    expect(result[0].workoutPlanId).toBe("wp2");
    expect(result[2].workoutPlanId).toBe("wp1");
  });

  it("swap with itself is a no-op", () => {
    const days: DaySlot[] = [{ sessionType: "push", status: "programmed", workoutPlanId: "wp1" }];
    const result = swapDays(days, 0, 0);
    expect(result).toEqual(days);
  });
});

describe("addExerciseToDraft warmUp passthrough", () => {
  test("persists warmUp:true on the new exercise when the arg is set", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return ctx.db.insert("users", {});
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("movements", {
        tonalId: "mov-warmup-1",
        name: "Cat-Cow",
        shortName: "Cat-Cow",
        muscleGroups: ["Back"],
        skillLevel: 1,
        publishState: "published",
        sortOrder: 1,
        onMachine: false,
        inFreeLift: true,
        countReps: false,
        isTwoSided: false,
        isBilateral: false,
        isAlternating: false,
        descriptionHow: "On all fours, alternate between arching and rounding your back.",
        descriptionWhy: "Improves spinal mobility.",
        lastSyncedAt: Date.now(),
      });
    });

    const planId = await t.run(async (ctx) => {
      return ctx.db.insert("workoutPlans", {
        userId,
        title: "Test",
        blocks: [{ exercises: [{ movementId: "mov-other", sets: 3, reps: 10 }] }],
        status: "draft",
        createdAt: Date.now(),
      });
    });

    const result = await t.mutation(internal.coach.weekModifications.addExerciseToDraft, {
      userId,
      workoutPlanId: planId,
      movementId: "mov-warmup-1",
      sets: 2,
      duration: 30,
      warmUp: true,
    });

    expect(result.ok).toBe(true);

    const wp = await t.run((ctx) => ctx.db.get(planId));
    const lastBlockExercise = wp!.blocks.at(-1)!.exercises[0];
    expect(lastBlockExercise.movementId).toBe("mov-warmup-1");
    expect(lastBlockExercise.warmUp).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// addExerciseToDraft — integration tests
// ---------------------------------------------------------------------------

/** Minimal movement document satisfying the schema's required fields. */
function makeMovementDoc(tonalId: string, countReps = true) {
  return {
    tonalId,
    name: tonalId,
    shortName: tonalId,
    muscleGroups: ["Quads"],
    skillLevel: 1,
    publishState: "published",
    sortOrder: 1,
    onMachine: true,
    inFreeLift: false,
    countReps,
    isTwoSided: false,
    isBilateral: true,
    isAlternating: false,
    descriptionHow: "",
    descriptionWhy: "",
    lastSyncedAt: 1000,
  };
}

describe("addExerciseToDraft under concurrent calls", () => {
  it("three parallel calls all persist (no silent drop)", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));

    await t.run(async (ctx) => {
      for (const id of ["mov-a", "mov-b", "mov-c", "mov-existing"]) {
        await ctx.db.insert("movements", makeMovementDoc(id));
      }
    });

    const planId = await t.run((ctx) =>
      ctx.db.insert("workoutPlans", {
        userId,
        title: "Test",
        blocks: [
          { exercises: [{ movementId: "mov-existing", sets: 3, reps: 10 }] },
          { exercises: [{ movementId: "mov-existing", sets: 3, reps: 10 }] },
        ],
        status: "draft",
        createdAt: Date.now(),
      }),
    );

    const results = await Promise.all(
      ["mov-a", "mov-b", "mov-c"].map((m) =>
        t.mutation(internal.coach.weekModifications.addExerciseToDraft, {
          userId,
          workoutPlanId: planId,
          movementId: m,
          sets: 3,
          reps: 10,
        }),
      ),
    );

    for (const r of results) expect(r.ok).toBe(true);

    const wp = await t.run((ctx) => ctx.db.get(planId));
    const allMovementIds = wp!.blocks.flatMap((b) => b.exercises.map((e) => e.movementId));
    expect(allMovementIds).toContain("mov-a");
    expect(allMovementIds).toContain("mov-b");
    expect(allMovementIds).toContain("mov-c");
  });

  it("integrity guard does not fire under normal operation", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", {}));

    await t.run(async (ctx) => {
      for (const id of ["mov-existing", "mov-new"]) {
        await ctx.db.insert("movements", makeMovementDoc(id));
      }
    });

    const planId = await t.run((ctx) =>
      ctx.db.insert("workoutPlans", {
        userId,
        title: "Test",
        blocks: [
          { exercises: [{ movementId: "mov-existing", sets: 3, reps: 10 }] },
          { exercises: [{ movementId: "mov-existing", sets: 3, reps: 10 }] },
        ],
        status: "draft",
        createdAt: Date.now(),
      }),
    );

    const result = await t.mutation(internal.coach.weekModifications.addExerciseToDraft, {
      userId,
      workoutPlanId: planId,
      movementId: "mov-new",
      sets: 3,
      reps: 10,
    });

    expect(result.ok).toBe(true);

    const wp = await t.run((ctx) => ctx.db.get(planId));
    const allMovementIds = wp!.blocks.flatMap((b) => b.exercises.map((e) => e.movementId));
    expect(allMovementIds).toContain("mov-existing");
    expect(allMovementIds).toContain("mov-new");
  });
});
