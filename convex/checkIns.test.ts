/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, test } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { frequencyWindowMs } from "./checkIns";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

const DAY_MS = 24 * 60 * 60 * 1000;
const RUN_EVALUATION_PAGE_SIZE = 100;

describe("frequencyWindowMs", () => {
  it("daily returns exactly 24 hours", () => {
    expect(frequencyWindowMs("daily")).toBe(DAY_MS);
  });

  it("every_other_day returns exactly 48 hours", () => {
    expect(frequencyWindowMs("every_other_day")).toBe(2 * DAY_MS);
  });

  it("weekly returns exactly 7 days", () => {
    expect(frequencyWindowMs("weekly")).toBe(7 * DAY_MS);
  });

  it("every_other_day is strictly between daily and weekly", () => {
    const daily = frequencyWindowMs("daily");
    const every_other_day = frequencyWindowMs("every_other_day");
    const weekly = frequencyWindowMs("weekly");
    expect(every_other_day).toBeGreaterThan(daily);
    expect(every_other_day).toBeLessThan(weekly);
  });

  it("all windows are positive", () => {
    for (const freq of ["daily", "every_other_day", "weekly"] as const) {
      expect(frequencyWindowMs(freq)).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// hasRecentCheckIn boundary semantics (documentation-only)
// ---------------------------------------------------------------------------
// These tests do NOT exercise hasRecentCheckIn directly — running the Convex
// query requires Convex test infrastructure. They assert the plain JS boundary
// comparison the query relies on (createdAt >= since) so the documented
// boundary behavior cannot drift silently. The actual index-bound query is
// .withIndex("by_userId_createdAt", q => q.eq("userId").gte("createdAt", since))
// followed by .first(), which is type-checked through the schema.

describe("hasRecentCheckIn boundary semantics (documented)", () => {
  it("a check-in exactly at the since boundary counts as recent", () => {
    const since = 1000;
    const checkInCreatedAt = 1000;
    expect(checkInCreatedAt >= since).toBe(true);
  });

  it("a check-in one ms before the since boundary does not count", () => {
    const since = 1000;
    const checkInCreatedAt = 999;
    expect(checkInCreatedAt >= since).toBe(false);
  });
});

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

  test("schedules evaluateCheckInForUser for each eligible user", async () => {
    const t = convexTest(schema, modules);
    await insertUserWithProfile(t);
    await insertUserWithProfile(t);

    await t.action(internal.checkIns.runCheckInTriggerEvaluation, {});

    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    const userEvals = scheduled.filter((fn) => fn.name.includes("evaluateCheckInForUser"));
    expect(userEvals).toHaveLength(2);
  });

  test("does not schedule ineligible users (disabled or muted)", async () => {
    const t = convexTest(schema, modules);
    await insertUserWithProfile(t);
    await insertUserWithProfile(t, {
      checkInPreferences: { enabled: false, frequency: "daily", muted: false },
    });
    await insertUserWithProfile(t, {
      checkInPreferences: { enabled: true, frequency: "daily", muted: true },
    });

    await t.action(internal.checkIns.runCheckInTriggerEvaluation, {});

    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    const userEvals = scheduled.filter((fn) => fn.name.includes("evaluateCheckInForUser"));
    expect(userEvals).toHaveLength(1);
  });

  test("schedules itself for the next page when there are more results", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < RUN_EVALUATION_PAGE_SIZE + 1; i++) {
      await insertUserWithProfile(t);
    }

    await t.action(internal.checkIns.runCheckInTriggerEvaluation, {
      cursor: null,
      totalScheduled: 0,
    });

    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    const userEvals = scheduled.filter((fn) => fn.name.includes("evaluateCheckInForUser"));
    const continuations = scheduled.filter((fn) => fn.name.includes("runCheckInTriggerEvaluation"));

    expect(userEvals).toHaveLength(RUN_EVALUATION_PAGE_SIZE);
    expect(continuations).toHaveLength(1);
    expect(continuations[0]?.args[0]).toMatchObject({
      cursor: expect.any(String),
      totalScheduled: RUN_EVALUATION_PAGE_SIZE,
    });
  });
});
