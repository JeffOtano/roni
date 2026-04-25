import { v } from "convex/values";
import { internalQuery, mutation } from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";
import { rateLimiter } from "./rateLimits";
import { computeNextSyncAt } from "./tonal/cacheRefreshTiering";

const APP_ACTIVITY_THROTTLE_MS = 30 * 60 * 1000;

export const getActiveUsers = internalQuery({
  args: { sinceTimestamp: v.number() },
  handler: async (ctx, { sinceTimestamp }) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_appLastActiveAt", (q) => q.gt("appLastActiveAt", sinceTimestamp))
      .collect();
  },
});

export const getAllConnectedUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_lastActiveAt", (q) => q.gt("lastActiveAt", 0))
      .collect();
  },
});

/** Profiles whose nextTonalSyncAt has elapsed — the cron consumes this directly. */
export const getUsersDueForRefresh = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    // gte(0) excludes profiles whose nextTonalSyncAt is unset (>72h cohort or
    // pre-backfill); the lte caps the range at "due now". Both bounds use the
    // same index, so the read is bounded to the eligible cohort only.
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_nextTonalSyncAt", (q) =>
        q.gte("nextTonalSyncAt", 0).lte("nextTonalSyncAt", now),
      )
      .collect();
  },
});

export const recordAppActivity = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await rateLimiter.limit(ctx, "recordAppActivity", { key: userId });

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return;

    const now = Date.now();
    if (profile.appLastActiveAt && now - profile.appLastActiveAt < APP_ACTIVITY_THROTTLE_MS) {
      return;
    }

    await ctx.db.patch(profile._id, {
      appLastActiveAt: now,
      lastActiveAt: now,
      nextTonalSyncAt: computeNextSyncAt(now, now, profile.lastTonalSyncAt),
    });
  },
});
