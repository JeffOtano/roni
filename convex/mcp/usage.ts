import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const logMcpUsage = internalMutation({
  args: {
    userId: v.id("users"),
    keyId: v.id("mcpApiKeys"),
    tool: v.string(),
  },
  handler: async (ctx, { userId, keyId, tool }) => {
    await ctx.db.insert("mcpUsage", {
      userId,
      keyId,
      tool,
      calledAt: Date.now(),
    });
  },
});
