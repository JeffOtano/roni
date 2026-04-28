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

const ACTION_LIMIT_MS = 600_000;
const SAFETY_BUFFER_MS = 60_000;
/** Budget passed to pruneTable; exported so tests can override it via `_deadlineOffsetMs`. */
export const DEADLINE_OFFSET_MS = ACTION_LIMIT_MS - SAFETY_BUFFER_MS;

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

interface PruneResult {
  deleted: number;
  /** True when all expired rows were removed; false when the deadline was hit. */
  complete: boolean;
}

async function pruneTable(
  ctx: ActionCtx,
  config: PruneTableConfig,
  deadline: number,
): Promise<PruneResult> {
  let deleted = 0;
  while (true) {
    if (Date.now() >= deadline) return { deleted, complete: false };
    const ids = await ctx.runQuery(config.query, {
      cutoff: config.cutoff,
      limit: config.batchSize,
    });
    if (ids.length === 0) break;
    await ctx.runMutation(internal.dataRetention.batchDelete, { ids });
    deleted += ids.length;
    if (ids.length < config.batchSize) break;
  }
  return { deleted, complete: true };
}

type CountKey = "aiUsage" | "toolCalls" | "aiRun" | "strengthSnapshots";

/** Main cleanup action. Called by daily cron (and by itself when work remains). */
export const runDataRetention = internalAction({
  args: {
    /** Override the deadline budget for tests (omit in production). */
    _deadlineOffsetMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const deadline = now + (args._deadlineOffsetMs ?? DEADLINE_OFFSET_MS);

    const counts: Record<CountKey, number> = {
      aiUsage: 0,
      toolCalls: 0,
      aiRun: 0,
      strengthSnapshots: 0,
    };

    // tonalCache cleanup runs weekly in `runCacheRetention`.
    const tableConfigs: Array<PruneTableConfig & { key: CountKey }> = [
      {
        key: "aiUsage",
        cutoff: now - RETENTION.aiUsageDays * MS_PER_DAY,
        batchSize: BATCH_SIZE,
        query: internal.dataRetention.getExpiredAiUsageIds,
      },
      {
        key: "toolCalls",
        cutoff: now - RETENTION.aiToolCallsDays * MS_PER_DAY,
        batchSize: BATCH_SIZE,
        query: internal.dataRetention.getExpiredToolCallIds,
      },
      {
        key: "aiRun",
        cutoff: now - RETENTION.aiRunDays * MS_PER_DAY,
        batchSize: BATCH_SIZE,
        query: internal.dataRetention.getExpiredAiRunIds,
      },
      {
        key: "strengthSnapshots",
        cutoff: now - RETENTION.strengthScoreSnapshotDays * MS_PER_DAY,
        batchSize: BATCH_SIZE,
        query: internal.dataRetention.getExpiredStrengthSnapshotIds,
      },
    ];

    let partialFailure: string | undefined;
    let needsContinuation = false;

    try {
      for (const config of tableConfigs) {
        if (needsContinuation) break;
        const result = await pruneTable(ctx, config, deadline);
        counts[config.key] = result.deleted;
        if (!result.complete) needsContinuation = true;
      }

      if (needsContinuation) {
        await ctx.scheduler.runAfter(0, internal.dataRetention.runDataRetention, {});
      }
    } catch (err) {
      partialFailure = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const totalDeleted = Object.values(counts).reduce((sum, n) => sum + n, 0);
      if (totalDeleted > 0 || partialFailure || needsContinuation) {
        const prefix = partialFailure
          ? `partial (${partialFailure}): `
          : needsContinuation
            ? "partial (deadline): "
            : "";
        console.log(
          `[dataRetention] ${prefix}Cleaned up ${totalDeleted} records: ${counts.aiUsage} aiUsage, ${counts.toolCalls} toolCalls, ${counts.aiRun} aiRun, ${counts.strengthSnapshots} strengthSnapshots`,
        );
      }

      analytics.captureSystem("data_retention_completed", {
        total_deleted: totalDeleted,
        ai_usage_deleted: counts.aiUsage,
        tool_calls_deleted: counts.toolCalls,
        ai_run_deleted: counts.aiRun,
        strength_snapshots_deleted: counts.strengthSnapshots,
        partial_failure: partialFailure ?? null,
        needs_continuation: needsContinuation,
      });
      await analytics.flush();
    }
  },
});

/**
 * Weekly tonalCache cleanup. Active users overwrite their rows in place via
 * `setCacheEntry`, so retention only sweeps orphaned dormant-user rows.
 */
export const runCacheRetention = internalAction({
  args: {
    /** Override the deadline budget for tests (omit in production). */
    _deadlineOffsetMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const deadline = now + (args._deadlineOffsetMs ?? DEADLINE_OFFSET_MS);

    let partialFailure: string | undefined;

    try {
      const result = await pruneTable(
        ctx,
        {
          cutoff: now - RETENTION.expiredCacheHours * MS_PER_HOUR,
          batchSize: CACHE_BATCH_SIZE,
          query: internal.dataRetention.getExpiredCacheIds,
        },
        deadline,
      );

      if (!result.complete) {
        await ctx.scheduler.runAfter(0, internal.dataRetention.runCacheRetention, {});
      }

      if (result.deleted > 0 || !result.complete) {
        const prefix = result.complete ? "" : "partial (deadline): ";
        console.log(`[cacheRetention] ${prefix}Cleaned up ${result.deleted} cache rows`);
      }

      analytics.captureSystem("cache_retention_completed", {
        total_deleted: result.deleted,
        partial_failure: null,
        needs_continuation: !result.complete,
      });
    } catch (err) {
      partialFailure = err instanceof Error ? err.message : String(err);
      analytics.captureSystem("cache_retention_completed", {
        total_deleted: 0,
        partial_failure: partialFailure,
        needs_continuation: false,
      });
      throw err;
    } finally {
      await analytics.flush();
    }
  },
});
