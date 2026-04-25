import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { isEligibleForRefresh, TIER_THRESHOLDS_MS } from "./cacheRefreshTiering";

export const refreshActiveUsers = internalAction({
  handler: async (ctx) => {
    const now = Date.now();
    const sinceTimestamp = now - TIER_THRESHOLDS_MS.lapsing;

    const activeUsers = await ctx.runQuery(internal.userActivity.getActiveUsers, {
      sinceTimestamp,
    });

    for (const profile of activeUsers) {
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
