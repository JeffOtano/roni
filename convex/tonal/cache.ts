import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { isDeletionInProgress } from "../lib/auth";

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

const WORKOUT_HISTORY_CACHE_TYPE = "workoutHistory_v3";

/**
 * Mirror the workoutHistory cache write timestamp onto userProfiles so the
 * sync preflight can read a tiny field instead of pulling the bulky cache row.
 */
async function denormalizeWorkoutHistoryFreshness(
  ctx: MutationCtx,
  userId: Id<"users">,
  fetchedAt: number,
): Promise<void> {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!profile) return;
  if ((profile.workoutHistoryCachedAt ?? 0) >= fetchedAt) return;
  await ctx.db.patch(profile._id, { workoutHistoryCachedAt: fetchedAt });
}

export const getUserProfile = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (await isDeletionInProgress(ctx, userId)) return null;
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
    if (args.userId && (await isDeletionInProgress(ctx, args.userId))) return;
    const existing = await ctx.db
      .query("tonalCache")
      .withIndex("by_userId_dataType", (q) =>
        q.eq("userId", args.userId).eq("dataType", args.dataType),
      )
      .unique();

    try {
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
      if (args.userId && args.dataType === WORKOUT_HISTORY_CACHE_TYPE) {
        await denormalizeWorkoutHistoryFreshness(ctx, args.userId, args.fetchedAt);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("too large") || msg.includes("maximum size")) {
        // Silently skip if data exceeds Convex's 1 MiB document limit.
        // The caller (cachedFetch) still returns fresh data to the user.
        console.warn(`setCacheEntry(${args.dataType}): skipped, data too large`);
        return;
      }
      throw err;
    }
  },
});

export const deleteCacheEntryByType = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    dataType: v.string(),
  },
  handler: async (ctx, { userId, dataType }) => {
    const existing = await ctx.db
      .query("tonalCache")
      .withIndex("by_userId_dataType", (q) => q.eq("userId", userId).eq("dataType", dataType))
      .unique();
    if (!existing) return false;
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const deleteUserCacheEntries = internalMutation({
  args: {
    userId: v.id("users"),
    dataTypes: v.array(v.string()),
  },
  handler: async (ctx, { userId, dataTypes }) => {
    if (await isDeletionInProgress(ctx, userId)) return 0;
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
