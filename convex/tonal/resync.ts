/**
 * Admin tools for triggering workout history resyncs.
 *
 * Usage (Convex CLI):
 *   npx convex run tonal/resync:resyncUser '{"userId": "..."}'
 *   npx convex run tonal/resync:resyncAllUsers '{}'
 *   npx convex run tonal/resync:resyncAllUsers '{"delayBetweenUsersMs": 90000}'
 */

import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { TONAL_REFRESH_CACHE_KEYS } from "./refresh";

/** Cache keys to clear before a resync. Includes the full refresh set
 *  (profile, strength, readiness, current history) plus legacy per-limit
 *  workout-history keys that may still linger in older deployments. */
const STALE_CACHE_KEYS = [
  ...TONAL_REFRESH_CACHE_KEYS,
  "workoutHistory_v3_full",
  "workoutHistory_v2",
  "workoutHistory_v2:1",
  "workoutHistory_v2:5",
  "workoutHistory_v2:20",
  "workoutHistory_v2:30",
  "workoutHistory_v2:50",
  "workoutHistory_v2:100",
  "workoutHistory_v2:500",
];

async function clearCacheAndScheduleBackfill(ctx: ActionCtx, userId: Id<"users">, delayMs: number) {
  await ctx.runMutation(internal.tonal.cache.deleteUserCacheEntries, {
    userId,
    dataTypes: STALE_CACHE_KEYS,
  });
  await ctx.scheduler.runAfter(delayMs, internal.tonal.historySync.backfillUserHistory, {
    userId,
  });
}

/** Clear cached workout history and trigger a fresh backfill for one user. */
export const resyncUser = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await clearCacheAndScheduleBackfill(ctx, userId, 0);
    console.log(`[resync] Triggered resync for user ${userId}`);
    return { triggered: true };
  },
});

/** Staggered resync for all users with a Tonal connection.
 *  Default: 60s between users. Adjust with delayBetweenUsersMs. */
export const resyncAllUsers = internalAction({
  args: { delayBetweenUsersMs: v.optional(v.number()) },
  handler: async (
    ctx,
    { delayBetweenUsersMs = 60_000 },
  ): Promise<{
    usersScheduled: number;
    totalTimeMinutes: number;
  }> => {
    const profiles = await ctx.runQuery(internal.tonal.resync.getConnectedUsers);

    for (let i = 0; i < profiles.length; i++) {
      await clearCacheAndScheduleBackfill(ctx, profiles[i].userId, i * delayBetweenUsersMs);
    }

    const total = Math.round((profiles.length * delayBetweenUsersMs) / 60_000);
    console.log(
      `[resync] Scheduled resync for ${profiles.length} users, ` +
        `${delayBetweenUsersMs / 1000}s apart (~${total}min total)`,
    );

    return { usersScheduled: profiles.length, totalTimeMinutes: total };
  },
});

/** List users with a Tonal connection. */
export const getConnectedUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_tonalUserId", (q) => q.gt("tonalUserId", ""))
      .collect();
    return profiles.map((p) => ({ userId: p.userId, syncStatus: p.syncStatus }));
  },
});

/** Count synced workouts per user with date range. For diagnosing sync gaps. */
export const getSyncDiagnostics = internalQuery({
  args: {},
  handler: async (ctx) => {
    const connected = await ctx.db
      .query("userProfiles")
      .withIndex("by_tonalUserId", (q) => q.gt("tonalUserId", ""))
      .collect();

    const results = [];
    for (const p of connected) {
      const workouts = await ctx.db
        .query("completedWorkouts")
        .withIndex("by_userId_date", (q) => q.eq("userId", p.userId))
        .collect();
      const dates = workouts.map((w) => w.date).sort();
      results.push({
        userId: p.userId,
        syncStatus: p.syncStatus,
        workoutCount: workouts.length,
        oldestDate: dates[0] ?? null,
        newestDate: dates[dates.length - 1] ?? null,
      });
    }

    return results.sort((a, b) => b.workoutCount - a.workoutCount);
  },
});
