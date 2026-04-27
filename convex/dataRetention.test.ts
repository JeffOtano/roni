/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, test } from "vitest";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import schema from "./schema";
import { RETENTION } from "./dataRetention";

const modules = import.meta.glob("./**/*.*s");

const DAY_MS = 24 * 60 * 60 * 1000;

async function insertAiRun(
  t: ReturnType<typeof convexTest>,
  overrides: { userId: Id<"users">; createdAt: number; runId?: string },
): Promise<Id<"aiRun">> {
  return t.run(async (ctx) =>
    ctx.db.insert("aiRun", {
      runId: overrides.runId ?? `run-${overrides.createdAt}`,
      userId: overrides.userId,
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
      createdAt: overrides.createdAt,
    }),
  );
}

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

    const oldRunId = await insertAiRun(t, {
      userId,
      runId: "old-run",
      createdAt: now - (RETENTION.aiRunDays + 5) * DAY_MS,
    });
    const freshRunId = await insertAiRun(t, {
      userId,
      runId: "fresh-run",
      createdAt: now - 1 * DAY_MS,
    });

    await t.action(internal.dataRetention.runDataRetention, {});

    const remaining = await t.run(async (ctx) =>
      ctx.db
        .query("aiRun")
        .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
        .collect(),
    );
    const remainingIds = remaining.map((r) => r._id);
    expect(remainingIds).toContain(freshRunId);
    expect(remainingIds).not.toContain(oldRunId);
  });

  test("deletes more than one batch of aiRun rows in a single action run", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));
    const expiredCreatedAt = now - (RETENTION.aiRunDays + 5) * DAY_MS;

    const TOTAL_EXPIRED = 101;
    for (let i = 0; i < TOTAL_EXPIRED; i++) {
      await insertAiRun(t, {
        userId,
        runId: `expired-${i}`,
        createdAt: expiredCreatedAt - i,
      });
    }
    const freshRunId = await insertAiRun(t, {
      userId,
      runId: "fresh",
      createdAt: now - 1 * DAY_MS,
    });

    await t.action(internal.dataRetention.runDataRetention, {});

    const remaining = await t.run(async (ctx) =>
      ctx.db
        .query("aiRun")
        .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(remaining.map((r) => r._id)).toEqual([freshRunId]);
  });

  test("getExpiredAiRunIds returns rows strictly older than cutoff", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));
    const cutoff = 1_700_000_000_000;

    const olderId = await insertAiRun(t, { userId, runId: "older", createdAt: cutoff - 1 });
    const exactlyAtId = await insertAiRun(t, {
      userId,
      runId: "boundary",
      createdAt: cutoff,
    });
    const newerId = await insertAiRun(t, { userId, runId: "newer", createdAt: cutoff + 1 });

    const result = await t.query(internal.dataRetention.getExpiredAiRunIds, {
      cutoff,
      limit: 100,
    });

    expect(result).toContain(olderId);
    expect(result).not.toContain(exactlyAtId);
    expect(result).not.toContain(newerId);
  });

  test("getExpiredStrengthSnapshotIds returns rows strictly older than cutoff", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));
    const cutoff = 1_700_000_000_000;
    const baseSnapshot = {
      userId,
      date: "2024-01-01",
      overall: 100,
      upper: 90,
      lower: 110,
      core: 95,
    };

    const olderId = await t.run(async (ctx) =>
      ctx.db.insert("strengthScoreSnapshots", { ...baseSnapshot, syncedAt: cutoff - 1 }),
    );
    const exactlyAtId = await t.run(async (ctx) =>
      ctx.db.insert("strengthScoreSnapshots", { ...baseSnapshot, syncedAt: cutoff }),
    );
    const newerId = await t.run(async (ctx) =>
      ctx.db.insert("strengthScoreSnapshots", { ...baseSnapshot, syncedAt: cutoff + 1 }),
    );

    const result = await t.query(internal.dataRetention.getExpiredStrengthSnapshotIds, {
      cutoff,
      limit: 100,
    });

    expect(result).toContain(olderId);
    expect(result).not.toContain(exactlyAtId);
    expect(result).not.toContain(newerId);
  });

  test("completes cleanly when no rows are eligible for pruning", async () => {
    const t = convexTest(schema, modules);

    await expect(t.action(internal.dataRetention.runDataRetention, {})).resolves.toBeNull();
  });

  test("schedules a continuation when the deadline is hit before all rows are pruned", async () => {
    // Regression for TONALCOACH-17: runDataRetention timed out at 600 s when
    // large backlogs existed. The fix adds a time-budget; if time runs out,
    // a continuation is scheduled so the cron picks up where it left off.
    // _deadlineOffsetMs: 0 forces an immediate deadline so every pruneTable
    // call sees Date.now() >= deadline and returns { complete: false }.
    const t = convexTest(schema, modules);
    const now = Date.now();
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));
    const expiredId = await insertAiRun(t, {
      userId,
      runId: "expired",
      createdAt: now - (RETENTION.aiRunDays + 5) * DAY_MS,
    });

    await t.action(internal.dataRetention.runDataRetention, { _deadlineOffsetMs: 0 });

    // Deadline hit before any deletion — row must still be present.
    const afterFirstPass = await t.run(async (ctx) => ctx.db.get(expiredId));
    expect(afterFirstPass).not.toBeNull();

    // A continuation should have been scheduled in _scheduled_functions.
    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(scheduled.some((fn) => fn.name.includes("runDataRetention"))).toBe(true);
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
        .withIndex("by_userId_date", (q) => q.eq("userId", userId))
        .collect();
      const ep = await ctx.db
        .query("exercisePerformance")
        .withIndex("by_userId_activityId_movementId", (q) =>
          q.eq("userId", userId).eq("activityId", "act-1"),
        )
        .collect();
      const pr = await ctx.db
        .query("personalRecords")
        .withIndex("by_userId_movementId", (q) => q.eq("userId", userId))
        .collect();
      return { cw: cw.length, ep: ep.length, pr: pr.length };
    });
    expect(counts).toEqual({ cw: 1, ep: 1, pr: 1 });
  });
});
