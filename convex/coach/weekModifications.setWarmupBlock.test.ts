/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

// Vite normalizes same-directory glob keys to "./foo.ts" instead of
// "../coach/foo.ts", which breaks convex-test module resolution.
// Remap ./foo.ts -> ../coach/foo.ts to match the expected path format.
const rawModules = import.meta.glob("../**/*.*s");
const modules: typeof rawModules = {};
for (const [key, value] of Object.entries(rawModules)) {
  modules[key.startsWith("./") ? "../coach/" + key.slice(2) : key] = value;
}

describe("setWarmupBlock", () => {
  async function seedDraftPlan(
    t: ReturnType<typeof convexTest>,
    userId: Id<"users">,
    blocks: { exercises: { movementId: string; sets: number; warmUp?: boolean }[] }[],
  ): Promise<Id<"workoutPlans">> {
    return t.mutation(internal.workoutPlans.create, {
      userId,
      title: "Test Workout",
      blocks,
      status: "draft",
      createdAt: Date.now(),
    });
  }

  async function seedMovement(t: ReturnType<typeof convexTest>, tonalId: string): Promise<void> {
    await t.run(async (ctx) => {
      await ctx.db.insert("movements", {
        tonalId,
        name: `Movement ${tonalId}`,
        shortName: tonalId,
        muscleGroups: ["chest"],
        skillLevel: 1,
        publishState: "published",
        sortOrder: 1,
        onMachine: true,
        inFreeLift: false,
        countReps: true,
        isTwoSided: false,
        isBilateral: false,
        isAlternating: false,
        descriptionHow: "",
        descriptionWhy: "",
        lastSyncedAt: Date.now(),
      });
    });
  }

  it("replaces existing first block when first block is already a warmup", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));

    await seedMovement(t, "warmup-old-1");
    await seedMovement(t, "warmup-old-2");
    await seedMovement(t, "main-1");
    await seedMovement(t, "new-w-1");
    await seedMovement(t, "new-w-2");
    await seedMovement(t, "new-w-3");

    const workoutPlanId = await seedDraftPlan(t, userId, [
      {
        exercises: [
          { movementId: "warmup-old-1", sets: 1, warmUp: true },
          { movementId: "warmup-old-2", sets: 1, warmUp: true },
        ],
      },
      { exercises: [{ movementId: "main-1", sets: 3 }] },
    ]);

    const result = await t.mutation(internal.coach.weekModifications.setWarmupBlock, {
      userId,
      workoutPlanId,
      exercises: [
        { movementId: "new-w-1", sets: 1, reps: 10 },
        { movementId: "new-w-2", sets: 1, reps: 10 },
        { movementId: "new-w-3", sets: 1, reps: 10 },
      ],
    });

    expect(result).toEqual({ ok: true });

    const wp = await t.run(async (ctx) => ctx.db.get(workoutPlanId));
    expect(wp?.blocks).toHaveLength(2);
    expect(wp?.blocks[0].exercises).toHaveLength(3);
    expect(wp?.blocks[0].exercises[0].movementId).toBe("new-w-1");
    expect(wp?.blocks[0].exercises[1].movementId).toBe("new-w-2");
    expect(wp?.blocks[0].exercises[2].movementId).toBe("new-w-3");
    expect(wp?.blocks[0].exercises.every((e) => e.warmUp === true)).toBe(true);
    expect(wp?.blocks[1].exercises[0].movementId).toBe("main-1");
  });

  it("inserts a new warmup block at index 0 when no existing warmup block is present", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));

    await seedMovement(t, "main-2");
    await seedMovement(t, "warmup-new-1");

    const workoutPlanId = await seedDraftPlan(t, userId, [
      { exercises: [{ movementId: "main-2", sets: 3 }] },
    ]);

    const result = await t.mutation(internal.coach.weekModifications.setWarmupBlock, {
      userId,
      workoutPlanId,
      exercises: [{ movementId: "warmup-new-1", sets: 1, reps: 12 }],
    });

    expect(result).toEqual({ ok: true });

    const wp = await t.run(async (ctx) => ctx.db.get(workoutPlanId));
    expect(wp?.blocks).toHaveLength(2);
    expect(wp?.blocks[0].exercises[0].movementId).toBe("warmup-new-1");
    expect(wp?.blocks[0].exercises[0].warmUp).toBe(true);
    expect(wp?.blocks[1].exercises[0].movementId).toBe("main-2");
  });

  it("inserts (does not replace) when blocks[0] exists but has zero exercises", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));

    await seedMovement(t, "main-empty-test");
    await seedMovement(t, "warmup-insert-1");

    // First block is intentionally empty (no exercises) — vacuous-truth bug
    // would treat blocks[0].exercises.every(() => ...) as true and REPLACE
    // instead of INSERT.
    const workoutPlanId = await seedDraftPlan(t, userId, [
      { exercises: [] },
      { exercises: [{ movementId: "main-empty-test", sets: 3 }] },
    ]);

    const result = await t.mutation(internal.coach.weekModifications.setWarmupBlock, {
      userId,
      workoutPlanId,
      exercises: [{ movementId: "warmup-insert-1", sets: 1, reps: 10 }],
    });

    expect(result).toEqual({ ok: true });

    const wp = await t.run(async (ctx) => ctx.db.get(workoutPlanId));
    // Should have grown to 3 blocks (insert), not stayed at 2 (replace).
    expect(wp?.blocks).toHaveLength(3);
    // New warmup block is at index 0.
    expect(wp?.blocks[0].exercises).toHaveLength(1);
    expect(wp?.blocks[0].exercises[0].movementId).toBe("warmup-insert-1");
    expect(wp?.blocks[0].exercises[0].warmUp).toBe(true);
    // Original empty block is now at index 1.
    expect(wp?.blocks[1].exercises).toHaveLength(0);
    // Original main block is now at index 2.
    expect(wp?.blocks[2].exercises[0].movementId).toBe("main-empty-test");
  });

  it("throws when exercises array is empty", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));

    await seedMovement(t, "main-3");

    const workoutPlanId = await seedDraftPlan(t, userId, [
      { exercises: [{ movementId: "main-3", sets: 3 }] },
    ]);

    await expect(
      t.mutation(internal.coach.weekModifications.setWarmupBlock, {
        userId,
        workoutPlanId,
        exercises: [],
      }),
    ).rejects.toThrow(/at least one/i);
  });
});
