import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { patchUserActivity } from "./userProfileActivity";

export const migrations = new Migrations<DataModel>(components.migrations);
export const run = migrations.runner();

/**
 * Clear bogus avgWeightLbs on exercisePerformance rows.
 *
 * The old formula (totalVolume / totalReps) used Tonal's work-based
 * totalVolume metric, not actual weight. This produced values like
 * 650 lbs for a chest press. Nulling out forces the live paths
 * (which now use per-set avgWeight) to be the source of truth.
 *
 * Run: npx convex run migrations:run '{"fn": "migrations:clearBogusAvgWeight"}'
 */
export const clearBogusAvgWeight = migrations.define({
  table: "exercisePerformance",
  migrateOne: (_ctx, doc) => {
    if (doc.avgWeightLbs == null) return;
    return { avgWeightLbs: undefined };
  },
});

/**
 * Backfills `userProfileActivity` rows from the legacy fields on
 * `userProfiles` so readers can be cut over without losing existing state.
 * Idempotent — `patchUserActivity` upserts, so partial-then-full re-runs
 * converge.
 *
 * Run: npx convex run migrations:run '{"fn": "migrations:backfillUserProfileActivity"}'
 */
export const backfillUserProfileActivity = migrations.define({
  table: "userProfiles",
  migrateOne: async (ctx, doc) => {
    await patchUserActivity(ctx, doc.userId, {
      lastActiveAt: doc.lastActiveAt,
      appLastActiveAt: doc.appLastActiveAt,
      syncStatus: doc.syncStatus,
      lastSyncedActivityDate: doc.lastSyncedActivityDate,
      tokenRefreshInProgress: doc.tokenRefreshInProgress,
    });
  },
});
