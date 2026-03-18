import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { decryptToken, encryptToken, refreshTonalToken } from "./auth";

export const refreshExpiringTokens = internalAction({
  handler: async (ctx) => {
    const twoHoursFromNow = Date.now() + 2 * 60 * 60 * 1000;

    const expiring = await ctx.runQuery(internal.userProfiles.getExpiringTokens, {
      beforeTimestamp: twoHoursFromNow,
    });

    const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
    if (!keyHex) {
      console.error("TOKEN_ENCRYPTION_KEY not set — skipping token refresh");
      return;
    }

    for (const profile of expiring) {
      try {
        if (!profile.tonalRefreshToken) {
          console.warn(`No refresh token for user ${profile.userId} — skipping`);
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
      } catch (error) {
        console.error(`Failed to refresh token for user ${profile.userId}:`, error);
        void ctx.runAction(internal.discord.notifyError, {
          source: "tokenRefresh",
          message: `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`,
          userId: profile.userId,
        });
        await ctx.runMutation(internal.userProfiles.markTokenExpired, {
          userId: profile.userId,
        });
      }
    }
  },
});
