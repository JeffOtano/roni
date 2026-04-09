import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { decryptToken, encryptToken, refreshTonalToken } from "./auth";
import * as analytics from "../lib/posthog";

export const refreshExpiringTokens = internalAction({
  handler: async (ctx) => {
    const twoHoursFromNow = Date.now() + 2 * 60 * 60 * 1000;

    const expiring = await ctx.runQuery(internal.userProfiles.getExpiringTokens, {
      beforeTimestamp: twoHoursFromNow,
    });

    const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
    if (!keyHex) {
      console.error("TOKEN_ENCRYPTION_KEY not set - skipping token refresh");
      return;
    }

    for (const profile of expiring) {
      try {
        if (!profile.tonalRefreshToken) {
          console.warn(`No refresh token for user ${profile.userId} - skipping`);
          continue;
        }

        // Skip if another refresh is in progress for this user
        const lockAcquired = await ctx.runMutation(internal.userProfiles.acquireTokenRefreshLock, {
          userId: profile.userId,
        });
        if (!lockAcquired) {
          console.log(`[tokenRefresh] Skipping ${profile.userId} - refresh already in progress`);
          continue;
        }

        const refreshToken = await decryptToken(profile.tonalRefreshToken, keyHex);
        const result = await refreshTonalToken(refreshToken);

        const encryptedToken = await encryptToken(result.idToken, keyHex);
        const encryptedRefresh = result.refreshToken
          ? await encryptToken(result.refreshToken, keyHex)
          : undefined;

        await ctx.runMutation(internal.userProfiles.updateTonalToken, {
          userId: profile.userId,
          tonalToken: encryptedToken,
          tonalRefreshToken: encryptedRefresh,
          tonalTokenExpiresAt: result.expiresAt,
        });

        await ctx.runMutation(internal.userProfiles.releaseTokenRefreshLock, {
          userId: profile.userId,
        });

        analytics.capture(profile.userId, "tonal_token_refreshed");
      } catch (error) {
        void ctx.runMutation(internal.userProfiles.releaseTokenRefreshLock, {
          userId: profile.userId,
        });
        console.error(`Failed to refresh token for user ${profile.userId}:`, error);
        void ctx.runAction(internal.discord.notifyError, {
          source: "tokenRefresh",
          message: `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
          userId: profile.userId,
        });
        await ctx.runMutation(internal.userProfiles.markTokenExpired, {
          userId: profile.userId,
        });

        analytics.capture(profile.userId, "tonal_token_refresh_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await analytics.flush();
  },
});
