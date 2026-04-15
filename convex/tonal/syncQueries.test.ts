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
// getCurrentStrengthScores
// ---------------------------------------------------------------------------

describe("getCurrentStrengthScores", () => {
  test("returns empty array when no data", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const result = await t.query(internal.tonal.syncQueries.getCurrentStrengthScores, { userId });
    expect(result).toEqual([]);
  });

  test("returns all scores for a user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("currentStrengthScores", {
        userId,
        bodyRegion: "upper",
        score: 120,
        fetchedAt: now,
      });
      await ctx.db.insert("currentStrengthScores", {
        userId,
        bodyRegion: "lower",
        score: 95,
        fetchedAt: now,
      });
    });

    const result = await t.query(internal.tonal.syncQueries.getCurrentStrengthScores, { userId });
    expect(result).toHaveLength(2);
    const regions = result.map((r) => r.bodyRegion).sort();
    expect(regions).toEqual(["lower", "upper"]);
  });

  test("does not return other users scores", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const otherId = await createUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("currentStrengthScores", {
        userId: otherId,
        bodyRegion: "upper",
        score: 130,
        fetchedAt: Date.now(),
      });
    });

    const result = await t.query(internal.tonal.syncQueries.getCurrentStrengthScores, { userId });
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getMuscleReadiness
// ---------------------------------------------------------------------------

describe("getMuscleReadiness", () => {
  test("returns null when no data", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const result = await t.query(internal.tonal.syncQueries.getMuscleReadiness, { userId });
    expect(result).toBeNull();
  });

  test("returns the readiness row", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("muscleReadiness", { userId, ...baseReadiness, fetchedAt: Date.now() });
    });

    const result = await t.query(internal.tonal.syncQueries.getMuscleReadiness, { userId });
    expect(result).not.toBeNull();
    expect(result?.chest).toBe(0.8);
    expect(result?.quads).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// getRecentCompletedWorkouts
// ---------------------------------------------------------------------------

const baseWorkout = {
  activityId: "act-1",
  date: "2024-01-15",
  title: "Push Day",
  targetArea: "chest",
  totalVolume: 10000,
  totalDuration: 3600,
  totalWork: 8000,
  workoutType: "strength",
  syncedAt: Date.now(),
};

describe("getRecentCompletedWorkouts", () => {
  test("returns empty array when no data", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const result = await t.query(internal.tonal.syncQueries.getRecentCompletedWorkouts, {
      userId,
      limit: 10,
    });
    expect(result).toEqual([]);
  });

  test("returns workouts ordered by date descending", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("completedWorkouts", {
        userId,
        ...baseWorkout,
        activityId: "act-1",
        date: "2024-01-10",
      });
      await ctx.db.insert("completedWorkouts", {
        userId,
        ...baseWorkout,
        activityId: "act-2",
        date: "2024-01-15",
      });
      await ctx.db.insert("completedWorkouts", {
        userId,
        ...baseWorkout,
        activityId: "act-3",
        date: "2024-01-05",
      });
    });

    const result = await t.query(internal.tonal.syncQueries.getRecentCompletedWorkouts, {
      userId,
      limit: 10,
    });
    expect(result).toHaveLength(3);
    expect(result[0].date).toBe("2024-01-15");
    expect(result[1].date).toBe("2024-01-10");
    expect(result[2].date).toBe("2024-01-05");
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.run(async (ctx) => {
      for (let i = 1; i <= 5; i++) {
        await ctx.db.insert("completedWorkouts", {
          userId,
          ...baseWorkout,
          activityId: `act-${i}`,
          date: `2024-01-${String(i).padStart(2, "0")}`,
        });
      }
    });

    const result = await t.query(internal.tonal.syncQueries.getRecentCompletedWorkouts, {
      userId,
      limit: 2,
    });
    expect(result).toHaveLength(2);
  });

  test("filters out ghost entries with empty title", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("completedWorkouts", {
        userId,
        ...baseWorkout,
        activityId: "real-1",
        date: "2024-01-15",
        title: "Push Day",
      });
      await ctx.db.insert("completedWorkouts", {
        userId,
        ...baseWorkout,
        activityId: "ghost-1",
        date: "2024-01-14",
        title: "",
        workoutType: "",
        totalVolume: 0,
        totalWork: 0,
      });
      await ctx.db.insert("completedWorkouts", {
        userId,
        ...baseWorkout,
        activityId: "real-2",
        date: "2024-01-13",
        title: "Pull Day",
      });
    });

    const result = await t.query(internal.tonal.syncQueries.getRecentCompletedWorkouts, {
      userId,
      limit: 10,
    });
    expect(result).toHaveLength(2);
    expect(result[0].activityId).toBe("real-1");
    expect(result[1].activityId).toBe("real-2");
  });
});

// ---------------------------------------------------------------------------
// getRecentExternalActivities
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
  syncedAt: Date.now(),
};

describe("getRecentExternalActivities", () => {
  test("returns empty array when no data", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    const result = await t.query(internal.tonal.syncQueries.getRecentExternalActivities, {
      userId,
      limit: 10,
    });
    expect(result).toEqual([]);
  });

  test("returns activities ordered by beginTime descending", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("externalActivities", {
        userId,
        ...baseActivity,
        externalId: "ext-1",
        beginTime: "2024-01-10T08:00:00Z",
      });
      await ctx.db.insert("externalActivities", {
        userId,
        ...baseActivity,
        externalId: "ext-2",
        beginTime: "2024-01-15T08:00:00Z",
      });
      await ctx.db.insert("externalActivities", {
        userId,
        ...baseActivity,
        externalId: "ext-3",
        beginTime: "2024-01-05T08:00:00Z",
      });
    });

    const result = await t.query(internal.tonal.syncQueries.getRecentExternalActivities, {
      userId,
      limit: 10,
    });
    expect(result).toHaveLength(3);
    expect(result[0].beginTime).toBe("2024-01-15T08:00:00Z");
    expect(result[1].beginTime).toBe("2024-01-10T08:00:00Z");
    expect(result[2].beginTime).toBe("2024-01-05T08:00:00Z");
  });

  test("respects limit parameter", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.run(async (ctx) => {
      for (let i = 1; i <= 4; i++) {
        await ctx.db.insert("externalActivities", {
          userId,
          ...baseActivity,
          externalId: `ext-${i}`,
          beginTime: `2024-01-${String(i).padStart(2, "0")}T08:00:00Z`,
        });
      }
    });

    const result = await t.query(internal.tonal.syncQueries.getRecentExternalActivities, {
      userId,
      limit: 2,
    });
    expect(result).toHaveLength(2);
  });
});
