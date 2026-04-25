/**
 * Data retention cleanup: removes old records from time-series telemetry tables.
 * Runs daily via cron. Processes in batches to avoid Convex action timeouts.
 *
 * Tables NOT pruned here (and why):
 * - completedWorkouts, exercisePerformance, personalRecords: durable training
 *   history users rely on for progress tracking.
 * - muscleReadiness: single-row-per-user invariant enforced by
 *   `tonal/historySyncMutations.ts#persistMuscleReadiness` (queries by_userId
 *   before inserting). Mutation transactions prevent duplicates, so no
 *   cleanup pass is needed.
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { FunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import * as analytics from "./lib/posthog";

/** Retention windows (configurable). */
export const RETENTION = {
  aiUsageDays: 90,
  aiToolCallsDays: 30,
  aiRunDays: 90,
  strengthScoreSnapshotDays: 730,
  expiredCacheHours: 24,
} as const;

const BATCH_SIZE = 100;
/** Cache docs store full API responses and can be ~1MB each; use a smaller batch. */
const CACHE_BATCH_SIZE = 10;

type PrunableTable = "aiUsage" | "aiToolCalls" | "aiRun" | "strengthScoreSnapshots" | "tonalCache";

/** Get IDs of aiUsage records older than the retention window. */
export const getExpiredAiUsageIds = internalQuery({
  args: { cutoff: v.number(), limit: v.number() },
  handler: async (ctx, { cutoff, limit }) => {
    const records = await ctx.db
      .query("aiUsage")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(limit);
    return records.map((r) => r._id);
  },
});

/** Get IDs of aiToolCalls records older than the retention window. */
export const getExpiredToolCallIds = internalQuery({
  args: { cutoff: v.number(), limit: v.number() },
  handler: async (ctx, { cutoff, limit }) => {
    const records = await ctx.db
      .query("aiToolCalls")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(limit);
    return records.map((r) => r._id);
  },
});

/** Get IDs of aiRun rows older than the retention window. */
export const getExpiredAiRunIds = internalQuery({
  args: { cutoff: v.number(), limit: v.number() },
  handler: async (ctx, { cutoff, limit }) => {
    const records = await ctx.db
      .query("aiRun")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .take(limit);
    return records.map((r) => r._id);
  },
});

/** Get IDs of strengthScoreSnapshots older than the retention window. */
export const getExpiredStrengthSnapshotIds = internalQuery({
  args: { cutoff: v.number(), limit: v.number() },
  handler: async (ctx, { cutoff, limit }) => {
    const records = await ctx.db
      .query("strengthScoreSnapshots")
      .withIndex("by_syncedAt", (q) => q.lt("syncedAt", cutoff))
      .take(limit);
    return records.map((r) => r._id);
  },
});

/** Get IDs of expired tonalCache entries. */
export const getExpiredCacheIds = internalQuery({
  args: { cutoff: v.number(), limit: v.number() },
  handler: async (ctx, { cutoff, limit }) => {
    const records = await ctx.db
      .query("tonalCache")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", cutoff))
      .take(limit);
    return records.map((r) => r._id);
  },
});

/** Batch delete records by ID from any prunable table. */
export const batchDelete = internalMutation({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      try {
        await ctx.db.delete(id as Id<PrunableTable>);
      } catch {
        // Record may have been deleted concurrently — skip
      }
    }
    return ids.length;
  },
});

type ExpiredIdsQuery = FunctionReference<
  "query",
  "internal",
  { cutoff: number; limit: number },
  Id<PrunableTable>[]
>;

interface PruneTableConfig {
  cutoff: number;
  batchSize: number;
  query: ExpiredIdsQuery;
}

interface PruneCtx {
  runQuery: (q: ExpiredIdsQuery, args: { cutoff: number; limit: number }) => Promise<string[]>;
  runMutation: (
    m: typeof internal.dataRetention.batchDelete,
    args: { ids: string[] },
  ) => Promise<number>;
}

async function pruneTable(ctx: PruneCtx, config: PruneTableConfig): Promise<number> {
  let deleted = 0;
  while (true) {
    const ids = await ctx.runQuery(config.query, {
      cutoff: config.cutoff,
      limit: config.batchSize,
    });
    if (ids.length === 0) break;
    await ctx.runMutation(internal.dataRetention.batchDelete, { ids });
    deleted += ids.length;
    if (ids.length < config.batchSize) break;
  }
  return deleted;
}

/** Main cleanup action. Called by daily cron. */
export const runDataRetention = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const aiUsageDeleted = await pruneTable(ctx, {
      cutoff: now - RETENTION.aiUsageDays * 24 * 60 * 60 * 1000,
      batchSize: BATCH_SIZE,
      query: internal.dataRetention.getExpiredAiUsageIds,
    });
    const toolCallsDeleted = await pruneTable(ctx, {
      cutoff: now - RETENTION.aiToolCallsDays * 24 * 60 * 60 * 1000,
      batchSize: BATCH_SIZE,
      query: internal.dataRetention.getExpiredToolCallIds,
    });
    const aiRunDeleted = await pruneTable(ctx, {
      cutoff: now - RETENTION.aiRunDays * 24 * 60 * 60 * 1000,
      batchSize: BATCH_SIZE,
      query: internal.dataRetention.getExpiredAiRunIds,
    });
    const strengthSnapshotsDeleted = await pruneTable(ctx, {
      cutoff: now - RETENTION.strengthScoreSnapshotDays * 24 * 60 * 60 * 1000,
      batchSize: BATCH_SIZE,
      query: internal.dataRetention.getExpiredStrengthSnapshotIds,
    });
    const cacheDeleted = await pruneTable(ctx, {
      cutoff: now - RETENTION.expiredCacheHours * 60 * 60 * 1000,
      batchSize: CACHE_BATCH_SIZE,
      query: internal.dataRetention.getExpiredCacheIds,
    });

    const totalDeleted =
      aiUsageDeleted + toolCallsDeleted + aiRunDeleted + strengthSnapshotsDeleted + cacheDeleted;
    if (totalDeleted > 0) {
      console.log(
        `[dataRetention] Cleaned up ${totalDeleted} records: ${aiUsageDeleted} aiUsage, ${toolCallsDeleted} toolCalls, ${aiRunDeleted} aiRun, ${strengthSnapshotsDeleted} strengthSnapshots, ${cacheDeleted} cache`,
      );
    }

    analytics.captureSystem("data_retention_completed", {
      total_deleted: totalDeleted,
      ai_usage_deleted: aiUsageDeleted,
      tool_calls_deleted: toolCallsDeleted,
      ai_run_deleted: aiRunDeleted,
      strength_snapshots_deleted: strengthSnapshotsDeleted,
      cache_deleted: cacheDeleted,
    });
    await analytics.flush();
  },
});
