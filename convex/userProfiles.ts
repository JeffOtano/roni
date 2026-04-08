import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getEffectiveUserId } from "./lib/auth";

const profileDataValidator = v.object({
  firstName: v.string(),
  lastName: v.string(),
  heightInches: v.number(),
  weightPounds: v.number(),
  gender: v.string(),
  level: v.string(),
  workoutsPerWeek: v.number(),
  workoutDurationMin: v.number(),
  workoutDurationMax: v.number(),
  dateOfBirth: v.optional(v.string()),
  username: v.optional(v.string()),
  tonalCreatedAt: v.optional(v.string()),
});

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
    tonalEmail: v.optional(v.string()),
    tonalToken: v.string(),
    tonalRefreshToken: v.optional(v.string()),
    tonalTokenExpiresAt: v.optional(v.number()),
    profileData: v.optional(profileDataValidator),
  },
  handler: async (ctx, args) => {
    if (args.profileData) {
      await ctx.db.patch(args.userId, {
        firstName: args.profileData.firstName,
        lastName: args.profileData.lastName,
        name: `${args.profileData.firstName} ${args.profileData.lastName}`,
      });
    }

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        tonalUserId: args.tonalUserId,
        tonalEmail: args.tonalEmail,
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
  handler: async (ctx, { userId, tonalToken, tonalRefreshToken, tonalTokenExpiresAt }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("User profile not found");

    // Freshness guard: skip if DB already has a newer token.
    // Prevents race between cron refresh and on-demand withTokenRetry.
    if (
      tonalTokenExpiresAt &&
      profile.tonalTokenExpiresAt &&
      tonalTokenExpiresAt <= profile.tonalTokenExpiresAt
    ) {
      return;
    }

    const patch: Record<string, unknown> = {
      tonalToken,
      lastActiveAt: Date.now(),
    };
    if (tonalRefreshToken !== undefined) patch.tonalRefreshToken = tonalRefreshToken;
    if (tonalTokenExpiresAt !== undefined) patch.tonalTokenExpiresAt = tonalTokenExpiresAt;

    await ctx.db.patch(profile._id, patch);
  },
});

export const markTokenExpired = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (profile) await ctx.db.patch(profile._id, { tonalTokenExpiresAt: 0 });
  },
});

export const getExpiringTokens = internalQuery({
  args: { beforeTimestamp: v.number() },
  handler: async (ctx, { beforeTimestamp }) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_tonalTokenExpiresAt", (q) =>
        q.gt("tonalTokenExpiresAt", 0).lt("tonalTokenExpiresAt", beforeTimestamp),
      )
      .collect();
  },
});

export const getActiveUsers = internalQuery({
  args: { sinceTimestamp: v.number() },
  handler: async (ctx, { sinceTimestamp }) => {
    const profiles = await ctx.db.query("userProfiles").collect();
    return profiles.filter((p) => p.lastActiveAt > sinceTimestamp);
  },
});

/** Pick any user with a valid Tonal token for global API calls (catalog syncs). */
export const getUserWithValidToken = internalQuery({
  args: {},
  handler: async (ctx) => {
    const valid = await ctx.db
      .query("userProfiles")
      .withIndex("by_tonalTokenExpiresAt", (q) => q.gt("tonalTokenExpiresAt", Date.now()))
      .first();
    // Fallback: any connected user (withTokenRetry can refresh expired tokens)
    return valid ?? (await ctx.db.query("userProfiles").first());
  },
});

const trainingPreferencesArgs = {
  preferredSplit: v.union(v.literal("ppl"), v.literal("upper_lower"), v.literal("full_body")),
  trainingDays: v.array(v.number()),
  sessionDurationMinutes: v.union(v.literal(30), v.literal(45), v.literal(60)),
} as const;

/** Get training preferences for the authenticated user. */
export const getTrainingPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return profile?.trainingPreferences ?? null;
  },
});

