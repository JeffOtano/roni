/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { internal } from "../_generated/api";

// Vite normalizes same-directory glob keys to "./foo.ts" instead of
// "../coach/foo.ts", which breaks convex-test module resolution.
// Remap ./foo.ts -> ../coach/foo.ts to match the expected path format.
const rawModules = import.meta.glob("../**/*.*s");
const modules: typeof rawModules = {};
for (const [key, value] of Object.entries(rawModules)) {
  modules[key.startsWith("./") ? "../coach/" + key.slice(2) : key] = value;
}

describe("rebuildDay", () => {
  it("replaces a day's workoutPlan with a new draft built from explicit blocks", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run((ctx) => ctx.db.insert("users", { email: "u@t" }));
    await t.run(async (ctx) => {
      for (const id of ["mov-warmup", "mov-main"]) {
        await ctx.db.insert("movements", {
          tonalId: id,
          name: id,
          shortName: id,
          muscleGroups: ["Back"],
          countReps: id === "mov-main",
          skillLevel: 1,
          onMachine: false,
          inFreeLift: false,
          isTwoSided: false,
          isBilateral: true,
          isAlternating: false,
          publishState: "published",
          sortOrder: 0,
          descriptionHow: "",
          descriptionWhy: "",
          nameSearchText: id,
          muscleGroupsSearchText: "back",
          trainingTypesSearchText: "strength",
          lastSyncedAt: Date.now(),
        });
      }
    });

    const oldPlanId = await t.run((ctx) =>
      ctx.db.insert("workoutPlans", {
        userId,
        title: "Old",
        blocks: [{ exercises: [{ movementId: "mov-old", sets: 3, reps: 10 }] }],
        status: "draft",
        createdAt: Date.now(),
      }),
    );

    const weekPlanId = await t.run((ctx) =>
      ctx.db.insert("weekPlans", {
        userId,
        weekStartDate: "2026-04-27",
        preferredSplit: "full_body",
        targetDays: 1,
        days: [
          { sessionType: "full_body", status: "programmed", workoutPlanId: oldPlanId },
          { sessionType: "rest", status: "programmed" },
          { sessionType: "rest", status: "programmed" },
          { sessionType: "rest", status: "programmed" },
          { sessionType: "rest", status: "programmed" },
          { sessionType: "rest", status: "programmed" },
          { sessionType: "rest", status: "programmed" },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    const result = await t.action(internal.coach.rebuildDay.rebuildDay, {
      userId,
      weekPlanId,
      dayIndex: 0,
      title: "Monday Rebuilt",
      blocks: [
        { exercises: [{ movementId: "mov-warmup", sets: 2, duration: 30, warmUp: true }] },
        { exercises: [{ movementId: "mov-main", sets: 3, reps: 10 }] },
      ],
    });

    expect(result.ok).toBe(true);

    const wp = await t.run((ctx) => ctx.db.get(weekPlanId));
    const newPlanId = wp!.days[0].workoutPlanId!;
    expect(newPlanId).not.toEqual(oldPlanId);

    const newPlan = await t.run((ctx) => ctx.db.get(newPlanId));
    expect(newPlan!.title).toBe("Monday Rebuilt");
    expect(newPlan!.blocks).toHaveLength(2);
    expect(newPlan!.blocks[0].exercises[0].warmUp).toBe(true);
    expect(newPlan!.status).toBe("draft");
  });

  it("does not delete the old workoutPlan until the new plan is linked", async () => {
    // Arrange
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", { email: "u@t" }));
    await t.run(async (ctx) => {
      await ctx.db.insert("movements", {
        tonalId: "mov-x",
        name: "mov-x",
        shortName: "mov-x",
        muscleGroups: ["Back"],
        countReps: true,
        skillLevel: 1,
        onMachine: false,
        inFreeLift: false,
        isTwoSided: false,
        isBilateral: true,
        isAlternating: false,
        publishState: "published",
        sortOrder: 0,
        descriptionHow: "",
        descriptionWhy: "",
        nameSearchText: "mov-x",
        muscleGroupsSearchText: "back",
        trainingTypesSearchText: "strength",
        lastSyncedAt: Date.now(),
      });
    });
    const oldPlanId = await t.run((ctx) =>
      ctx.db.insert("workoutPlans", {
        userId,
        title: "Old",
        blocks: [{ exercises: [{ movementId: "mov-old", sets: 3, reps: 10 }] }],
        status: "draft",
        createdAt: Date.now(),
      }),
    );
    const weekPlanId = await t.run((ctx) =>
      ctx.db.insert("weekPlans", {
        userId,
        weekStartDate: "2026-04-27",
        preferredSplit: "full_body",
        targetDays: 1,
        days: [
          { sessionType: "full_body", status: "programmed", workoutPlanId: oldPlanId },
          ...Array.from({ length: 6 }, () => ({
            sessionType: "rest" as const,
            status: "programmed" as const,
          })),
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    // Act
    const result = await t.action(internal.coach.rebuildDay.rebuildDay, {
      userId,
      weekPlanId,
      dayIndex: 0,
      blocks: [{ exercises: [{ movementId: "mov-x", sets: 1, reps: 10 }] }],
    });

    // Assert: result is ok, the week plan now points at a NEW plan, and the old plan is deleted
    expect(result.ok).toBe(true);
    const wp = await t.run((ctx) => ctx.db.get(weekPlanId));
    expect(wp!.days[0].workoutPlanId).not.toEqual(oldPlanId);
    const oldPlanAfter = await t.run((ctx) => ctx.db.get(oldPlanId));
    expect(oldPlanAfter).toBeNull(); // deleted
  });

  it("returns error for rest day without throwing", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", { email: "u@t" }));
    const weekPlanId = await t.run((ctx) =>
      ctx.db.insert("weekPlans", {
        userId,
        weekStartDate: "2026-04-27",
        preferredSplit: "full_body",
        targetDays: 0,
        days: Array.from({ length: 7 }, () => ({
          sessionType: "rest" as const,
          status: "programmed" as const,
        })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    const result = await t.action(internal.coach.rebuildDay.rebuildDay, {
      userId,
      weekPlanId,
      dayIndex: 0,
      blocks: [{ exercises: [{ movementId: "x", sets: 1, reps: 1 }] }],
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/rest|recovery/i);
  });

  it("returns error for recovery day without throwing", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) => ctx.db.insert("users", { email: "u@t" }));
    const weekPlanId = await t.run((ctx) =>
      ctx.db.insert("weekPlans", {
        userId,
        weekStartDate: "2026-04-27",
        preferredSplit: "full_body",
        targetDays: 0,
        days: Array.from({ length: 7 }, () => ({
          sessionType: "recovery" as const,
          status: "programmed" as const,
        })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    const result = await t.action(internal.coach.rebuildDay.rebuildDay, {
      userId,
      weekPlanId,
      dayIndex: 3,
      blocks: [{ exercises: [{ movementId: "x", sets: 1, reps: 1 }] }],
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/rest|recovery/i);
  });
});
