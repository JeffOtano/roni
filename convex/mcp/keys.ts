import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getEffectiveUserId } from "../lib/auth";
import { generateKeyString, hashApiKey } from "./crypto";

export const generateMcpApiKey = mutation({
  args: { label: v.optional(v.string()) },
  handler: async (ctx, { label }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const plaintext = generateKeyString();
    const keyHash = await hashApiKey(plaintext);

    await ctx.db.insert("mcpApiKeys", {
      userId,
      keyHash,
      label,
      createdAt: Date.now(),
    });

    return { key: plaintext };
  },
});

export const revokeMcpApiKey = mutation({
  args: { keyId: v.id("mcpApiKeys") },
  handler: async (ctx, { keyId }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const keyRow = await ctx.db.get(keyId);
    if (!keyRow || keyRow.userId !== userId) {
      throw new Error("Key not found or not owned by you");
    }

    await ctx.db.delete(keyId);
    return { revoked: true };
  },
});

export const listMcpApiKeys = query({
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return [];

    const keys = await ctx.db
      .query("mcpApiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return keys.map((k) => ({
      _id: k._id,
      label: k.label ?? null,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt ?? null,
    }));
  },
});
