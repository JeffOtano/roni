import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const refreshActiveUsers = internalAction({
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const activeUsers = await ctx.runQuery(
      internal.userProfiles.getActiveUsers,
      { sinceTimestamp: oneDayAgo },
    );

    for (const profile of activeUsers) {
      try {
        // Refresh strength scores (1h TTL — most likely stale)
        await ctx.runAction(internal.tonal.proxy.fetchStrengthScores, {
          userId: profile.userId,
        });

        // Refresh muscle readiness (30m TTL)
        await ctx.runAction(internal.tonal.proxy.fetchMuscleReadiness, {
          userId: profile.userId,
        });

        // Refresh workout history (30m TTL)
        await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
          userId: profile.userId,
        });
      } catch (error) {
        console.error(
          `Failed to refresh cache for user ${profile.userId}:`,
          error,
        );
      }
    }
  },
});
