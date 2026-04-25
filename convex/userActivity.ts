import { v } from "convex/values";
import { internalQuery, mutation } from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";
import { rateLimiter } from "./rateLimits";

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
      .withIndex("by_tonalUserId", (q) => q.gt("tonalUserId", ""))
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
    });
  },
});
