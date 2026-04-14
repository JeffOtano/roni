/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

// Vite normalizes same-directory glob keys to "./foo.ts" instead of
// "../tonal/foo.ts", which breaks convex-test module resolution.
// Remap ./foo.ts -> ../tonal/foo.ts to match the expected path format.
const rawModules = import.meta.glob("../**/*.*s");
const modules: typeof rawModules = {};
for (const [key, value] of Object.entries(rawModules)) {
  modules[key.startsWith("./") ? "../tonal/" + key.slice(2) : key] = value;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ctx.db.insert("users", {}));
}

const baseReadiness = {
  chest: 0.8,
  shoulders: 0.7,
  back: 0.9,
  triceps: 0.75,
  biceps: 0.85,
  abs: 0.6,
  obliques: 0.65,
  quads: 0.5,
  glutes: 0.55,
  hamstrings: 0.6,
  calves: 0.7,
};

// ---------------------------------------------------------------------------
// persistCurrentStrengthScores
// ---------------------------------------------------------------------------

describe("persistCurrentStrengthScores", () => {
  test("inserts scores and they exist in DB", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: [
        { bodyRegion: "upper", score: 120 },
        { bodyRegion: "lower", score: 95 },
      ],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("currentStrengthScores")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows).toHaveLength(2);
    const regions = rows.map((r) => r.bodyRegion).sort();
    expect(regions).toEqual(["lower", "upper"]);
  });

  test("second call replaces existing scores", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: [{ bodyRegion: "upper", score: 100 }],
    });

    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: [
        { bodyRegion: "upper", score: 110 },
        { bodyRegion: "core", score: 80 },
      ],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("currentStrengthScores")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows).toHaveLength(2);
    const upper = rows.find((r) => r.bodyRegion === "upper");
    expect(upper?.score).toBe(110);
  });

  test("empty scores array deletes all existing", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: [{ bodyRegion: "upper", score: 100 }],
    });

    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: [],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("currentStrengthScores")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// persistMuscleReadiness
// ---------------------------------------------------------------------------

describe("persistMuscleReadiness", () => {
  test("inserts a readiness snapshot", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistMuscleReadiness, {
      userId,
      readiness: baseReadiness,
    });

    const row = await t.run(async (ctx) =>
      ctx.db
        .query("muscleReadiness")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(row).not.toBeNull();
    expect(row?.chest).toBe(0.8);
  });

  test("second call replaces so only one row exists with new values", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistMuscleReadiness, {
      userId,
      readiness: baseReadiness,
    });

    const updated = { ...baseReadiness, chest: 0.95, quads: 0.3 };
    await t.mutation(internal.tonal.historySyncMutations.persistMuscleReadiness, {
      userId,
      readiness: updated,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("muscleReadiness")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].chest).toBe(0.95);
    expect(rows[0].quads).toBe(0.3);
  });
});

// ---------------------------------------------------------------------------
// persistExternalActivities
// ---------------------------------------------------------------------------

const baseActivity = {
  externalId: "ext-1",
  workoutType: "run",
  beginTime: "2024-01-15T08:00:00Z",
  totalDuration: 1800,
  activeCalories: 300,
  totalCalories: 350,
  averageHeartRate: 145,
  source: "apple_health",
  distance: 5.0,
};

describe("persistExternalActivities", () => {
  test("inserts new activities", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId,
      activities: [baseActivity],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("externalActivities")
        .withIndex("by_userId_externalId", (q) => q.eq("userId", userId).eq("externalId", "ext-1"))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].workoutType).toBe("run");
  });

  test("upserts existing activity by externalId without duplicating", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId,
      activities: [baseActivity],
    });

    const updated = { ...baseActivity, totalCalories: 400, averageHeartRate: 150 };
    await t.mutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId,
      activities: [updated],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("externalActivities")
        .withIndex("by_userId_externalId", (q) => q.eq("userId", userId).eq("externalId", "ext-1"))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].totalCalories).toBe(400);
    expect(rows[0].averageHeartRate).toBe(150);
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
