import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { isEligibleForRefresh } from "./cacheRefreshTiering";

export const refreshActiveUsers = internalAction({
  handler: async (ctx) => {
    const now = Date.now();

    // Index range query: only profiles whose precomputed nextTonalSyncAt has
    // elapsed are read. The JS check below remains as a final tier gate so
    // users whose tier shifted to a longer cadence (without recordAppActivity
    // running to update nextTonalSyncAt) still get throttled correctly.
    const dueUsers = await ctx.runQuery(internal.userActivity.getUsersDueForRefresh, { now });

    for (const profile of dueUsers) {
      if (!isEligibleForRefresh(now, profile.appLastActiveAt, profile.lastTonalSyncAt)) {
        continue;
      }
      try {
        await ctx.runMutation(internal.tonal.historySync.startSyncUserHistory, {
          userId: profile.userId,
        });
      } catch (error) {
        console.error(`Failed to refresh data for user ${profile.userId}:`, error);
        void ctx.runAction(internal.discord.notifyError, {
          source: "cacheRefresh",
          message: `Data refresh failed for user ${profile.userId}: ${error instanceof Error ? error.message : String(error)}`,
          userId: profile.userId,
        });
      }
    }
  },
});
