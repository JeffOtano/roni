/**
 * Internal queries for push token lookups.
 *
 * Separated from pushTokens.ts so that the action in send.ts (which uses
 * "use node") can call these via ctx.runQuery without mixing runtimes.
 */

import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

/** Fetch all push tokens for a given user (called by send actions). */
export const getTokensForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(10);
  },
});
