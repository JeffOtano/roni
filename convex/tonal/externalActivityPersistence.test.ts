/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { EXTERNAL_ACTIVITY_SOURCES } from "./externalActivitySources";

// Vite normalizes same-directory glob keys to "./foo.ts" instead of
// "../tonal/foo.ts", which breaks convex-test module resolution.
// Remap ./foo.ts -> ../tonal/foo.ts to match the expected path format.
const rawModules = import.meta.glob("../**/*.*s");
const modules: typeof rawModules = {};
for (const [key, value] of Object.entries(rawModules)) {
  modules[key.startsWith("./") ? "../tonal/" + key.slice(2) : key] = value;
}

async function createUser(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ctx.db.insert("users", {}));
}

const baseActivity = {
  externalId: "ext-1",
  workoutType: "run",
  beginTime: "2024-01-15T08:00:00Z",
  totalDuration: 1800,
  activeCalories: 300,
  totalCalories: 350,
  averageHeartRate: 145,
  source: EXTERNAL_ACTIVITY_SOURCES.APPLE_HEALTH,
  distance: 5.0,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("persistExternalActivities", () => {
  test("inserts new activities and skips unchanged rewrites", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId,
      activities: [baseActivity],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("externalActivities")
        .withIndex("by_userId_source_externalId", (q) =>
          q.eq("userId", userId).eq("source", "appleHealth").eq("externalId", "ext-1"),
        )
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].workoutType).toBe("run");

    vi.setSystemTime(2000);
    await t.mutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId,
      activities: [baseActivity],
    });

    const after = await t.run(async (ctx) =>
      ctx.db
        .query("externalActivities")
        .withIndex("by_userId_source_externalId", (q) =>
          q.eq("userId", userId).eq("source", "appleHealth").eq("externalId", "ext-1"),
        )
        .collect(),
    );
    expect(after).toHaveLength(1);
    expect(after[0]._id).toBe(rows[0]._id);
    expect(after[0].syncedAt).toBe(1000);
  });

  test("upserts existing activity by externalId without duplicating", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId,
      activities: [baseActivity],
    });

    await t.mutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId,
      activities: [{ ...baseActivity, totalCalories: 400, averageHeartRate: 150 }],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("externalActivities")
        .withIndex("by_userId_source_externalId", (q) =>
          q.eq("userId", userId).eq("source", "appleHealth").eq("externalId", "ext-1"),
        )
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].totalCalories).toBe(400);
    expect(rows[0].averageHeartRate).toBe(150);
  });

  test("keeps same external id separate across sources", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId,
      activities: [
        baseActivity,
        {
          ...baseActivity,
          source: EXTERNAL_ACTIVITY_SOURCES.GARMIN,
          workoutType: "RUNNING",
          totalCalories: 410,
        },
      ],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("externalActivities")
        .withIndex("by_userId_externalId", (q) => q.eq("userId", userId).eq("externalId", "ext-1"))
        .collect(),
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.source).sort()).toEqual(["appleHealth", "garmin"]);
  });

  test("canonicalizes a legacy source when matching an existing row", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("externalActivities", {
        userId,
        ...baseActivity,
        source: "Apple Watch",
        syncedAt: 1000,
      });
    });

    await t.mutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId,
      activities: [{ ...baseActivity, totalCalories: 401 }],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("externalActivities")
        .withIndex("by_userId_externalId", (q) => q.eq("userId", userId).eq("externalId", "ext-1"))
        .collect(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("appleHealth");
    expect(rows[0].totalCalories).toBe(401);
  });

  test("updates Garmin-specific activity fields on resend", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const garminActivity = {
      ...baseActivity,
      source: EXTERNAL_ACTIVITY_SOURCES.GARMIN,
      maxHeartRate: 160,
      elevationGainMeters: 25,
      avgPaceSecondsPerKm: 330,
    };

    await t.mutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId,
      activities: [garminActivity],
    });
    await t.mutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId,
      activities: [
        {
          ...garminActivity,
          maxHeartRate: 171,
          elevationGainMeters: 42,
          avgPaceSecondsPerKm: 318,
        },
      ],
    });

    const row = await t.run(async (ctx) =>
      ctx.db
        .query("externalActivities")
        .withIndex("by_userId_source_externalId", (q) =>
          q.eq("userId", userId).eq("source", "garmin").eq("externalId", "ext-1"),
        )
        .unique(),
    );

    expect(row?.maxHeartRate).toBe(171);
    expect(row?.elevationGainMeters).toBe(42);
    expect(row?.avgPaceSecondsPerKm).toBe(318);
  });

  test("inserts multiple activities in one call", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const second = { ...baseActivity, externalId: "ext-2", beginTime: "2024-01-16T08:00:00Z" };
    await t.mutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId,
      activities: [baseActivity, second],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("externalActivities")
        .withIndex("by_userId_beginTime", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows).toHaveLength(2);
  });
});
