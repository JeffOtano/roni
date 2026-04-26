/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import {
  TIER_INTERVAL_SLACK_MS,
  TIER_INTERVALS_MS,
  TIER_THRESHOLDS_MS,
} from "./cacheRefreshTiering";

// Vite normalizes same-directory glob keys to "./foo.ts" instead of
// "../tonal/foo.ts", which breaks convex-test module resolution.
// Remap ./foo.ts -> ../tonal/foo.ts to match the expected path format.
const rawModules = import.meta.glob("../**/*.*s");
const modules: typeof rawModules = {};
for (const [key, value] of Object.entries(rawModules)) {
  modules[key.startsWith("./") ? "../tonal/" + key.slice(2) : key] = value;
}

afterEach(() => {
  vi.useRealTimers();
});

const TODAY_ISO = "2026-04-25";
const FROZEN_NOW = Date.UTC(2026, 3, 25, 12, 0, 0);

async function seedConnectedUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    const profileId = await ctx.db.insert("userProfiles", {
      userId,
      tonalUserId: "tonal-1",
      tonalToken: "encrypted",
      lastActiveAt: FROZEN_NOW,
      appLastActiveAt: FROZEN_NOW - 60 * 1000,
      lastSyncedActivityDate: TODAY_ISO,
      workoutHistoryCachedAt: FROZEN_NOW - 60 * 1000,
    });
    return { userId, profileId };
  });
}

describe("startSyncUserHistory preflight skip", () => {
  test("records the attempt as lastTonalSyncAt even when the workflow is skipped", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);

    const t = convexTest(schema, modules);
    const { userId, profileId } = await seedConnectedUser(t);

    await t.mutation(internal.tonal.historySync.startSyncUserHistory, { userId });

    const profile = await t.run(async (ctx) => ctx.db.get(profileId));
    expect(profile?.lastTonalSyncAt).toBe(FROZEN_NOW);
    expect(profile?.nextTonalSyncAt).toBe(
      FROZEN_NOW + TIER_INTERVALS_MS.active - TIER_INTERVAL_SLACK_MS,
    );
  });

  test("clears nextTonalSyncAt for skip-tier users so the index drops them", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);

    const t = convexTest(schema, modules);
    const { userId, profileId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      const profileId = await ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: "tonal-stale",
        tonalToken: "encrypted",
        lastActiveAt: FROZEN_NOW - TIER_THRESHOLDS_MS.lapsing - 60 * 1000,
        appLastActiveAt: FROZEN_NOW - TIER_THRESHOLDS_MS.lapsing - 60 * 1000,
        lastTonalSyncAt: FROZEN_NOW - 12 * 60 * 60 * 1000,
        nextTonalSyncAt: FROZEN_NOW - 60 * 1000,
      });
      return { userId, profileId };
    });

    await t.mutation(internal.tonal.historySync.startSyncUserHistory, { userId });

    const profile = await t.run(async (ctx) => ctx.db.get(profileId));
    expect(profile?.nextTonalSyncAt).toBeUndefined();
    expect(profile?.lastTonalSyncAt).toBe(FROZEN_NOW - 12 * 60 * 60 * 1000);
  });

  test("recomputes nextTonalSyncAt when the user shifted to a longer tier", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);

    const t = convexTest(schema, modules);
    const tierShiftedSyncAt = FROZEN_NOW - 35 * 60 * 1000;

    const { userId, profileId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      const profileId = await ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: "tonal-shifted",
        tonalToken: "encrypted",
        lastActiveAt: FROZEN_NOW - 5 * 60 * 60 * 1000,
        appLastActiveAt: FROZEN_NOW - 5 * 60 * 60 * 1000,
        lastTonalSyncAt: tierShiftedSyncAt,
        nextTonalSyncAt: FROZEN_NOW - 60 * 1000,
      });
      return { userId, profileId };
    });

    await t.mutation(internal.tonal.historySync.startSyncUserHistory, { userId });

    const profile = await t.run(async (ctx) => ctx.db.get(profileId));
    expect(profile?.nextTonalSyncAt).toBe(
      tierShiftedSyncAt + TIER_INTERVALS_MS.recent - TIER_INTERVAL_SLACK_MS,
    );
    expect(profile?.lastTonalSyncAt).toBe(tierShiftedSyncAt);
  });

  test("does not pull the workoutHistory cache row during preflight", async () => {
    // Regression test for the “lean preflight read” review: the mutation must
    // rely on the denormalized profile field, not the bulky cache document.
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);

    const t = convexTest(schema, modules);
    const { userId } = await seedConnectedUser(t);

    // No tonalCache row exists. If the mutation still reads from tonalCache,
    // shouldSkipBackgroundSync would receive workoutHistoryCacheFetchedAt =
    // undefined and the skip would NOT fire — the assertion below would fail.
    await t.mutation(internal.tonal.historySync.startSyncUserHistory, { userId });

    const cacheRows = await t.run(async (ctx) => ctx.db.query("tonalCache").collect());
    expect(cacheRows).toHaveLength(0);
  });
});

