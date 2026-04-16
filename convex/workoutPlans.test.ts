/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function seedPlan(
  t: ReturnType<typeof convexTest>,
  status: Doc<"workoutPlans">["status"],
): Promise<Id<"workoutPlans">> {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    return ctx.db.insert("workoutPlans", {
      userId,
      title: "test",
      blocks: [],
      status,
      createdAt: Date.now(),
    });
  });
}

describe("transitionToPushing — atomic claim for retry", () => {
  test("claims a failed plan exactly once", async () => {
    const t = convexTest(schema, modules);
    const planId = await seedPlan(t, "failed");

    const first = await t.mutation(internal.workoutPlans.transitionToPushing, { planId });
    const second = await t.mutation(internal.workoutPlans.transitionToPushing, { planId });

    expect(first).toBe(true);
    expect(second).toBe(false);
    const plan = await t.run(async (ctx) => ctx.db.get(planId));
    expect(plan?.status).toBe("pushing");
  });

  test("claims a draft plan", async () => {
    const t = convexTest(schema, modules);
    const planId = await seedPlan(t, "draft");

    const claimed = await t.mutation(internal.workoutPlans.transitionToPushing, { planId });

    expect(claimed).toBe(true);
  });

  test("refuses to claim a pushed plan", async () => {
    const t = convexTest(schema, modules);
    const planId = await seedPlan(t, "pushed");

    const claimed = await t.mutation(internal.workoutPlans.transitionToPushing, { planId });

    expect(claimed).toBe(false);
  });

  test("refuses to claim a pushing plan (prevents double-retry)", async () => {
    const t = convexTest(schema, modules);
    const planId = await seedPlan(t, "pushing");

    const claimed = await t.mutation(internal.workoutPlans.transitionToPushing, { planId });

    expect(claimed).toBe(false);
  });
});
