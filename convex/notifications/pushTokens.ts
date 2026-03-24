/**
 * Device push token registration for APNs.
 *
 * Stores one token per user+platform pair. The iOS app calls `registerToken`
 * after receiving a device token from APNs and authenticating.
 *
 * NOTE: This module requires a `pushTokens` table in the schema. Add the
 * following to convex/schema.ts:
 *
 * ```ts
 * pushTokens: defineTable({
 *   userId: v.id("users"),
 *   token: v.string(),
 *   platform: v.literal("ios"),
 *   deviceName: v.optional(v.string()),
 *   createdAt: v.number(),
 *   updatedAt: v.number(),
 * })
 *   .index("by_userId", ["userId"])
 *   .index("by_userId_and_platform", ["userId", "platform"]),
 * ```
 */

import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getEffectiveUserId } from "../lib/auth";

/** Store or update a device push token for the authenticated user. */
export const registerToken = mutation({
  args: {
    token: v.string(),
    platform: v.literal("ios"),
    deviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Upsert: find existing token for this user+platform, update or create.
    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId_and_platform", (q) => q.eq("userId", userId).eq("platform", "ios"))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        token: args.token,
        deviceName: args.deviceName,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("pushTokens", {
        userId,
        token: args.token,
        platform: "ios",
        deviceName: args.deviceName,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/** Remove the push token for the authenticated user (e.g. on logout). */
export const removeToken = mutation({
  args: {
    platform: v.literal("ios"),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId_and_platform", (q) =>
        q.eq("userId", userId).eq("platform", args.platform),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/** Get the current user's registered push tokens. */
export const getMyTokens = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return [];

    return ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(10);
  },
});
