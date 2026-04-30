/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

type CheckInPreferences = {
  enabled: boolean;
  frequency: "daily" | "every_other_day" | "weekly";
  muted: boolean;
};

async function insertUserWithProfile(
  t: ReturnType<typeof convexTest>,
  overrides: { checkInPreferences?: CheckInPreferences } = {},
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
  test("includes users with no preferences (defaults to enabled + not muted)", async () => {
    const t = convexTest(schema, modules);
    const userId = await insertUserWithProfile(t);

    const result = await t.query(internal.checkIns.getEligibleUserIdsPage, {
      paginationOpts: { cursor: null, numItems: 100 },
    });

    expect(result.page).toContain(userId);
  });

  test("includes users with enabled=true and muted=false", async () => {
    const t = convexTest(schema, modules);
    const userId = await insertUserWithProfile(t, {
      checkInPreferences: { enabled: true, frequency: "daily", muted: false },
    });

    const result = await t.query(internal.checkIns.getEligibleUserIdsPage, {
      paginationOpts: { cursor: null, numItems: 100 },
    });

    expect(result.page).toContain(userId);
  });

  test("excludes users who have disabled check-ins", async () => {
    const t = convexTest(schema, modules);
    const userId = await insertUserWithProfile(t, {
      checkInPreferences: { enabled: false, frequency: "daily", muted: false },
    });

    const result = await t.query(internal.checkIns.getEligibleUserIdsPage, {
      paginationOpts: { cursor: null, numItems: 100 },
    });

    expect(result.page).not.toContain(userId);
  });

  test("excludes users who have muted check-ins", async () => {
    const t = convexTest(schema, modules);
    const userId = await insertUserWithProfile(t, {
      checkInPreferences: { enabled: true, frequency: "daily", muted: true },
    });

    const result = await t.query(internal.checkIns.getEligibleUserIdsPage, {
      paginationOpts: { cursor: null, numItems: 100 },
    });

    expect(result.page).not.toContain(userId);
  });
});

describe("runCheckInTriggerEvaluation", () => {
  test("completes without error when no users are eligible", async () => {
    const t = convexTest(schema, modules);

    await t.action(internal.checkIns.runCheckInTriggerEvaluation, {});
  });

  test("exits before processing any user when deadline is already past", async () => {
    // _deadlineOffsetMs: -1 makes deadline = Date.now() - 1 which is already
    // past. The first iteration of the while-loop sees Date.now() >= deadline
    // and breaks without fetching any user page or evaluating any triggers.
    const t = convexTest(schema, modules);
    await insertUserWithProfile(t);

    await t.action(internal.checkIns.runCheckInTriggerEvaluation, {
      _deadlineOffsetMs: -1,
    });

    const checkIns = await t.run((ctx) => ctx.db.query("checkIns").collect());
    expect(checkIns).toHaveLength(0);
  });
});
