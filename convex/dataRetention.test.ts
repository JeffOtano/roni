/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { RETENTION } from "./dataRetention";

const modules = import.meta.glob("./**/*.*s");

const DAY_MS = 24 * 60 * 60 * 1000;

describe("data retention constants", () => {
  it("AI usage retention is 90 days", () => {
    expect(RETENTION.aiUsageDays).toBe(90);
  });

  it("AI tool calls retention is 30 days", () => {
    expect(RETENTION.aiToolCallsDays).toBe(30);
  });

  it("expired cache retention is 24 hours", () => {
    expect(RETENTION.expiredCacheHours).toBe(24);
  });

  it("AI run telemetry retention is 90 days", () => {
    expect(RETENTION.aiRunDays).toBe(90);
  });

  it("strength score snapshot retention is 24 months (730 days)", () => {
    expect(RETENTION.strengthScoreSnapshotDays).toBe(730);
  });
});

describe("runDataRetention", () => {
  test("prunes aiRun rows older than the retention window", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));

    const oldRunId = await t.run(async (ctx) =>
      ctx.db.insert("aiRun", {
        runId: "old-run",
        userId,
        threadId: "thread-1",
        source: "chat",
        environment: "prod",
        totalSteps: 1,
        toolSequence: [],
        retryCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        approvalPauses: 0,
        createdAt: now - (RETENTION.aiRunDays + 5) * DAY_MS,
      }),
    );
    const freshRunId = await t.run(async (ctx) =>
      ctx.db.insert("aiRun", {
        runId: "fresh-run",
        userId,
        threadId: "thread-1",
        source: "chat",
        environment: "prod",
        totalSteps: 1,
        toolSequence: [],
        retryCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        approvalPauses: 0,
        createdAt: now - 1 * DAY_MS,
      }),
    );

    await t.action(internal.dataRetention.runDataRetention, {});

    const remaining = await t.run(async (ctx) =>
      ctx.db
        .query("aiRun")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    const remainingIds = remaining.map((r) => r._id);
    expect(remainingIds).toContain(freshRunId);
    expect(remainingIds).not.toContain(oldRunId);
  });

  test("prunes strengthScoreSnapshots older than 24 months", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));

    const oldSnapshotId = await t.run(async (ctx) =>
      ctx.db.insert("strengthScoreSnapshots", {
        userId,
        date: "2023-01-01",
        overall: 100,
        upper: 90,
        lower: 110,
        core: 95,
        syncedAt: now - (RETENTION.strengthScoreSnapshotDays + 5) * DAY_MS,
      }),
    );
    const freshSnapshotId = await t.run(async (ctx) =>
      ctx.db.insert("strengthScoreSnapshots", {
        userId,
        date: "2025-12-01",
        overall: 200,
        upper: 180,
        lower: 220,
        core: 210,
        syncedAt: now - 1 * DAY_MS,
      }),
    );

    await t.action(internal.dataRetention.runDataRetention, {});

    const remaining = await t.run(async (ctx) =>
      ctx.db
        .query("strengthScoreSnapshots")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    const remainingIds = remaining.map((r) => r._id);
    expect(remainingIds).toContain(freshSnapshotId);
    expect(remainingIds).not.toContain(oldSnapshotId);
  });

  test("preserves completed workouts, exercise performance, and personal records", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));
    const ancientSync = now - 5 * 365 * DAY_MS;

    await t.run(async (ctx) => {
      await ctx.db.insert("completedWorkouts", {
        userId,
        activityId: "act-1",
        date: "2020-01-01",
        title: "Old Workout",
        targetArea: "Upper",
        totalVolume: 1000,
        totalDuration: 1800,
        totalWork: 5000,
        workoutType: "STRENGTH",
        syncedAt: ancientSync,
      });
      await ctx.db.insert("exercisePerformance", {
        userId,
        activityId: "act-1",
        movementId: "m-1",
        date: "2020-01-01",
        sets: 3,
        totalReps: 30,
        avgWeightLbs: 100,
        totalVolume: 3000,
        syncedAt: ancientSync,
      });
      await ctx.db.insert("personalRecords", {
        userId,
        movementId: "m-1",
        bestAvgWeightLbs: 100,
        achievedActivityId: "act-1",
        achievedDate: "2020-01-01",
        totalSessions: 1,
        updatedAt: ancientSync,
      });
    });

    await t.action(internal.dataRetention.runDataRetention, {});

    const counts = await t.run(async (ctx) => {
      const cw = await ctx.db
        .query("completedWorkouts")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const ep = await ctx.db
        .query("exercisePerformance")
        .withIndex("by_userId_activityId", (q) => q.eq("userId", userId).eq("activityId", "act-1"))
        .collect();
      const pr = await ctx.db
        .query("personalRecords")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      return { cw: cw.length, ep: ep.length, pr: pr.length };
    });
    expect(counts).toEqual({ cw: 1, ep: 1, pr: 1 });
  });
});
