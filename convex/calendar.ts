import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

// Re-export for test backward compatibility
export { findGaps } from "./calendarHelpers";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const isCalendarConnected = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { connected: false };

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile?.googleCalendarEnabled) return { connected: false };

    return {
      connected: true,
      calendarId: profile.googleCalendarId ?? "primary",
    };
  },
});

export const getCalendarSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile) return null;

    return {
      connected: profile.googleCalendarEnabled === true,
      calendarId: profile.googleCalendarId ?? "primary",
      hasRefreshToken: profile.googleCalendarRefreshToken !== undefined,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const disconnectCalendar = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("User profile not found");

    await ctx.db.patch(profile._id, {
      googleCalendarToken: undefined,
      googleCalendarRefreshToken: undefined,
      googleCalendarTokenExpiresAt: undefined,
      googleCalendarEnabled: false,
      googleCalendarId: undefined,
    });
  },
});

// ---------------------------------------------------------------------------
// Internal mutations/queries (for actions in calendarActions.ts)
// ---------------------------------------------------------------------------

export const storeGoogleTokens = internalMutation({
  args: {
    userId: v.id("users"),
    encryptedToken: v.string(),
    encryptedRefreshToken: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, { userId, encryptedToken, encryptedRefreshToken, expiresAt }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("User profile not found");

    await ctx.db.patch(profile._id, {
      googleCalendarToken: encryptedToken,
      ...(encryptedRefreshToken !== undefined && {
        googleCalendarRefreshToken: encryptedRefreshToken,
      }),
      googleCalendarTokenExpiresAt: expiresAt,
      googleCalendarEnabled: true,
    });
  },
});

export const getGoogleTokens = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile?.googleCalendarEnabled) return null;

    return {
      encryptedToken: profile.googleCalendarToken,
      encryptedRefreshToken: profile.googleCalendarRefreshToken,
      expiresAt: profile.googleCalendarTokenExpiresAt,
      calendarId: profile.googleCalendarId ?? "primary",
    };
  },
});
