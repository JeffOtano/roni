/**
 * Training history sync: workflow definitions and entry points.
 *
 * Pure helpers live in historySyncCore.ts. This file defines the workflow
 * step actions, the two workflows (incremental + backfill), and the
 * mutation wrappers that crons/callers use to start them.
 */

import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Activity } from "./types";
import * as analytics from "../lib/posthog";
import { workflow } from "../workflows";
import {
  maybeRefreshProfile,
  syncActivitiesAndStrength,
  syncStrengthOnly,
} from "./historySyncCore";

const BACKFILL_BATCH_SIZE = 20;
// 2x what we'd need to drain pgTotal at BACKFILL_BATCH_SIZE per iteration; floor for tiny histories.
const ITERATION_SAFETY_FACTOR = 2;
const MIN_BACKFILL_ITERATIONS = 50;

// ---------------------------------------------------------------------------
// Workflow step actions
// ---------------------------------------------------------------------------

/** Sync strength score history. Callable as a workflow step. */
export const doSyncStrength = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await syncStrengthOnly(ctx, userId);
  },
});

/** Refresh user profile from Tonal API if stale. Callable as a workflow step. */
export const doMaybeRefreshProfile = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await maybeRefreshProfile(ctx, userId);
  },
});

/** Fetch new activities, get details, and persist. Returns sync info. */
export const doFetchAndPersistNewActivities = internalAction({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    { userId },
  ): Promise<{
    synced: number;
    totalFetched: number;
    newestDate: string | undefined;
  }> => {
    const activities: Activity[] = await ctx.runAction(
      internal.tonal.workoutHistoryProxy.fetchWorkoutHistory,
      { userId },
    );
    if (activities.length === 0) {
      return { synced: 0, totalFetched: 0, newestDate: undefined };
    }

    const result = await syncActivitiesAndStrength(ctx, userId, activities);
    const newestDate = activities[activities.length - 1].activityTime.slice(0, 10);
    return { synced: result.synced, totalFetched: activities.length, newestDate };
  },
});

/** Fetch one page of history, diff, process new activities, persist. */
export const doBackfillPage = internalAction({
  args: {
    userId: v.id("users"),
    pgOffset: v.number(),
  },
  handler: async (
    ctx,
    { userId, pgOffset },
  ): Promise<{
    synced: number;
    remaining: number;
    pageSize: number;
    pgTotal: number;
    newestDate: string | undefined;
  }> => {
    const { activities, pageSize, pgTotal } = (await ctx.runAction(
      internal.tonal.workoutHistoryProxy.fetchWorkoutHistoryPage,
      { userId, offset: pgOffset },
    )) as { activities: Activity[]; pageSize: number; pgTotal: number };

    if (activities.length === 0) {
      return { synced: 0, remaining: 0, pageSize, pgTotal, newestDate: undefined };
    }

    const result = await syncActivitiesAndStrength(ctx, userId, activities, BACKFILL_BATCH_SIZE);
    const newestDate = activities[activities.length - 1].activityTime.slice(0, 10);

    return {
      synced: result.synced,
      remaining: result.remaining,
      pageSize,
      pgTotal,
      newestDate,
    };
  },
});

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

/** Durable workflow: incremental history sync for a single user. */
export const syncUserHistoryWorkflow = workflow.define({
  args: { userId: v.id("users") },
  handler: async (step, { userId }): Promise<null> => {
    if (await step.runQuery(internal.lib.auth.getDeletionInProgress, { userId })) {
      return null;
    }

    const { synced, newestDate } = await step.runAction(
      internal.tonal.historySync.doFetchAndPersistNewActivities,
      { userId },
    );

    await Promise.all([
      step.runAction(internal.tonal.historySync.doSyncStrength, { userId }),
      step.runAction(internal.tonal.enrichmentSync.doPersistNewTableData, { userId }),
      step.runAction(internal.tonal.historySync.doMaybeRefreshProfile, { userId }),
    ]);

    if (newestDate) {
      await step.runMutation(internal.userProfiles.updateLastSyncedActivityDate, {
        userId,
        date: newestDate,
      });
    }

    if (synced > 0) {
      console.log(`[historySync] Synced ${synced} new workouts for user ${userId}`);
    }

    analytics.capture(userId, "history_sync_completed", { new_workouts: synced });
    await analytics.flush();

    return null;
  },
});

/** Durable workflow: full backfill of user history on connect. */
export const backfillUserHistoryWorkflow = workflow.define({
  args: { userId: v.id("users") },
  handler: async (step, { userId }): Promise<null> => {
    if (await step.runQuery(internal.lib.auth.getDeletionInProgress, { userId })) {
      return null;
    }

    await step.runMutation(internal.userProfiles.updateSyncStatus, {
      userId,
      syncStatus: "syncing",
    });

    let pgOffset = 0;
    let bestDate: string | undefined;
    let iterations = 0;
    let maxIterations = MIN_BACKFILL_ITERATIONS;

    while (true) {
      if (++iterations > maxIterations) {
        throw new Error(
          `[historySync] backfill exceeded ${maxIterations} iterations at offset ${pgOffset} for user ${userId}`,
        );
      }

      const page = await step.runAction(internal.tonal.historySync.doBackfillPage, {
        userId,
        pgOffset,
      });

      // pgTotal is unknown until the first response; recompute the cap then.
      maxIterations = Math.max(
        MIN_BACKFILL_ITERATIONS,
        Math.ceil(page.pgTotal / BACKFILL_BATCH_SIZE) * ITERATION_SAFETY_FACTOR,
      );

      if (page.newestDate) bestDate = page.newestDate;

      if (page.remaining > 0) continue;

      const nextOffset = pgOffset + page.pageSize;
      if (nextOffset >= page.pgTotal) break;
      pgOffset = nextOffset;
    }

    if (bestDate) {
      await step.runMutation(internal.userProfiles.updateLastSyncedActivityDate, {
        userId,
        date: bestDate,
      });
    }

    await Promise.all([
      step.runAction(internal.tonal.historySync.doSyncStrength, { userId }),
      step.runAction(internal.tonal.enrichmentSync.doPersistNewTableData, { userId }),
      step.runAction(internal.tonal.historySync.doMaybeRefreshProfile, { userId }),
    ]);

    await step.runMutation(internal.userProfiles.updateSyncStatus, {
      userId,
      syncStatus: "complete",
    });

    analytics.capture(userId, "history_sync_completed", { backfill: true });
    await analytics.flush();

    return null;
  },
});

// ---------------------------------------------------------------------------
// Cron and caller entry points (start workflows from mutation contexts)
// ---------------------------------------------------------------------------

/** Start incremental sync workflow for a user. Called from cacheRefresh. */
export const startSyncUserHistory = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await workflow.start(ctx, internal.tonal.historySync.syncUserHistoryWorkflow, { userId });
  },
});

/** Start backfill workflow for a user. Called from connect.ts. */
export const startBackfillUserHistory = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await workflow.start(ctx, internal.tonal.historySync.backfillUserHistoryWorkflow, { userId });
  },
});
