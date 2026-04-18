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
  const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));
  return insertPlan(t, { userId, status, movementId: "seed-movement" });
}

async function insertPlan(
  t: ReturnType<typeof convexTest>,
  {
    userId,
    status,
    movementId,
  }: {
    userId: Id<"users">;
    status: Doc<"workoutPlans">["status"];
    movementId: string;
  },
): Promise<Id<"workoutPlans">> {
  return t.mutation(internal.workoutPlans.create, {
    userId,
    title: movementId,
    blocks: [{ exercises: [{ movementId, sets: 3 }] }],
    status,
    createdAt: Date.now(),
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

describe("getRecentMovementIds", () => {
  test("keeps the 50 most recent movement IDs across completed and pushed plans", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));

    for (let i = 1; i <= 26; i++) {
      await insertPlan(t, {
        userId,
        status: "completed",
        movementId: `completed-${i}`,
      });
    }

    for (let i = 1; i <= 26; i++) {
      await insertPlan(t, {
        userId,
        status: "pushed",
        movementId: `pushed-${i}`,
      });
    }

    const recentMovementIds = await t.query(internal.workoutPlans.getRecentMovementIds, { userId });

    expect(recentMovementIds).toHaveLength(50);
    expect(recentMovementIds).not.toContain("completed-1");
    expect(recentMovementIds).not.toContain("completed-2");
    expect(recentMovementIds).toContain("pushed-1");
    expect(recentMovementIds).toContain("pushed-2");
  });
});
