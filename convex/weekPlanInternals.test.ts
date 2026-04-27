/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function seedWeekPlan(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
): Promise<Id<"weekPlans">> {
  return t.run(async (ctx) =>
    ctx.db.insert("weekPlans", {
      userId,
      weekStartDate: "2026-04-20",
      preferredSplit: "ppl",
      targetDays: 3,
      days: Array.from({ length: 7 }, () => ({
        sessionType: "rest" as const,
        status: "programmed" as const,
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

describe("deleteWeekPlanInternal", () => {
  test("deletes a week plan that belongs to the user", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));
    const weekPlanId = await seedWeekPlan(t, userId);

    await t.mutation(internal.weekPlanInternals.deleteWeekPlanInternal, { userId, weekPlanId });

    const plan = await t.run(async (ctx) => ctx.db.get(weekPlanId));
    expect(plan).toBeNull();
  });

  test("returns without error when the plan is already gone (race-condition no-op)", async () => {
    // Regression for TONALCOACH-12/11: two concurrent generateDraftWeekPlan
    // calls both query the existing plan, then both try to delete it. The
    // second delete must silently succeed, not throw.
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));
    const weekPlanId = await seedWeekPlan(t, userId);

    await t.mutation(internal.weekPlanInternals.deleteWeekPlanInternal, { userId, weekPlanId });
    // Second call with the same ID — plan is already gone.
    await expect(
      t.mutation(internal.weekPlanInternals.deleteWeekPlanInternal, { userId, weekPlanId }),
    ).resolves.not.toThrow();
  });

  test("throws when the plan belongs to a different user (access denied)", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await t.run(async (ctx) => ctx.db.insert("users", {}));
    const attackerId = await t.run(async (ctx) => ctx.db.insert("users", {}));
    const weekPlanId = await seedWeekPlan(t, ownerId);

    await expect(
      t.mutation(internal.weekPlanInternals.deleteWeekPlanInternal, {
        userId: attackerId,
        weekPlanId,
      }),
    ).rejects.toThrow("Week plan access denied");
  });
});