/** Save training preferences for the authenticated user. */
export const saveTrainingPreferences = mutation({
  args: trainingPreferencesArgs,
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("User profile not found");
    await ctx.db.patch(profile._id, {
      trainingPreferences: {
        preferredSplit: args.preferredSplit,
        trainingDays: args.trainingDays,
        sessionDurationMinutes: args.sessionDurationMinutes,
      },
    });
  },
});

/** Save onboarding data (goal, injuries) and mark onboarding complete. */
export const completeOnboarding = mutation({
  args: {
    goal: v.string(),
    injuries: v.optional(v.string()),
    preferredSplit: v.union(v.literal("ppl"), v.literal("upper_lower"), v.literal("full_body")),
    trainingDays: v.array(v.number()),
    sessionDurationMinutes: v.union(v.literal(30), v.literal(45), v.literal(60)),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("No profile found — connect Tonal first");
    await ctx.db.patch(profile._id, {
      onboardingData: {
        goal: args.goal,
        injuries: args.injuries,
        completedAt: Date.now(),
      },
      trainingPreferences: {
        preferredSplit: args.preferredSplit,
        trainingDays: args.trainingDays,
        sessionDurationMinutes: args.sessionDurationMinutes,
      },
    });

    // Notify Discord of new signup completion
    const name = profile.profileData
      ? `${profile.profileData.firstName} ${profile.profileData.lastName}`
      : "Unknown";
    await ctx.scheduler.runAfter(0, internal.discord.notifySignup, {
      email: name,
    });
  },
});

/** Get training preferences by userId (server-only). */
export const getTrainingPreferencesInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return profile?.trainingPreferences ?? null;
  },
});

/** Save training preferences by userId (server-only). */
export const saveTrainingPreferencesInternal = internalMutation({
  args: { userId: v.id("users"), ...trainingPreferencesArgs },
  handler: async (ctx, { userId, ...prefs }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("User profile not found");
    await ctx.db.patch(profile._id, {
      trainingPreferences: {
        preferredSplit: prefs.preferredSplit,
        trainingDays: prefs.trainingDays,
        sessionDurationMinutes: prefs.sessionDurationMinutes,
      },
    });
  },
});

/** Get the high-water mark for incremental history sync. */
export const getLastSyncedActivityDate = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return profile?.lastSyncedActivityDate ?? null;
  },
});

/** Update the high-water mark after a successful history sync. */
export const updateLastSyncedActivityDate = internalMutation({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, { userId, date }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("User profile not found");
    await ctx.db.patch(profile._id, { lastSyncedActivityDate: date });
  },
});

/** Refresh cached profile data from Tonal API response. */
export const updateProfileData = internalMutation({
  args: {
    userId: v.id("users"),
    profileData: profileDataValidator,
  },
  handler: async (ctx, { userId, profileData }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("User profile not found");
    await ctx.db.patch(profile._id, { profileData, profileDataRefreshedAt: Date.now() });

    await ctx.db.patch(userId, {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      name: `${profileData.firstName} ${profileData.lastName}`,
    });
  },
});

const TOKEN_REFRESH_LOCK_TTL_MS = 30 * 1000; // 30 seconds

/** Attempt to acquire the token refresh lock. Returns true if acquired. */
export const acquireTokenRefreshLock = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return false;

    const now = Date.now();
    // If lock is held and not expired, someone else is refreshing
    if (
      profile.tokenRefreshInProgress &&
      now - profile.tokenRefreshInProgress < TOKEN_REFRESH_LOCK_TTL_MS
    ) {
      return false;
    }

    await ctx.db.patch(profile._id, { tokenRefreshInProgress: now });
    return true;
  },
});

/** Release the token refresh lock. */
export const releaseTokenRefreshLock = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (profile) await ctx.db.patch(profile._id, { tokenRefreshInProgress: undefined });
  },
});

/** Get thread staleness threshold for a user (server-only). */
export const getThreadStaleHours = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return profile?.threadStaleHours ?? 24;
  },
});
