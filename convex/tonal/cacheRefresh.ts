import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const refreshActiveUsers = internalAction({
  handler: async (ctx) => {
    const now = Date.now();

    // Index range query: only profiles whose precomputed nextTonalSyncAt has
    // elapsed are read. Eligibility (skip-tier age-out, tier transitions) is
    // handled inside startSyncUserHistory so a stale index entry self-heals
    // — the mutation patches/clears nextTonalSyncAt on its first pass.
    const dueUsers = await ctx.runQuery(internal.userActivity.getUsersDueForRefresh, { now });

    for (const profile of dueUsers) {
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
