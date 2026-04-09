/**
 * Data retention cleanup: removes old records from time-series tables.
 * Runs weekly via cron. Processes in batches to avoid Convex action timeouts.
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import * as analytics from "./lib/posthog";

/** Retention windows (configurable). */
export const RETENTION = {
  aiUsageDays: 90,
  aiToolCallsDays: 30,
  expiredCacheHours: 24,
} as const;

const BATCH_SIZE = 100;

/** Get IDs of aiUsage records older than the retention window. */
export const getExpiredAiUsageIds = internalQuery({
  args: { cutoff: v.number(), limit: v.number() },
  handler: async (ctx, { cutoff, limit }) => {
    const records = await ctx.db
      .query("aiUsage")
      .withIndex("by_createdAt")
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
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
      .withIndex("by_createdAt")
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
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
      .filter((q) => q.lt(q.field("expiresAt"), cutoff))
      .take(limit);
    return records.map((r) => r._id);
  },
});

/** Batch delete records by ID from any table. */
export const batchDelete = internalMutation({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      try {
        await ctx.db.delete(id as Id<"aiUsage"> | Id<"aiToolCalls"> | Id<"tonalCache">);
      } catch {
        // Record may have been deleted concurrently — skip
      }
    }
    return ids.length;
  },
});

/** Main cleanup action. Called by weekly cron. */
export const runDataRetention = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let totalDeleted = 0;

    // 1. Clean up old AI usage records (90 days)
    const aiUsageCutoff = now - RETENTION.aiUsageDays * 24 * 60 * 60 * 1000;
    let aiUsageDeleted = 0;
    while (true) {
      const ids: string[] = await ctx.runQuery(internal.dataRetention.getExpiredAiUsageIds, {
        cutoff: aiUsageCutoff,
        limit: BATCH_SIZE,
      });
      if (ids.length === 0) break;
      await ctx.runMutation(internal.dataRetention.batchDelete, { ids });
      aiUsageDeleted += ids.length;
      if (ids.length < BATCH_SIZE) break;
    }

    // 2. Clean up old AI tool call records (30 days)
    const toolCallsCutoff = now - RETENTION.aiToolCallsDays * 24 * 60 * 60 * 1000;
    let toolCallsDeleted = 0;
    while (true) {
      const ids: string[] = await ctx.runQuery(internal.dataRetention.getExpiredToolCallIds, {
        cutoff: toolCallsCutoff,
        limit: BATCH_SIZE,
      });
      if (ids.length === 0) break;
      await ctx.runMutation(internal.dataRetention.batchDelete, { ids });
      toolCallsDeleted += ids.length;
      if (ids.length < BATCH_SIZE) break;
    }

    // 3. Clean up expired cache entries (24 hours past expiration)
    const cacheCutoff = now - RETENTION.expiredCacheHours * 60 * 60 * 1000;
    let cacheDeleted = 0;
    while (true) {
      const ids: string[] = await ctx.runQuery(internal.dataRetention.getExpiredCacheIds, {
        cutoff: cacheCutoff,
        limit: BATCH_SIZE,
      });
      if (ids.length === 0) break;
      await ctx.runMutation(internal.dataRetention.batchDelete, { ids });
      cacheDeleted += ids.length;
      if (ids.length < BATCH_SIZE) break;
    }

    totalDeleted = aiUsageDeleted + toolCallsDeleted + cacheDeleted;
    if (totalDeleted > 0) {
      console.log(
        `[dataRetention] Cleaned up ${totalDeleted} records: ${aiUsageDeleted} aiUsage, ${toolCallsDeleted} toolCalls, ${cacheDeleted} cache`,
      );
    }

    analytics.captureSystem("data_retention_completed", {
      total_deleted: totalDeleted,
      ai_usage_deleted: aiUsageDeleted,
      tool_calls_deleted: toolCallsDeleted,
      cache_deleted: cacheDeleted,
    });
    await analytics.flush();
  },
});
