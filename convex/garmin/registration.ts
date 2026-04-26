import { isRateLimitError } from "@convex-dev/rate-limiter";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { rateLimiter } from "../rateLimits";
import { decryptGarminSecret, getGarminAppConfig } from "./credentials";
import { signOAuth1Request } from "./oauth1";

const REGISTRATION_URL = "https://apis.garmin.com/wellness-api/rest/user/registration";
const GARMIN_REGISTRATION_FETCH_TIMEOUT_MS = 5_000;

export type DisconnectGarminResult =
  | { success: true; warning?: string }
  | { success: false; error: string };

export const disconnectMyGarmin = action({
  args: {},
  handler: async (ctx): Promise<DisconnectGarminResult> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) return { success: false, error: "Not authenticated" };

    try {
      await rateLimiter.limit(ctx, "disconnectMyGarmin", { key: userId, throws: true });
    } catch (error) {
      if (isRateLimitError(error)) {
        return {
          success: false,
          error: "Too many Garmin disconnect attempts. Please wait a minute and try again.",
        };
      }
      console.error("[garminRegistration] failed to acquire disconnect rate-limit slot", {
        userId,
        error,
      });
      return {
        success: false,
        error: "Unable to disconnect Garmin right now. Please try again later.",
      };
    }

    const connection = await ctx.runQuery(internal.garmin.connections.getActiveConnectionByUserId, {
      userId,
    });
    if (!connection) return { success: true };

    let warning: string | undefined;
    try {
      const [accessToken, accessTokenSecret] = await Promise.all([
        decryptGarminSecret(connection.accessTokenEncrypted),
        decryptGarminSecret(connection.accessTokenSecretEncrypted),
      ]);
      const config = getGarminAppConfig();
      const signed = await signOAuth1Request(
        {
          consumerKey: config.consumerKey,
          consumerSecret: config.consumerSecret,
          token: accessToken,
          tokenSecret: accessTokenSecret,
        },
        { method: "DELETE", url: REGISTRATION_URL },
      );

      const res = await fetch(REGISTRATION_URL, {
        method: "DELETE",
        headers: { Authorization: signed.authorizationHeader },
        signal: AbortSignal.timeout(GARMIN_REGISTRATION_FETCH_TIMEOUT_MS),
      });
      if (!res.ok && res.status !== 401 && res.status !== 403 && res.status !== 404) {
        warning = `Garmin registration removal returned ${res.status}; local disconnect completed.`;
      }
    } catch (error) {
      console.error("[garminRegistration] registration removal failed", {
        userId,
        error,
      });
      warning = "Garmin registration removal failed; local disconnect completed.";
    }

    await ctx.runMutation(internal.garmin.connections.markDisconnected, {
      userId,
      reason: "user_disconnected",
    });
    return warning ? { success: true, warning } : { success: true };
  },
});
