import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";

type MutationCtx = GenericMutationCtx<DataModel>;

const BATCH_SIZE = 500;

/**
 * Delete up to BATCH_SIZE rows from a table for a given userId.
 * Returns the number of rows deleted so the caller knows whether to continue.
 */
async function deleteBatch(
  ctx: MutationCtx,
  table: string,
  indexName: string,
  userId: Id<"users">,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docs = await (ctx.db.query(table as any) as any)
    .withIndex(indexName, (q: { eq: (f: string, v: string) => unknown }) => q.eq("userId", userId))
    .take(BATCH_SIZE);
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
  return docs.length;
}

/** Delete one batch of user data from a specific table. Returns true if more rows remain. */
export const deleteTableBatch = internalMutation({
  args: {
    userId: v.id("users"),
    table: v.string(),
    indexName: v.optional(v.string()),
  },
  handler: async (ctx, { userId, table, indexName = "by_userId" }): Promise<boolean> => {
    const deleted = await deleteBatch(ctx, table, indexName, userId);
    return deleted === BATCH_SIZE;
  },
});

/** Delete auth sessions, refresh tokens, accounts, and verification codes. */
export const deleteAuthData = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .take(BATCH_SIZE);
      for (const token of tokens) {
        await ctx.db.delete(token._id);
      }
      await ctx.db.delete(session._id);
    }

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const account of accounts) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .take(BATCH_SIZE);
      for (const code of codes) {
        await ctx.db.delete(code._id);
      }
      await ctx.db.delete(account._id);
    }
  },
});

/** Delete the user profile and user document. Run last. */
export const deleteUserRecord = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const doc of profiles) {
      await ctx.db.delete(doc._id);
    }

    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.delete(userId);
    }
  },
});
