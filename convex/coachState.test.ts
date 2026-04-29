/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { safe } from "./coachState";

const modules = import.meta.glob("./**/*.*s");

async function createUser(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ctx.db.insert("users", {}));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("safe", () => {
  test("returns the fallback and logs the error when the read function rejects", async () => {
    const fallback: number[] = [];
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = new Error("boom");

    const result = await safe(
      async () => {
        throw boom;
      },
      fallback,
      "testSource",
    );

    expect(result).toBe(fallback);
    expect(errSpy).toHaveBeenCalledWith("gatherSnapshotInputs: testSource read failed", boom);
    errSpy.mockRestore();
  });

  test("returns the read value when the read function resolves", async () => {
    const result = await safe(async () => [1, 2, 3], [] as number[], "testSource");
    expect(result).toEqual([1, 2, 3]);
  });
});

describe("gatherSnapshotInputs", () => {
  test("returns aggregated reads across all 10 sub-domains", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: "tonal-1",
        tonalToken: "encrypted",
        profileData: {
          firstName: "Alice",
          lastName: "Lifter",
          heightInches: 66,
          weightPounds: 150,
          level: "intermediate",
          workoutsPerWeek: 4,
          workoutDurationMin: 30,
          workoutDurationMax: 60,
        },
        lastActiveAt: now,
      });
      await ctx.db.insert("currentStrengthScores", {
        userId,
        bodyRegion: "Upper",
        score: 450,
        fetchedAt: now,
      });
      await ctx.db.insert("muscleReadiness", {
        userId,
        chest: 80,
        shoulders: 70,
        back: 85,
        triceps: 75,
        biceps: 78,
        abs: 90,
        obliques: 85,
        quads: 60,
        glutes: 65,
        hamstrings: 70,
        calves: 75,
        fetchedAt: now,
      });
      await ctx.db.insert("completedWorkouts", {
        userId,
        activityId: "act-w1",
        tonalWorkoutId: "w1",
        title: "Push Day",
        date: "2026-04-23",
        targetArea: "Upper",
        totalVolume: 5000,
        totalDuration: 1800,
        totalWork: 4500,
        workoutType: "strength",
        syncedAt: now,
      });
      // Ghost row should be filtered out by readRecentCompletedWorkouts.
      await ctx.db.insert("completedWorkouts", {
        userId,
        activityId: "act-ghost",
        tonalWorkoutId: "ghost",
        title: "",
        date: "2026-04-22",
        targetArea: "Upper",
        totalVolume: 0,
        totalDuration: 0,
        totalWork: 0,
        workoutType: "strength",
        syncedAt: now,
      });
      await ctx.db.insert("trainingBlocks", {
        userId,
        label: "Building",
        blockType: "building",
        weekNumber: 2,
        totalWeeks: 3,
        startDate: "2026-04-13",
        status: "active",
        createdAt: now,
      });
      await ctx.db.insert("workoutFeedback", {
        userId,
        activityId: "act-1",
        rpe: 8,
        rating: 4,
        createdAt: now,
      });
      await ctx.db.insert("goals", {
        userId,
        title: "Bench +20",
        category: "strength",
        metric: "bench_press_avg_weight",
        baselineValue: 100,
        targetValue: 120,
        currentValue: 110,
        deadline: "2026-06-01",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("injuries", {
        userId,
        area: "left shoulder",
        severity: "mild",
        avoidance: "overhead press",
        reportedAt: now,
        status: "active",
      });
      await ctx.db.insert("externalActivities", {
        userId,
        externalId: "ext-1",
        source: "Apple Watch",
        workoutType: "running",
        beginTime: "2026-04-22T14:00:00Z",
        totalDuration: 1800,
        distance: 5000,
        activeCalories: 300,
        totalCalories: 350,
        averageHeartRate: 145,
        syncedAt: now,
      });
      await ctx.db.insert("garminWellnessDaily", {
        userId,
        calendarDate: "2026-04-23",
        sleepDurationSeconds: 25200,
        hrvLastNightAvg: 50,
        avgStress: 40,
        bodyBatteryHighestValue: 85,
        bodyBatteryLowestValue: 30,
        lastIngestedAt: now,
      });
    });

    const inputs = await t.query(internal.coachState.gatherSnapshotInputs, { userId });

    expect(inputs.profile?.profileData?.firstName).toBe("Alice");
    expect(inputs.scores).toHaveLength(1);
    expect(inputs.scores[0].bodyRegion).toBe("Upper");
    expect(inputs.readiness?.chest).toBe(80);
    expect(inputs.activities).toHaveLength(1);
    expect(inputs.activities[0].title).toBe("Push Day");
    expect(inputs.activeBlock?.blockType).toBe("building");
    expect(inputs.recentFeedback).toHaveLength(1);
    expect(inputs.recentFeedback[0].rpe).toBe(8);
    expect(inputs.activeGoals).toHaveLength(1);
    expect(inputs.activeGoals[0].title).toBe("Bench +20");
    expect(inputs.activeInjuries).toHaveLength(1);
    expect(inputs.activeInjuries[0].area).toBe("left shoulder");
    expect(inputs.externalActivities).toHaveLength(1);
    expect(inputs.externalActivities[0].source).toBe("Apple Watch");
    expect(inputs.garminWellness).toHaveLength(1);
    expect(inputs.garminWellness[0].calendarDate).toBe("2026-04-23");
  });

  test("returns empty arrays and nulls for sub-domains the user has no data in", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const now = Date.now();

    // Only a profile, nothing else.
    await t.run(async (ctx) => {
      await ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: "tonal-1",
        tonalToken: "encrypted",
        profileData: {
          firstName: "Bob",
          lastName: "Newbie",
          heightInches: 70,
          weightPounds: 170,
          level: "beginner",
          workoutsPerWeek: 3,
          workoutDurationMin: 30,
          workoutDurationMax: 45,
        },
        lastActiveAt: now,
      });
    });

    const inputs = await t.query(internal.coachState.gatherSnapshotInputs, { userId });

    expect(inputs.profile?.profileData?.firstName).toBe("Bob");
    expect(inputs.scores).toEqual([]);
    expect(inputs.readiness).toBeNull();
    expect(inputs.activities).toEqual([]);
    expect(inputs.activeBlock).toBeNull();
    expect(inputs.recentFeedback).toEqual([]);
    expect(inputs.activeGoals).toEqual([]);
    expect(inputs.activeInjuries).toEqual([]);
    expect(inputs.externalActivities).toEqual([]);
    expect(inputs.garminWellness).toEqual([]);
  });

  test("returns null profile for users with deletion in progress", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", { deletionInProgress: true }));

    await t.run(async (ctx) => {
      await ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: "tonal-1",
        tonalToken: "encrypted",
        profileData: {
          firstName: "Bob",
          lastName: "Deleted",
          heightInches: 70,
          weightPounds: 170,
          level: "beginner",
          workoutsPerWeek: 3,
          workoutDurationMin: 30,
          workoutDurationMax: 45,
        },
        lastActiveAt: Date.now(),
      });
    });

    const inputs = await t.query(internal.coachState.gatherSnapshotInputs, { userId });

    expect(inputs.profile).toBeNull();
  });
});
