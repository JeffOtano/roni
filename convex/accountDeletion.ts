import { v } from "convex/values";
import type { GenericId } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import {
  type ByUserIdBatchTable,
  USER_TABLE_BATCH_TABLES,
  type UserTableBatchTable,
} from "./userData";
import type { Id } from "./_generated/dataModel";
import { clearForUser as clearPersonalRecordsForUser } from "./personalRecords";

const BATCH_SIZE = 500;
// tonalCache rows can hold up to ~1 MiB each, so a 500-row batch can blow past
// Convex's 16 MiB per-call read limit. Keep this small enough that even
// worst-case rows stay well under the limit.
const TONAL_CACHE_BATCH_SIZE = 10;
const userTableValidator = v.union(
  ...(USER_TABLE_BATCH_TABLES.map((table) => v.literal(table)) as [
    ReturnType<typeof v.literal<UserTableBatchTable>>,
    ReturnType<typeof v.literal<UserTableBatchTable>>,
    ...Array<ReturnType<typeof v.literal<UserTableBatchTable>>>,
  ]),
);

// Tables that no longer carry a single-field `by_userId` index route their
// deletion scan through a covering `by_userId_X` compound. Tables that retain
// `by_userId` fall through to the shared arm. Switch is exhaustive over
// `ByUserIdBatchTable` so dropping another `by_userId` from schema.ts is a
// compile-time error here, not a runtime account-deletion failure.
async function takeBatchForDeletion(
  ctx: MutationCtx,
  table: ByUserIdBatchTable,
  userId: Id<"users">,
): Promise<GenericId<ByUserIdBatchTable>[]> {
  switch (table) {
    case "weekPlans":
      return (
        await ctx.db
          .query("weekPlans")
          .withIndex("by_userId_weekStartDate", (q) => q.eq("userId", userId))
          .take(BATCH_SIZE)
      ).map((d) => d._id);
    case "workoutFeedback":
      return (
        await ctx.db
          .query("workoutFeedback")
          .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
          .take(BATCH_SIZE)
      ).map((d) => d._id);
    case "trainingBlocks":
      return (
        await ctx.db
          .query("trainingBlocks")
          .withIndex("by_userId_status", (q) => q.eq("userId", userId))
          .take(BATCH_SIZE)
      ).map((d) => d._id);
    case "goals":
      return (
        await ctx.db
          .query("goals")
          .withIndex("by_userId_status", (q) => q.eq("userId", userId))
          .take(BATCH_SIZE)
      ).map((d) => d._id);
    case "aiUsage":
      return (
        await ctx.db
          .query("aiUsage")
          .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
          .take(BATCH_SIZE)
      ).map((d) => d._id);
    case "aiRun":
      return (
        await ctx.db
          .query("aiRun")
          .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
          .take(BATCH_SIZE)
      ).map((d) => d._id);
    case "completedWorkouts":
      return (
        await ctx.db
          .query("completedWorkouts")
          .withIndex("by_userId_date", (q) => q.eq("userId", userId))
          .take(BATCH_SIZE)
      ).map((d) => d._id);
    case "checkIns":
    case "workoutPlans":
    case "injuries":
    case "emailChangeRequests":
    case "aiBudgetWarnings":
    case "coachState":
    case "strengthScoreSnapshots":
    case "currentStrengthScores":
    case "muscleReadiness":
    case "userProfileActivity":
    case "garminConnections":
    case "garminOauthStates":
    case "garminWellnessDaily":
      return (
        await ctx.db
          .query(table)
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .take(BATCH_SIZE)
      ).map((d) => d._id);
    default: {
      const _exhaustive: never = table;
      throw new Error(`Unhandled deletion table: ${String(_exhaustive)}`);
    }
  }
}

async function deleteGarminWebhookEventsBatch(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const docs = await ctx.db
    .query("garminWebhookEvents")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(BATCH_SIZE);

  for (const doc of docs) {
    if (doc.rawPayloadStorageId) {
      try {
        await ctx.storage.delete(doc.rawPayloadStorageId);
      } catch (error) {
        console.error("[accountDeletion] failed to delete Garmin webhook storage blob", {
          rawPayloadStorageId: doc.rawPayloadStorageId,
          error,
        });
        // Storage may already have been swept manually. Delete the row so
        // account deletion still converges.
      }
    }
    await ctx.db.delete(doc._id);
  }

  return docs.length === BATCH_SIZE;
}

/** Delete one batch from a user-scoped table. Returns true if more remain. */
export const deleteUserTableBatch = internalMutation({
  args: { userId: v.id("users"), table: userTableValidator },
  handler: async (ctx, { userId, table }): Promise<boolean> => {
    if (table === "garminWebhookEvents") {
      return await deleteGarminWebhookEventsBatch(ctx, userId);
    }
    const ids = await takeBatchForDeletion(ctx, table, userId);
    for (const id of ids) {
      await ctx.db.delete(id);
    }
    return ids.length === BATCH_SIZE;
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

/**
 * Delete one batch of personalRecords rows, also clearing the corresponding
 * aggregate namespaces. Run before `deleteExercisePerformanceBatch` so the
 * aggregate is empty by the time the source rows go away.
 */
export const deletePersonalRecordsBatch = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<boolean> => {
    return clearPersonalRecordsForUser(ctx, userId, BATCH_SIZE);
  },
});

/** Delete one batch of tonalCache rows. */
export const deleteTonalCacheBatch = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<boolean> => {
    const docs = await ctx.db
      .query("tonalCache")
      .withIndex("by_userId_dataType", (q) => q.eq("userId", userId))
      .take(TONAL_CACHE_BATCH_SIZE);
    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
    return docs.length === TONAL_CACHE_BATCH_SIZE;
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