describe("getUsersDueForRefresh", () => {
  test("returns only users whose nextTonalSyncAt has elapsed", async () => {
    const t = convexTest(schema, modules);

    const { dueUserId } = await t.run(async (ctx) => {
      const dueUserId = await ctx.db.insert("users", {});
      await ctx.db.insert("userProfiles", {
        userId: dueUserId,
        tonalUserId: "tonal-due",
        tonalToken: "encrypted",
        lastActiveAt: FROZEN_NOW,
        appLastActiveAt: FROZEN_NOW - 60 * 1000,
        nextTonalSyncAt: FROZEN_NOW - 60 * 1000,
      });

      const notYetUserId = await ctx.db.insert("users", {});
      await ctx.db.insert("userProfiles", {
        userId: notYetUserId,
        tonalUserId: "tonal-not-yet",
        tonalToken: "encrypted",
        lastActiveAt: FROZEN_NOW,
        appLastActiveAt: FROZEN_NOW - 60 * 1000,
        nextTonalSyncAt: FROZEN_NOW + 60 * 60 * 1000,
      });

      const undefinedUserId = await ctx.db.insert("users", {});
      await ctx.db.insert("userProfiles", {
        userId: undefinedUserId,
        tonalUserId: "tonal-undefined",
        tonalToken: "encrypted",
        lastActiveAt: FROZEN_NOW,
        appLastActiveAt: FROZEN_NOW - 60 * 1000,
      });

      return { dueUserId };
    });

    const due = await t.query(internal.userActivity.getUsersDueForRefresh, { now: FROZEN_NOW });
    expect(due).toHaveLength(1);
    expect(due[0]?.userId).toBe(dueUserId);
  });
});

describe("setCacheEntry workoutHistory denormalization", () => {
  test("mirrors the workoutHistory_v3 fetchedAt onto userProfiles", async () => {
    const t = convexTest(schema, modules);

    const { userId, profileId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      const profileId = await ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: "tonal-1",
        tonalToken: "encrypted",
        lastActiveAt: FROZEN_NOW,
      });
      return { userId, profileId };
    });

    await t.mutation(internal.tonal.cache.setCacheEntry, {
      userId,
      dataType: "workoutHistory_v3",
      data: [],
      fetchedAt: FROZEN_NOW,
      expiresAt: FROZEN_NOW + 30 * 60 * 1000,
    });

    const profile = await t.run(async (ctx) => ctx.db.get(profileId));
    expect(profile?.workoutHistoryCachedAt).toBe(FROZEN_NOW);
  });

  test("does not denormalize for unrelated cache types", async () => {
    const t = convexTest(schema, modules);

    const { userId, profileId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      const profileId = await ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: "tonal-1",
        tonalToken: "encrypted",
        lastActiveAt: FROZEN_NOW,
      });
      return { userId, profileId };
    });

    await t.mutation(internal.tonal.cache.setCacheEntry, {
      userId,
      dataType: "strengthScores",
      data: [],
      fetchedAt: FROZEN_NOW,
      expiresAt: FROZEN_NOW + 60 * 60 * 1000,
    });

    const profile = await t.run(async (ctx) => ctx.db.get(profileId));
    expect(profile?.workoutHistoryCachedAt).toBeUndefined();
  });
});
