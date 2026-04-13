import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

// Cache TTLs in milliseconds
export const CACHE_TTLS: Record<string, number> = {
  profile: 24 * 60 * 60 * 1000, // 24 hours
  strengthScores: 60 * 60 * 1000, // 1 hour
  strengthHistory: 60 * 60 * 1000, // 1 hour
  muscleReadiness: 30 * 60 * 1000, // 30 minutes
  workoutHistory: 30 * 60 * 1000, // 30 minutes
  customWorkouts: 5 * 60 * 1000, // 5 minutes
  strengthDistribution: 6 * 60 * 60 * 1000, // 6 hours
};

export const getUserProfile = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getCacheEntry = internalQuery({
  args: {
    userId: v.optional(v.id("users")),
    dataType: v.string(),
  },
  handler: async (ctx, { userId, dataType }) => {
    if (userId) {
      return await ctx.db
        .query("tonalCache")
        .withIndex("by_userId_dataType", (q) => q.eq("userId", userId).eq("dataType", dataType))
        .unique();
    }
    // Global cache (e.g., movement catalog)
    return await ctx.db
      .query("tonalCache")
      .withIndex("by_userId_dataType", (q) => q.eq("userId", undefined).eq("dataType", dataType))
      .unique();
  },
});

export const setCacheEntry = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    dataType: v.string(),
    data: v.any(),
    fetchedAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tonalCache")
      .withIndex("by_userId_dataType", (q) =>
        q.eq("userId", args.userId).eq("dataType", args.dataType),
      )
      .unique();

    if (existing) {
      // Freshness guard: skip write if existing data is already newer.
      // This makes concurrent cache writers harmless instead of conflicting.
      if (args.fetchedAt <= existing.fetchedAt) return;
      await ctx.db.patch(existing._id, {
        data: args.data,
        fetchedAt: args.fetchedAt,
        expiresAt: args.expiresAt,
      });
    } else {
      await ctx.db.insert("tonalCache", {
        userId: args.userId,
        dataType: args.dataType,
        data: args.data,
        fetchedAt: args.fetchedAt,
        expiresAt: args.expiresAt,
      });
    }
  },
});

export const deleteUserCacheEntries = internalMutation({
  args: {
    userId: v.id("users"),
    dataTypes: v.array(v.string()),
  },
  handler: async (ctx, { userId, dataTypes }) => {
    let deleted = 0;

    for (const dataType of dataTypes) {
      const existing = await ctx.db
        .query("tonalCache")
        .withIndex("by_userId_dataType", (q) => q.eq("userId", userId).eq("dataType", dataType))
        .unique();

      if (!existing) continue;

      await ctx.db.delete(existing._id);
      deleted++;
    }

    return deleted;
  },
});
