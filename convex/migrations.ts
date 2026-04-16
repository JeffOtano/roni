import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

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
