import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { TableNames } from "./_generated/dataModel";

const APP_TABLES: TableNames[] = [
  "userProfiles",
  "checkIns",
  "tonalCache",
  "workoutPlans",
  "weekPlans",
  "progressPhotos",
  "oauthStates",
  "mcpApiKeys",
  "mcpUsage",
  "emailChangeRequests",
];

const AUTH_TABLES: TableNames[] = [
  "authAccounts",
  "authSessions",
  "authRefreshTokens",
  "authVerificationCodes",
  "authVerifiers",
  "authRateLimits",
];

const BATCH_SIZE = 500;

/**
 * Deletes up to BATCH_SIZE docs from one table. Returns true if more remain.
 */
export const clearTableBatch = internalMutation({
  args: { table: v.string() },
  handler: async (ctx, { table }) => {
    const docs = await ctx.db.query(table as TableNames).take(BATCH_SIZE);

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }

    return docs.length === BATCH_SIZE;
  },
});

/**
 * Wipes all production data. Run from the Convex dashboard:
 *   Functions > wipeData:wipeAllData > Run
 *
 * Set includeAuth=true to also clear auth tables (forces re-signup).
 */
export const wipeAllData = internalAction({
  args: {},
  handler: async (ctx) => {
    const tables = [...APP_TABLES, ...AUTH_TABLES];
    let totalDeleted = 0;

    for (const table of tables) {
      let hasMore = true;

      while (hasMore) {
        hasMore = await ctx.runMutation(internal.wipeData.clearTableBatch, {
          table,
        });
        totalDeleted += BATCH_SIZE;
      }

      console.log(`Cleared table: ${table}`);
    }

    console.log(
      `Wipe complete. Cleared ${tables.length} tables and ${totalDeleted} documents. You will need to sign up again.`,
    );
  },
});
