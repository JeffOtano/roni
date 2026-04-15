import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { BY_USER_ID_BATCH_TABLES, type ByUserIdBatchTable } from "./userData";

const BATCH_SIZE = 500;

const userTableValidator = v.union(
  ...(BY_USER_ID_BATCH_TABLES.map((table) => v.literal(table)) as [
    ReturnType<typeof v.literal<ByUserIdBatchTable>>,
    ReturnType<typeof v.literal<ByUserIdBatchTable>>,
    ...Array<ReturnType<typeof v.literal<ByUserIdBatchTable>>>,
  ]),
);

/** Delete one batch from a table with a by_userId index. Returns true if more remain. */
export const deleteUserTableBatch = internalMutation({
  args: { userId: v.id("users"), table: userTableValidator },
  handler: async (ctx, { userId, table }): Promise<boolean> => {
    const docs = await ctx.db
      .query(table)
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(BATCH_SIZE);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return docs.length === BATCH_SIZE;
  },
});

/** Delete one batch of exercisePerformance rows. */
export const deleteExercisePerformanceBatch = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<boolean> => {
    const docs = await ctx.db
      .query("exercisePerformance")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .take(BATCH_SIZE);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return docs.length === BATCH_SIZE;
  },
});

/** Delete one batch of tonalCache rows. */
export const deleteTonalCacheBatch = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<boolean> => {
    const docs = await ctx.db
      .query("tonalCache")
      .withIndex("by_userId_dataType", (q) => q.eq("userId", userId))
      .take(BATCH_SIZE);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return docs.length === BATCH_SIZE;
  },
});

/** Delete one batch of externalActivities rows. */
export const deleteExternalActivitiesBatch = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<boolean> => {
    const docs = await ctx.db
      .query("externalActivities")
      .withIndex("by_userId_beginTime", (q) => q.eq("userId", userId))
      .take(BATCH_SIZE);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return docs.length === BATCH_SIZE;
  },
});

export const markDeletionInProgress = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");
    if (user.deletionInProgress) throw new Error("Account deletion already in progress");
    await ctx.db.patch(userId, { deletionInProgress: true });
  },
});

export const clearDeletionInProgress = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (user) await ctx.db.patch(userId, { deletionInProgress: false });
  },
});

/** Delete auth sessions, refresh tokens, accounts, and verification codes. */
export const deleteAuthData = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<boolean> => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first();
    if (session) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .take(BATCH_SIZE);
      if (tokens.length > 0) {
        for (const token of tokens) {
          await ctx.db.delete(token._id);
        }
        return true;
      }

      await ctx.db.delete(session._id);
      return true;
    }

    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .first();
    if (account) {
      const codes = await ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))
        .take(BATCH_SIZE);
      if (codes.length > 0) {
        for (const code of codes) {
          await ctx.db.delete(code._id);
        }
        return true;
      }

      await ctx.db.delete(account._id);
      return true;
    }

    return false;
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
