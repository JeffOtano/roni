/**
 * One-time backfill: populate nextTonalSyncAt on existing userProfiles so they
 * appear in the cron's by_nextTonalSyncAt range query.
 *
 * Run: npx convex run migrations/backfillNextTonalSyncAt:run
 */

import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { computeNextSyncAt } from "../tonal/cacheRefreshTiering";

const BATCH_SIZE = 200;

export const getProfilesMissingNextSync = internalQuery({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("userProfiles").collect();
    return profiles
      .filter((profile) => profile.nextTonalSyncAt === undefined)
      .map((profile) => ({
        _id: profile._id,
        appLastActiveAt: profile.appLastActiveAt,
        lastTonalSyncAt: profile.lastTonalSyncAt,
      }));
  },
});

export const patchBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("userProfiles").take(BATCH_SIZE);
    const now = Date.now();
    let patched = 0;
    for (const profile of profiles) {
      if (profile.nextTonalSyncAt !== undefined) continue;
      const next = computeNextSyncAt(now, profile.appLastActiveAt, profile.lastTonalSyncAt);
      if (next === undefined) continue;
      await ctx.db.patch(profile._id, { nextTonalSyncAt: next });
      patched++;
    }
    return { scanned: profiles.length, patched };
  },
});

/**
 * Single-pass backfill. Suitable for the project's user volume; if the table
 * grows past the 200-row batch this can be re-run until it reports patched=0.
 */
export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    let totalPatched = 0;
    let totalScanned = 0;
    while (true) {
      const result: { scanned: number; patched: number } = await ctx.runMutation(
        internal.migrations.backfillNextTonalSyncAt.patchBatch,
        {},
      );
      totalScanned += result.scanned;
      totalPatched += result.patched;
      if (result.patched === 0) break;
    }
    console.log(
      `[backfillNextTonalSyncAt] scanned ${totalScanned} profiles, patched ${totalPatched}`,
    );
    return { scanned: totalScanned, patched: totalPatched };
  },
});
