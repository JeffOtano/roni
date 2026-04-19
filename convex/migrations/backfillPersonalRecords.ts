/**
 * One-time backfill for the `personalRecords` projection + `perfByMovement`
 * aggregate. Walks every weighted `exercisePerformance` row per user,
 * idempotently populates the aggregate, then reconciles one projection per
 * unique movement.
 *
 * Runbook:
 *   npx convex run migrations/backfillPersonalRecords:backfillAll
 *   # or target a single user:
 *   npx convex run migrations/backfillPersonalRecords:backfillUser '{"userId": "<id>"}'
 *
 * Safe to re-run — `insertIfDoesNotExist` and `recomputeProjection` are both
 * idempotent, so a partial run followed by a full run converges to the same
 * state as a single full run.
 */

import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { perfByMovement, recomputeProjection } from "../personalRecords";

const PAGE_SIZE = 500;
const RECONCILE_BATCH = 50;

export const backfillUserBatch = internalMutation({
  args: { userId: v.id("users"), cursor: v.union(v.string(), v.null()) },
  handler: async (
    ctx,
    { userId, cursor },
  ): Promise<{ movementIds: string[]; continueCursor: string; isDone: boolean }> => {
    const result = await ctx.db
      .query("exercisePerformance")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .paginate({ numItems: PAGE_SIZE, cursor });

    const movementIds = new Set<string>();
    for (const row of result.page) {
      if (row.avgWeightLbs != null && row.avgWeightLbs > 0) {
        await perfByMovement.insertIfDoesNotExist(ctx, row);
        movementIds.add(row.movementId);
      }
    }
    return {
      movementIds: [...movementIds],
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const reconcileProjectionsBatch = internalMutation({
  args: { userId: v.id("users"), movementIds: v.array(v.string()) },
  handler: async (ctx, { userId, movementIds }) => {
    for (const movementId of movementIds) {
      await recomputeProjection(ctx, userId, movementId);
    }
  },
});

export const backfillUser = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ movementsReconciled: number }> => {
    const allMovementIds = new Set<string>();
    let cursor: string | null = null;

    while (true) {
      const batch: { movementIds: string[]; continueCursor: string; isDone: boolean } =
        await ctx.runMutation(internal.migrations.backfillPersonalRecords.backfillUserBatch, {
          userId,
          cursor,
        });
      for (const id of batch.movementIds) allMovementIds.add(id);
      cursor = batch.continueCursor;
      if (batch.isDone) break;
    }

    const movementIds = [...allMovementIds];
    for (let i = 0; i < movementIds.length; i += RECONCILE_BATCH) {
      await ctx.runMutation(internal.migrations.backfillPersonalRecords.reconcileProjectionsBatch, {
        userId,
        movementIds: movementIds.slice(i, i + RECONCILE_BATCH),
      });
    }

    return { movementsReconciled: movementIds.length };
  },
});

export const backfillAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.userProfiles.getActiveUsers, {
      sinceTimestamp: 0,
    });
    for (const profile of users) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillPersonalRecords.backfillUser, {
        userId: profile.userId,
      });
    }
    console.log(`[backfillPersonalRecords] Scheduled backfill for ${users.length} users`);
  },
});
