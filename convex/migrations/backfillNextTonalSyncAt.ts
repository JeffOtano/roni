/**
 * One-time backfill: populate nextTonalSyncAt and workoutHistoryCachedAt on
 * existing userProfiles so they appear in the cron's by_nextTonalSyncAt range
 * query and so the preflight skip can read the denormalized cache freshness.
 *
 * Run: npx convex run migrations/backfillNextTonalSyncAt:run
 */

import { paginationOptsValidator } from "convex/server";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { computeNextSyncAt } from "../tonal/cacheRefreshTiering";

const BATCH_SIZE = 200;
const WORKOUT_HISTORY_CACHE_TYPE = "workoutHistory_v3";

export const patchBatch = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db.query("userProfiles").paginate(paginationOpts);
    const now = Date.now();
    let patched = 0;

    for (const profile of result.page) {
      const updates: {
        nextTonalSyncAt?: number | undefined;
        workoutHistoryCachedAt?: number;
      } = {};

      if (profile.nextTonalSyncAt === undefined) {
        const next = computeNextSyncAt(now, profile.appLastActiveAt, profile.lastTonalSyncAt);
        if (next !== undefined) updates.nextTonalSyncAt = next;
      }

      if (profile.workoutHistoryCachedAt === undefined) {
        const cache = await ctx.db
          .query("tonalCache")
          .withIndex("by_userId_dataType", (q) =>
            q.eq("userId", profile.userId).eq("dataType", WORKOUT_HISTORY_CACHE_TYPE),
          )
          .unique();
        if (cache) updates.workoutHistoryCachedAt = cache.fetchedAt;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(profile._id, updates);
        patched++;
      }
    }

    return {
      scanned: result.page.length,
      patched,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let totalScanned = 0;
    let totalPatched = 0;

    while (true) {
      const result: {
        scanned: number;
        patched: number;
        isDone: boolean;
        continueCursor: string;
      } = await ctx.runMutation(internal.migrations.backfillNextTonalSyncAt.patchBatch, {
        paginationOpts: { numItems: BATCH_SIZE, cursor },
      });

      totalScanned += result.scanned;
      totalPatched += result.patched;
      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    console.log(
      `[backfillNextTonalSyncAt] scanned ${totalScanned} profiles, patched ${totalPatched}`,
    );
    return { scanned: totalScanned, patched: totalPatched };
  },
});
