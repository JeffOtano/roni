import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { buildTrainingSnapshot } from "./ai/context";

const SNAPSHOT_VERSION = 1;
const REFRESH_DELAY_MS = 5_000;
const MAX_ERROR_CHARS = 500;

export async function requestCoachStateRefresh(
  ctx: MutationCtx,
  userId: Id<"users">,
  userTimezone?: string,
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("coachState")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const alreadyPending = existing?.refreshRequestedAt !== undefined;

  if (existing) {
    await ctx.db.patch(existing._id, {
      refreshRequestedAt: now,
      refreshRequestedTimezone: userTimezone ?? null,
    });
  } else {
    await ctx.db.insert("coachState", {
      userId,
      snapshot: "",
      snapshotVersion: SNAPSHOT_VERSION,
      refreshedAt: 0,
      refreshRequestedAt: now,
      refreshRequestedTimezone: userTimezone ?? null,
    });
  }

  if (alreadyPending) return;
  await ctx.scheduler.runAfter(REFRESH_DELAY_MS, internal.coachState.refreshForUser, {
    userId,
    requestedAt: now,
    userTimezone,
  });
}

export const requestRefresh = internalMutation({
  args: { userId: v.id("users"), userTimezone: v.optional(v.string()) },
  handler: async (ctx, { userId, userTimezone }) => {
    await requestCoachStateRefresh(ctx, userId, userTimezone);
  },
});

export const getForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("coachState")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const refreshForUser = internalAction({
  args: {
    userId: v.id("users"),
    requestedAt: v.optional(v.number()),
    userTimezone: v.optional(v.string()),
  },
  handler: async (ctx, { userId, requestedAt, userTimezone }) => {
    const refreshRequestedAt = requestedAt ?? Date.now();
    try {
      const existing = await ctx.runQuery(internal.coachState.getForUser, { userId });
      const snapshotTimezone =
        userTimezone ??
        (existing?.refreshRequestedTimezone !== undefined
          ? (existing.refreshRequestedTimezone ?? undefined)
          : (existing?.userTimezone ?? undefined));
      const snapshot = await buildTrainingSnapshot(ctx, userId, snapshotTimezone);
      await ctx.runMutation(internal.coachState.upsertSnapshot, {
        userId,
        snapshot,
        requestedAt: refreshRequestedAt,
        userTimezone: snapshotTimezone,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.coachState.recordRefreshFailure, {
        userId,
        requestedAt: refreshRequestedAt,
        error: message.slice(0, MAX_ERROR_CHARS),
      });
    }
  },
});

export const upsertSnapshot = internalMutation({
  args: {
    userId: v.id("users"),
    snapshot: v.string(),
    requestedAt: v.optional(v.number()),
    userTimezone: v.optional(v.string()),
  },
  handler: async (ctx, { userId, snapshot, requestedAt, userTimezone }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("coachState")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const newerRequestAt =
      existing?.refreshRequestedAt !== undefined && requestedAt !== undefined
        ? existing.refreshRequestedAt > requestedAt
          ? existing.refreshRequestedAt
          : undefined
        : undefined;

    const values = {
      snapshot,
      snapshotVersion: SNAPSHOT_VERSION,
      refreshedAt: newerRequestAt === undefined ? now : 0,
      userTimezone: userTimezone ?? null,
    };
    const clearPending = newerRequestAt === undefined;
    const patch = clearPending
      ? {
          ...values,
          refreshRequestedAt: undefined,
          refreshRequestedTimezone: undefined,
          failedAt: undefined,
          lastError: undefined,
        }
      : { ...values, failedAt: undefined, lastError: undefined };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      if (newerRequestAt !== undefined) {
        await ctx.scheduler.runAfter(REFRESH_DELAY_MS, internal.coachState.refreshForUser, {
          userId,
          requestedAt: newerRequestAt,
          userTimezone: existing.refreshRequestedTimezone ?? undefined,
        });
      }
      return;
    }
    return await ctx.db.insert("coachState", { userId, ...values });
  },
});

export const recordRefreshFailure = internalMutation({
  args: { userId: v.id("users"), requestedAt: v.optional(v.number()), error: v.string() },
  handler: async (ctx, { userId, requestedAt, error }) => {
    const existing = await ctx.db
      .query("coachState")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!existing) return;
    const newerRequestAt =
      existing.refreshRequestedAt !== undefined && requestedAt !== undefined
        ? existing.refreshRequestedAt > requestedAt
          ? existing.refreshRequestedAt
          : undefined
        : undefined;
    await ctx.db.patch(existing._id, {
      ...(newerRequestAt === undefined
        ? { refreshRequestedAt: undefined, refreshRequestedTimezone: undefined }
        : {}),
      failedAt: Date.now(),
      lastError: error,
    });
    if (newerRequestAt !== undefined) {
      await ctx.scheduler.runAfter(REFRESH_DELAY_MS, internal.coachState.refreshForUser, {
        userId,
        requestedAt: newerRequestAt,
        userTimezone: existing.refreshRequestedTimezone ?? undefined,
      });
    }
  },
});
