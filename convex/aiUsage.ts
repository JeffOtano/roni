import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

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
