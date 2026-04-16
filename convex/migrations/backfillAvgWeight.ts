/**
 * Backfill action: re-fetch workout details from Tonal and recompute
 * avgWeightLbs for exercisePerformance rows that were cleared by the
 * clearBogusAvgWeight migration.
 *
 * Run per user: npx convex run migrations/backfillAvgWeight:backfillUser '{"userId": "..."}'
 * Run all:      npx convex run migrations/backfillAvgWeight:backfillAll
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { Movement, WorkoutActivityDetail } from "../tonal/types";
import { aggregateDetailToSessions } from "../progressiveOverload";
import { withTokenRetry } from "../tonal/tokenRetry";
import { tonalFetch } from "../tonal/client";

const BATCH_SIZE = 10;

/** Get activityIds that have null avgWeightLbs for a given user. */
export const getNullWeightActivityIds = internalQuery({
  args: { userId: v.id("users"), limit: v.number() },
  handler: async (ctx, { userId, limit }) => {
    const rows = await ctx.db
      .query("exercisePerformance")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("avgWeightLbs"), undefined))
      .take(limit);
    return [...new Set(rows.map((r) => r.activityId))];
  },
});

/** Patch avgWeightLbs for exercisePerformance rows matching a given activityId. */
export const patchAvgWeights = internalMutation({
  args: {
    userId: v.id("users"),
    activityId: v.string(),
    weights: v.array(v.object({ movementId: v.string(), avgWeightLbs: v.number() })),
  },
  handler: async (ctx, { userId, activityId, weights }) => {
    const weightMap = new Map(weights.map((w) => [w.movementId, w.avgWeightLbs]));
    const rows = await ctx.db
      .query("exercisePerformance")
      .withIndex("by_userId_activityId", (q) => q.eq("userId", userId).eq("activityId", activityId))
      .collect();
    for (const row of rows) {
      const weight = weightMap.get(row.movementId);
      if (weight != null) {
        await ctx.db.patch(row._id, { avgWeightLbs: weight });
      }
    }
  },
});

/** Backfill one user's exercisePerformance rows. */
export const backfillUser = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const movements: Movement[] = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);
    const straightBarIds = new Set(
      movements.filter((m) => m.onMachineInfo?.accessory === "StraightBar").map((m) => m.id),
    );

    let totalPatched = 0;
    while (true) {
      const activityIds: string[] = await ctx.runQuery(
        internal.migrations.backfillAvgWeight.getNullWeightActivityIds,
        { userId, limit: BATCH_SIZE },
      );
      if (activityIds.length === 0) break;

      for (const activityId of activityIds) {
        try {
          const detail = await withTokenRetry<WorkoutActivityDetail>(
            ctx,
            userId,
            (token: string, tonalUserId: string) =>
              tonalFetch<WorkoutActivityDetail>(
                token,
                `/v6/users/${tonalUserId}/workout-activities/${activityId}`,
              ),
          );

          const sessionMap = aggregateDetailToSessions(detail, straightBarIds);
          const weights = [...sessionMap.entries()]
            .filter(([, snap]) => snap.avgWeightLbs != null)
            .map(([movementId, snap]) => ({
              movementId,
              avgWeightLbs: snap.avgWeightLbs!,
            }));

          if (weights.length > 0) {
            await ctx.runMutation(internal.migrations.backfillAvgWeight.patchAvgWeights, {
              userId,
              activityId,
              weights,
            });
            totalPatched += weights.length;
          }
        } catch (err) {
          console.warn(
            `[backfillAvgWeight] Skipping activity ${activityId} for user ${userId}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    if (totalPatched > 0) {
      console.log(`[backfillAvgWeight] Patched ${totalPatched} rows for user ${userId}`);
    }
  },
});

/** Backfill all users that have null avgWeightLbs rows. */
export const backfillAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.userProfiles.getActiveUsers, {
      sinceTimestamp: 0,
    });

    for (const profile of users) {
      try {
        await ctx.scheduler.runAfter(0, internal.migrations.backfillAvgWeight.backfillUser, {
          userId: profile.userId as Id<"users">,
        });
      } catch (err) {
        console.warn(
          `[backfillAvgWeight] Failed to schedule backfill for ${profile.userId}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.log(`[backfillAvgWeight] Scheduled backfill for ${users.length} users`);
  },
});
