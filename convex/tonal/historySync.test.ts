/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

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
const WORKOUT_HISTORY_CACHE_TYPE = "workoutHistory_v3";
const WORKOUT_HISTORY_TTL_MS = 30 * 60 * 1000;

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

    await t.run(async (ctx) => {
      await ctx.db.insert("tonalCache", {
        userId,
        dataType: WORKOUT_HISTORY_CACHE_TYPE,
        data: [],
        fetchedAt: FROZEN_NOW - 60 * 1000,
        expiresAt: FROZEN_NOW + WORKOUT_HISTORY_TTL_MS - 60 * 1000,
      });
    });

    await t.mutation(internal.tonal.historySync.startSyncUserHistory, { userId });

    const profile = await t.run(async (ctx) => ctx.db.get(profileId));
    expect(profile?.lastTonalSyncAt).toBe(FROZEN_NOW);
  });
});
