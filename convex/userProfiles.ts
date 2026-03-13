import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    tonalUserId: v.string(),
    tonalToken: v.string(),
    tonalRefreshToken: v.optional(v.string()),
    tonalTokenExpiresAt: v.optional(v.number()),
    profileData: v.optional(
      v.object({
        firstName: v.string(),
        lastName: v.string(),
        heightInches: v.number(),
        weightPounds: v.number(),
        gender: v.string(),
        level: v.string(),
        workoutsPerWeek: v.number(),
        workoutDurationMin: v.number(),
        workoutDurationMax: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Upsert: check if profile exists
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tonalUserId: args.tonalUserId,
        tonalToken: args.tonalToken,
        tonalRefreshToken: args.tonalRefreshToken,
        tonalTokenExpiresAt: args.tonalTokenExpiresAt,
        profileData: args.profileData,
        lastActiveAt: Date.now(),
      });
      return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("userProfiles", {
      ...args,
      lastActiveAt: now,
      tonalConnectedAt: now,
    });
  },
});

export const setFirstAiWorkoutCompletedAt = internalMutation({
  args: {
    userId: v.id("users"),
    completedAt: v.number(),
  },
  handler: async (ctx, { userId, completedAt }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile || profile.firstAiWorkoutCompletedAt !== undefined) return;
    await ctx.db.patch(profile._id, { firstAiWorkoutCompletedAt: completedAt });
  },
});

export const updateTonalToken = internalMutation({
  args: {
    userId: v.id("users"),
    tonalToken: v.string(),
    tonalRefreshToken: v.optional(v.string()),
    tonalTokenExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { userId, ...tokenData }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    await ctx.db.patch(profile._id, {
      ...tokenData,
      lastActiveAt: Date.now(),
    });
  },
});

export const markTokenExpired = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (profile) {
      await ctx.db.patch(profile._id, { tonalTokenExpiresAt: 0 });
    }
  },
});

export const getExpiringTokens = internalQuery({
  args: { beforeTimestamp: v.number() },
  handler: async (ctx, { beforeTimestamp }) => {
    // Get all profiles and filter by expiry
    const profiles = await ctx.db.query("userProfiles").collect();
    return profiles.filter(
      (p) =>
        p.tonalTokenExpiresAt !== undefined &&
        p.tonalTokenExpiresAt > 0 &&
        p.tonalTokenExpiresAt < beforeTimestamp,
    );
  },
});

export const getActiveUsers = internalQuery({
  args: { sinceTimestamp: v.number() },
  handler: async (ctx, { sinceTimestamp }) => {
    const profiles = await ctx.db.query("userProfiles").collect();
    return profiles.filter((p) => p.lastActiveAt > sinceTimestamp);
  },
});
