/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import schema from "../schema";

// Vite normalizes same-directory glob keys to "./foo.ts" instead of
// "../migrations/foo.ts", which breaks convex-test module resolution.
// Remap ./foo.ts -> ../migrations/foo.ts to match the expected path format.
const rawModules = import.meta.glob("../**/*.*s");
const modules: typeof rawModules = {};
for (const [key, value] of Object.entries(rawModules)) {
  modules[key.startsWith("./") ? "../migrations/" + key.slice(2) : key] = value;
}

afterEach(() => {
  vi.useRealTimers();
});

const FROZEN_NOW = Date.UTC(2026, 3, 25, 12, 0, 0);

describe("backfillNextTonalSyncAt", () => {
  test("paginates past the first batch and patches every eligible profile", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);

    const t = convexTest(schema, modules);
    const PROFILE_COUNT = 5;

    const profileIds = await t.run(async (ctx) => {
      const ids: Id<"userProfiles">[] = [];
      for (let i = 0; i < PROFILE_COUNT; i++) {
        const userId = await ctx.db.insert("users", {});
        const profileId = await ctx.db.insert("userProfiles", {
          userId,
          tonalUserId: `tonal-${i}`,
          tonalToken: "encrypted",
          lastActiveAt: FROZEN_NOW,
          appLastActiveAt: FROZEN_NOW - 60 * 1000,
        });
        ids.push(profileId);
      }
      return ids;
    });

    // Force a tiny page size to exercise the cursor without inserting hundreds
    // of rows. Multiple iterations are required to exhaust the table.
    let cursor: string | null = null;
    let totalPatched = 0;
    let isDone = false;
    while (!isDone) {
      const result: {
        scanned: number;
        patched: number;
        isDone: boolean;
        continueCursor: string;
      } = await t.mutation(internal.migrations.backfillNextTonalSyncAt.patchBatch, {
        paginationOpts: { numItems: 2, cursor },
      });
      totalPatched += result.patched;
      isDone = result.isDone;
      cursor = result.continueCursor;
    }

    expect(totalPatched).toBe(PROFILE_COUNT);

    const patched = await t.run(async (ctx) => Promise.all(profileIds.map((id) => ctx.db.get(id))));
    for (const profile of patched) {
      expect(profile?.nextTonalSyncAt).toBe(0);
    }
  });

  test("mirrors existing tonalCache.fetchedAt onto userProfiles", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);

    const t = convexTest(schema, modules);

    const profileId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      const profileId = await ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: "tonal-cached",
        tonalToken: "encrypted",
        lastActiveAt: FROZEN_NOW,
        appLastActiveAt: FROZEN_NOW - 60 * 1000,
      });
      await ctx.db.insert("tonalCache", {
        userId,
        dataType: "workoutHistory_v3",
        data: [],
        fetchedAt: FROZEN_NOW - 5 * 60 * 1000,
        expiresAt: FROZEN_NOW + 25 * 60 * 1000,
      });
      return profileId;
    });

    await t.mutation(internal.migrations.backfillNextTonalSyncAt.patchBatch, {
      paginationOpts: { numItems: 100, cursor: null },
    });

    const profile = await t.run(async (ctx) => ctx.db.get(profileId));
    expect(profile?.workoutHistoryCachedAt).toBe(FROZEN_NOW - 5 * 60 * 1000);
  });
});
