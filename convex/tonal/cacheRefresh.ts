import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const refreshActiveUsers = internalAction({
  handler: async (ctx) => {
    const threeDaysAgo = Date.now() - 72 * 60 * 60 * 1000;

    const activeUsers = await ctx.runQuery(internal.userProfiles.getActiveUsers, {
      sinceTimestamp: threeDaysAgo,
    });

    for (const profile of activeUsers) {
      try {
        await ctx.runAction(internal.tonal.historySync.syncUserHistory, {
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
