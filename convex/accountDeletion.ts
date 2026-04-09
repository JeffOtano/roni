import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";

type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * Tables keyed by userId with a plain `by_userId` index. Everything here
 * can be wiped in a single prefix query.
 */
type UserIndexedTable =
  | "checkIns"
  | "workoutPlans"
  | "weekPlans"
  | "workoutFeedback"
  | "trainingBlocks"
  | "goals"
  | "injuries"
  | "emailChangeRequests"
  | "completedWorkouts"
  | "strengthScoreSnapshots"
  | "aiUsage";

async function deleteByUserIndex(
  ctx: MutationCtx,
  table: UserIndexedTable,
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
    // userProfiles: encrypted Tonal tokens, BYOK Gemini key, preferences
    const profiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const doc of profiles) {
      await ctx.db.delete(doc._id);
    }

    // App tables that share the `by_userId` index
    await deleteByUserIndex(ctx, "checkIns", userId);
    await deleteByUserIndex(ctx, "workoutPlans", userId);
    await deleteByUserIndex(ctx, "weekPlans", userId);
    await deleteByUserIndex(ctx, "workoutFeedback", userId);
    await deleteByUserIndex(ctx, "trainingBlocks", userId);
    await deleteByUserIndex(ctx, "goals", userId);
    await deleteByUserIndex(ctx, "injuries", userId);
    await deleteByUserIndex(ctx, "emailChangeRequests", userId);
    await deleteByUserIndex(ctx, "completedWorkouts", userId);
    await deleteByUserIndex(ctx, "strengthScoreSnapshots", userId);
    await deleteByUserIndex(ctx, "aiUsage", userId);

    // exercisePerformance has no plain by_userId index; the compound
    // by_userId_date is a valid prefix query for all rows for this user.
    const perfRows = await ctx.db
      .query("exercisePerformance")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .collect();
    for (const doc of perfRows) {
      await ctx.db.delete(doc._id);
    }

    // tonalCache uses a compound by_userId_dataType index
    const tonalCache = await ctx.db
      .query("tonalCache")
      .withIndex("by_userId_dataType", (q) => q.eq("userId", userId))
      .collect();
    for (const doc of tonalCache) {
      await ctx.db.delete(doc._id);
    }

    // Auth sessions + their refresh tokens
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

    // Auth accounts + their verification codes
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

    // Delete the user document last so auth-component cascades don't lose
    // their foreign-key target mid-run.
    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.delete(userId);
    }
  },
});
