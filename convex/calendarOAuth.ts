import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// OAuth state management (CSRF protection)
// ---------------------------------------------------------------------------

export const createOAuthState = internalMutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    origin: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("oauthStates", {
      token: args.token,
      userId: args.userId,
      origin: args.origin,
      createdAt: args.createdAt,
    });
  },
});

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export const consumeOAuthState = internalMutation({
  args: { token: v.string(), now: v.number() },
  handler: async (
    ctx,
    { token, now },
  ): Promise<{ ok: false; error: string } | { ok: true; userId: Id<"users">; origin: string }> => {
    const state = await ctx.db
      .query("oauthStates")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();

    if (!state) {
      return { ok: false, error: "invalid_state" };
    }

    if (state.usedAt !== undefined) {
      return { ok: false, error: "state_already_used" };
    }

    if (now - state.createdAt > STATE_MAX_AGE_MS) {
      return { ok: false, error: "state_expired" };
    }

    await ctx.db.patch(state._id, { usedAt: now });

    return {
      ok: true,
      userId: state.userId,
      origin: state.origin,
    };
  },
});

const STATE_CLEANUP_AGE_MS = 60 * 60 * 1000; // 1 hour

export const cleanupExpiredOAuthStates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - STATE_CLEANUP_AGE_MS;
    const expired = await ctx.db
      .query("oauthStates")
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
      .collect();

    for (const state of expired) {
      await ctx.db.delete(state._id);
    }

    return { deleted: expired.length };
  },
});
