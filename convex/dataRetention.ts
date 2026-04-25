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

import {
  type ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
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

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

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

/**
 * Batch delete records by ID from any prunable table. Reads each row first so
 * concurrent deletes are a no-op without swallowing other errors (cast
 * mismatches, OCC retries, permission failures), which previously hid here.
 */
export const batchDelete = internalMutation({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    let deleted = 0;
    for (const id of ids) {
      const typedId = id as Id<PrunableTable>;
      const existing = await ctx.db.get(typedId);
      if (!existing) continue;
      await ctx.db.delete(typedId);
      deleted += 1;
    }
    return deleted;
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

async function pruneTable(ctx: ActionCtx, config: PruneTableConfig): Promise<number> {
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
    const counts = {
      aiUsage: 0,
      toolCalls: 0,
      aiRun: 0,
      strengthSnapshots: 0,
      cache: 0,
    };
    let partialFailure: string | undefined;

    try {
      counts.aiUsage = await pruneTable(ctx, {
        cutoff: now - RETENTION.aiUsageDays * MS_PER_DAY,
        batchSize: BATCH_SIZE,
        query: internal.dataRetention.getExpiredAiUsageIds,
      });
      counts.toolCalls = await pruneTable(ctx, {
        cutoff: now - RETENTION.aiToolCallsDays * MS_PER_DAY,
        batchSize: BATCH_SIZE,
        query: internal.dataRetention.getExpiredToolCallIds,
      });
      counts.aiRun = await pruneTable(ctx, {
        cutoff: now - RETENTION.aiRunDays * MS_PER_DAY,
        batchSize: BATCH_SIZE,
        query: internal.dataRetention.getExpiredAiRunIds,
      });
      counts.strengthSnapshots = await pruneTable(ctx, {
        cutoff: now - RETENTION.strengthScoreSnapshotDays * MS_PER_DAY,
        batchSize: BATCH_SIZE,
        query: internal.dataRetention.getExpiredStrengthSnapshotIds,
      });
      counts.cache = await pruneTable(ctx, {
        cutoff: now - RETENTION.expiredCacheHours * MS_PER_HOUR,
        batchSize: CACHE_BATCH_SIZE,
        query: internal.dataRetention.getExpiredCacheIds,
      });
    } catch (err) {
      partialFailure = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const totalDeleted =
        counts.aiUsage + counts.toolCalls + counts.aiRun + counts.strengthSnapshots + counts.cache;
      if (totalDeleted > 0 || partialFailure) {
        const prefix = partialFailure ? `partial (${partialFailure}): ` : "";
        console.log(
          `[dataRetention] ${prefix}Cleaned up ${totalDeleted} records: ${counts.aiUsage} aiUsage, ${counts.toolCalls} toolCalls, ${counts.aiRun} aiRun, ${counts.strengthSnapshots} strengthSnapshots, ${counts.cache} cache`,
        );
      }

      analytics.captureSystem("data_retention_completed", {
        total_deleted: totalDeleted,
        ai_usage_deleted: counts.aiUsage,
        tool_calls_deleted: counts.toolCalls,
        ai_run_deleted: counts.aiRun,
        strength_snapshots_deleted: counts.strengthSnapshots,
        cache_deleted: counts.cache,
        partial_failure: partialFailure ?? null,
      });
      await analytics.flush();
    }
  },
});
