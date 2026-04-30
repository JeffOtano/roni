/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function insertUserWithProfile(
  t: ReturnType<typeof convexTest>,
  overrides: { firstAiWorkoutCompletedAt?: number } = {},
): Promise<Id<"users">> {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    await ctx.db.insert("userProfiles", {
      userId,
      tonalUserId: `tonal-${userId}`,
      tonalToken: "token",
      lastActiveAt: Date.now(),
      ...overrides,
    });
    return userId;
  });
}

describe("getEligibleUserIdsPage", () => {
  test("includes users who have not yet completed an AI workout", async () => {
    const t = convexTest(schema, modules);
    const userId = await insertUserWithProfile(t);

    const result = await t.query(internal.activation.getEligibleUserIdsPage, {
      paginationOpts: { cursor: null, numItems: 100 },
    });

    expect(result.page).toContain(userId);
  });

  test("excludes users who have already been activated", async () => {
    const t = convexTest(schema, modules);
    const userId = await insertUserWithProfile(t, { firstAiWorkoutCompletedAt: Date.now() });

    const result = await t.query(internal.activation.getEligibleUserIdsPage, {
      paginationOpts: { cursor: null, numItems: 100 },
    });

    expect(result.page).not.toContain(userId);
  });
});

describe("runActivationCheckForEligibleUsers", () => {
  test("completes without error when no users are eligible", async () => {
    const t = convexTest(schema, modules);

    await t.action(internal.activation.runActivationCheckForEligibleUsers, {});
  });

  test("exits before processing any user when deadline is already past", async () => {
    // _deadlineOffsetMs: -1 makes deadline = Date.now() - 1 which is already
    // past. The first iteration of the while-loop sees Date.now() >= deadline
    // and breaks without fetching any user page or calling checkActivation.
    const t = convexTest(schema, modules);
    const userId = await insertUserWithProfile(t);

    await t.action(internal.activation.runActivationCheckForEligibleUsers, {
      _deadlineOffsetMs: -1,
    });

    const profile = await t.run((ctx) =>
      ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(profile?.firstAiWorkoutCompletedAt).toBeUndefined();
  });
});
