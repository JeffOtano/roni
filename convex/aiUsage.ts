import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";

/** Daily per-user token budget. Configurable - change this constant to adjust. */
export const DAILY_TOKEN_BUDGET = 500_000;

/** 80% threshold for early warning Discord alert. */
export const BUDGET_WARNING_THRESHOLD = 0.8;

export const record = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    threadId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    model: v.string(),
    provider: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    cacheReadTokens: v.optional(v.number()),
    cacheWriteTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiUsage", { ...args, createdAt: Date.now() });
  },
});

export const recordRouting = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.string(),
    intent: v.string(),
  },
  handler: async (ctx, { userId, threadId, intent }) => {
    await ctx.db.insert("aiUsage", {
      userId: userId as Id<"users">,
      threadId,
      agentName: `router:${intent}`,
      model: "keyword-classifier",
      provider: "local",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      routedIntent: intent,
      createdAt: Date.now(),
    });
  },
});

export const recordToolCall = internalMutation({
  args: {
    userId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    toolName: v.string(),
    durationMs: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiToolCalls", { ...args, createdAt: Date.now() });
  },
});

/** Get total tokens used by a user today (UTC day boundary). */
export const getDailyTokenUsage = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const records = await ctx.db
      .query("aiUsage")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId).gte("createdAt", startOfDay.getTime()),
      )
      .collect();

    return records.reduce((sum, r) => sum + r.totalTokens, 0);
  },
});
