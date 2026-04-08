import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";

type MutationCtx = GenericMutationCtx<DataModel>;

/** Collect all docs for a user from a table (by index) and delete them. */
async function deleteByUserIndex(
  ctx: MutationCtx,
  table: "checkIns" | "workoutPlans" | "weekPlans" | "mcpApiKeys" | "mcpUsage",
  userId: Id<"users">,
): Promise<void> {
  const docs = await ctx.db
    .query(table)
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
}

export const deleteAllUserData = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Delete userProfiles
    const profiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const doc of profiles) {
      await ctx.db.delete(doc._id);
    }

    // Delete app data tables (all share by_userId index)
    await deleteByUserIndex(ctx, "checkIns", userId);
    await deleteByUserIndex(ctx, "workoutPlans", userId);
    await deleteByUserIndex(ctx, "weekPlans", userId);
    await deleteByUserIndex(ctx, "mcpApiKeys", userId);
    await deleteByUserIndex(ctx, "mcpUsage", userId);

    // Delete tonalCache (uses composite index)
    const tonalCache = await ctx.db
      .query("tonalCache")
      .withIndex("by_userId_dataType", (q) => q.eq("userId", userId))
      .collect();
    for (const doc of tonalCache) {
      await ctx.db.delete(doc._id);
    }

    // Delete auth sessions + their refresh tokens
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of tokens) {
        await ctx.db.delete(token._id);
      }
      await ctx.db.delete(session._id);
    }

    // Delete auth accounts + their verification codes
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .collect();
      for (const code of codes) {
        await ctx.db.delete(code._id);
      }
      await ctx.db.delete(account._id);
    }

    // Delete the user document last (auth depends on it existing)
    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.delete(userId);
    }
  },
});
