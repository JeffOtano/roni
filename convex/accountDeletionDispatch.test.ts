/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

type Harness = ReturnType<typeof convexTest>;

async function createUser(t: Harness): Promise<Id<"users">> {
  return t.run(async (ctx) => ctx.db.insert("users", {}));
}

async function drain(t: Harness, userId: Id<"users">, table: SpecializedTable): Promise<void> {
  let iterations = 0;
  while (await t.mutation(internal.accountDeletion.deleteUserTableBatch, { userId, table })) {
    iterations += 1;
    if (iterations > 5_000) throw new Error(`drain did not converge for ${table}`);
  }
}

// Tables whose `by_userId` index was dropped in favor of a covering compound.
// Each one exercises a specialized arm in `takeBatchForDeletion`.
type SpecializedTable =
  | "weekPlans"
  | "workoutFeedback"
  | "trainingBlocks"
  | "goals"
  | "aiUsage"
  | "aiRun"
  | "completedWorkouts";

type Seeder = (
  ctx: Parameters<Parameters<Harness["run"]>[0]>[0],
  userId: Id<"users">,
  marker: string,
) => Promise<void>;

const SEEDERS: Record<SpecializedTable, Seeder> = {
  weekPlans: async (ctx, userId, marker) => {
    await ctx.db.insert("weekPlans", {
      userId,
      weekStartDate: `2026-01-${marker}`,
      preferredSplit: "ppl",
      targetDays: 4,
      days: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
  workoutFeedback: async (ctx, userId, marker) => {
    await ctx.db.insert("workoutFeedback", {
      userId,
      activityId: `activity-${marker}`,
      rpe: 7,
      rating: 4,
      createdAt: Date.now(),
    });
  },
  trainingBlocks: async (ctx, userId, marker) => {
    await ctx.db.insert("trainingBlocks", {
      userId,
      label: `Block ${marker}`,
      blockType: "building",
      weekNumber: 1,
      totalWeeks: 4,
      startDate: `2026-01-${marker}`,
      status: "active",
      createdAt: Date.now(),
    });
  },
  goals: async (ctx, userId, marker) => {
    await ctx.db.insert("goals", {
      userId,
      title: `Goal ${marker}`,
      category: "strength",
      metric: "bench_press",
      baselineValue: 100,
      targetValue: 120,
      currentValue: 100,
      deadline: `2026-06-${marker}`,
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
  aiUsage: async (ctx, userId, _marker) => {
    await ctx.db.insert("aiUsage", {
      userId,
      model: "gemini-2.5-flash",
      provider: "google",
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      createdAt: Date.now(),
    });
  },
  aiRun: async (ctx, userId, marker) => {
    await ctx.db.insert("aiRun", {
      runId: `run-${userId}-${marker}`,
      userId,
      threadId: `thread-${userId}`,
      source: "chat",
      environment: "dev",
      totalSteps: 1,
      toolSequence: [],
      retryCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      approvalPauses: 0,
      createdAt: Date.now(),
    });
  },
  completedWorkouts: async (ctx, userId, marker) => {
    await ctx.db.insert("completedWorkouts", {
      userId,
      activityId: `activity-${marker}`,
      date: `2026-01-${marker}`,
      title: `Workout ${marker}`,
      targetArea: "upper",
      totalVolume: 1000,
      totalDuration: 1800,
      totalWork: 50000,
      workoutType: "free_lift",
      syncedAt: Date.now(),
    });
  },
};

const SPECIALIZED_TABLES = Object.keys(SEEDERS) as SpecializedTable[];

describe("deleteUserTableBatch dispatch", () => {
  test.each(SPECIALIZED_TABLES)(
    "drains %s via its covering compound index without touching other users' rows",
    async (table) => {
      const t = convexTest(schema, modules);
      const userId = await createUser(t);
      const otherUserId = await createUser(t);
      const seed = SEEDERS[table];

      await t.run(async (ctx) => {
        await seed(ctx, userId, "01");
        await seed(ctx, userId, "02");
        await seed(ctx, userId, "03");
        await seed(ctx, otherUserId, "99");
      });

      await drain(t, userId, table);

      const remaining = await t.run(async (ctx) =>
        (await ctx.db.query(table).collect()).filter((row) => row.userId === userId),
      );
      expect(remaining).toHaveLength(0);

      const otherRows = await t.run(async (ctx) =>
        (await ctx.db.query(table).collect()).filter((row) => row.userId === otherUserId),
      );
      expect(otherRows).toHaveLength(1);
    },
  );
});
