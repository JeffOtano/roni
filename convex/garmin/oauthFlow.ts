/**
 * Garmin Connect OAuth 1.0a 3-legged handshake.
 *
 * Step 1 (startGarminOAuth action, called from Next.js client with the
 *        authenticated Convex user):
 *   POST https://connectapi.garmin.com/oauth-service/oauth/request_token
 *   -> receive (oauth_token, oauth_token_secret) request-token pair
 *   -> persist in garminOauthStates keyed by oauth_token
 *   -> return authorize URL for the client to navigate to
 *
 * Step 2 (Garmin redirects the user's browser to our callback with
 *        oauth_token + oauth_verifier after the user authorizes):
 *   completeGarminOAuth is called from the /garmin/oauth/callback
 *   httpAction. It:
 *   -> looks up the state row, gets the request-token secret + userId
 *   -> POST https://connectapi.garmin.com/oauth-service/oauth/access_token
 *      signed with the request token + verifier, returns user access
 *      token + user access token secret (never expire)
 *   -> GET https://apis.garmin.com/wellness-api/rest/user/id for garminUserId
 *   -> GET https://apis.garmin.com/userPermissions/ to confirm grants
 *   -> upserts garminConnections
 */

import { v } from "convex/values";
import { isRateLimitError } from "@convex-dev/rate-limiter";
import { z } from "zod";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { decryptGarminSecret, encryptGarminSecret, getGarminAppConfig } from "./credentials";
import { signOAuth1Request } from "./oauth1";

const userIdResponseSchema = z.object({ userId: z.string().min(1) });
const permissionsResponseSchema = z.array(z.string());

const REQUEST_TOKEN_URL = "https://connectapi.garmin.com/oauth-service/oauth/request_token";
const ACCESS_TOKEN_URL = "https://connectapi.garmin.com/oauth-service/oauth/access_token";
const AUTHORIZE_URL = "https://connect.garmin.com/oauthConfirm";
const USER_ID_URL = "https://apis.garmin.com/wellness-api/rest/user/id";
const PERMISSIONS_URL = "https://apis.garmin.com/userPermissions/";
const GARMIN_OAUTH_FETCH_TIMEOUT_MS = 15_000;

function garminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(GARMIN_OAUTH_FETCH_TIMEOUT_MS),
  });
}

export function parseFormResponse(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(body);
  for (const [key, value] of params) {
    out[key] = value;
  }
  return out;
}

export async function parsePermissionsResponse(
  res: Response,
): Promise<{ success: true; permissions: string[] } | { success: false; error: string }> {
  if (!res.ok) {
    return { success: false, error: `Garmin permissions failed: ${res.status}` };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { success: false, error: "Malformed Garmin permissions response" };
  }

  const parsed = permissionsResponseSchema.safeParse(body);
  if (!parsed.success) {
    return { success: false, error: "Malformed Garmin permissions response" };
  }

  // An empty array is a valid response — it just means the user
  // granted no scopes. Callers decide whether to refuse that case.
  return { success: true, permissions: parsed.data };
}

export type StartGarminOAuthResult =
  | { success: true; authorizeUrl: string }
  | { success: false; error: string };

export const startGarminOAuth = action({
  args: {},
  handler: async (ctx): Promise<StartGarminOAuthResult> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) return { success: false, error: "Not authenticated" };

    try {
      await ctx.runMutation(internal.garmin.connections.acquireOauthStartSlot, { userId });
    } catch (error) {
      if (!isRateLimitError(error)) {
        console.error("[garminOAuth] failed to acquire OAuth start rate-limit slot", {
          userId,
          error,
        });
        return {
          success: false,
          error: "Unable to start Garmin connection. Please try again later.",
        };
      }
      return {
        success: false,
        error: "Too many Garmin connection attempts. Please wait a minute and try again.",
      };
    }

    try {
      const config = getGarminAppConfig();

      const signed = await signOAuth1Request(
        { consumerKey: config.consumerKey, consumerSecret: config.consumerSecret },
        {
          method: "POST",
          url: REQUEST_TOKEN_URL,
          extraSignableParams: { oauth_callback: config.callbackUrl },
        },
      );

      const res = await garminFetch(REQUEST_TOKEN_URL, {
        method: "POST",
        headers: { Authorization: signed.authorizationHeader },
      });
      if (!res.ok) {
        return { success: false, error: `Garmin request_token failed: ${res.status}` };
      }
      const parsed = parseFormResponse(await res.text());
      const requestToken = parsed.oauth_token;
      const requestTokenSecret = parsed.oauth_token_secret;
      if (!requestToken || !requestTokenSecret) {
        return { success: false, error: "Malformed Garmin request_token response" };
      }

      await ctx.runMutation(internal.garmin.connections.saveOauthState, {
        userId,
        requestToken,
        requestTokenSecretEncrypted: await encryptGarminSecret(requestTokenSecret),
      });

      const authorizeUrl = `${AUTHORIZE_URL}?oauth_token=${encodeURIComponent(requestToken)}`;
      return { success: true, authorizeUrl };
    } catch (error) {
      console.error("[garminOAuth] failed to start OAuth", error);
      return { success: false, error: "Failed to start Garmin OAuth. Please try again." };
    }
  },
});

export type CompleteGarminOAuthResult =
  | { success: true; garminUserId: string }
  | { success: false; error: string };

export const completeGarminOAuth = action({
  args: {
    oauthToken: v.string(),
    oauthVerifier: v.string(),
  },
  handler: async (ctx, args): Promise<CompleteGarminOAuthResult> => {
    // Identify the user completing the flow from their authenticated
    // session. This runs from the Next.js `/garmin/callback` page, so
    // the Convex client carries the session cookie/token.
    const sessionUserId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!sessionUserId) return { success: false, error: "Not authenticated" };

    const claim = await ctx.runMutation(internal.garmin.connections.claimOauthState, {
      requestToken: args.oauthToken,
    });
    if (!claim) return { success: false, error: "Unknown or expired OAuth state" };
    if (claim.userId !== sessionUserId) {
      // Either a CSRF attempt or the user switched accounts mid-flow.
      // Either way, refuse to link.
      return { success: false, error: "Session mismatch" };
    }
    const { userId } = claim;

    try {
      const requestTokenSecret = await decryptGarminSecret(claim.requestTokenSecretEncrypted);

      const config = getGarminAppConfig();

      const signed = await signOAuth1Request(
        {
          consumerKey: config.consumerKey,
          consumerSecret: config.consumerSecret,
          token: args.oauthToken,
          tokenSecret: requestTokenSecret,
        },
        {
          method: "POST",
          url: ACCESS_TOKEN_URL,
          extraSignableParams: { oauth_verifier: args.oauthVerifier },
        },
      );

      const accessRes = await garminFetch(ACCESS_TOKEN_URL, {
        method: "POST",
        headers: { Authorization: signed.authorizationHeader },
      });
      if (!accessRes.ok) {
        return { success: false, error: `Garmin access_token failed: ${accessRes.status}` };
      }
      const parsed = parseFormResponse(await accessRes.text());
      const accessToken = parsed.oauth_token;
      const accessTokenSecret = parsed.oauth_token_secret;
      if (!accessToken || !accessTokenSecret) {
        return { success: false, error: "Malformed Garmin access_token response" };
      }

      // The remaining calls all sign with the freshly-issued access
      // token + secret, so reuse one credentials object.
      const baseAuth = {
        consumerKey: config.consumerKey,
        consumerSecret: config.consumerSecret,
        token: accessToken,
        tokenSecret: accessTokenSecret,
      };

      // Fetch the Garmin user id so we can key webhook payloads to our user.
      const userIdSigned = await signOAuth1Request(baseAuth, {
        method: "GET",
        url: USER_ID_URL,
      });
      const userIdRes = await garminFetch(USER_ID_URL, {
        headers: { Authorization: userIdSigned.authorizationHeader },
      });
      if (!userIdRes.ok) {
        return { success: false, error: `Garmin /user/id failed: ${userIdRes.status}` };
      }
      const userIdParsed = userIdResponseSchema.safeParse(await userIdRes.json());
      if (!userIdParsed.success) {
        return { success: false, error: "Malformed Garmin /user/id response" };
      }
      const garminUserId = userIdParsed.data.userId;

      // Fetch permissions (at least WORKOUT_IMPORT is expected).
      const permSigned = await signOAuth1Request(baseAuth, {
        method: "GET",
        url: PERMISSIONS_URL,
      });
      const permRes = await garminFetch(PERMISSIONS_URL, {
        headers: { Authorization: permSigned.authorizationHeader },
      });
      const permissionsResult = await parsePermissionsResponse(permRes);
      if (!permissionsResult.success) {
        return { success: false, error: permissionsResult.error };
      }
      if (permissionsResult.permissions.length === 0) {
        return {
          success: false,
          error:
            "Garmin returned no granted permissions. Please reconnect and authorize the requested data scopes.",
        };
      }

      try {
        await ctx.runMutation(internal.garmin.connections.upsertConnection, {
          userId,
          garminUserId,
          accessTokenEncrypted: await encryptGarminSecret(accessToken),
          accessTokenSecretEncrypted: await encryptGarminSecret(accessTokenSecret),
          permissions: permissionsResult.permissions,
        });
      } catch (err) {
        const knownConflict =
          err instanceof Error &&
          err.message === "This Garmin account is already connected to another Roni account";
        if (knownConflict) {
          return { success: false, error: err.message };
        }
        console.error("[garminOAuth] failed to upsert Garmin connection", { userId, error: err });
        return { success: false, error: "Failed to save Garmin connection" };
      }

      return { success: true, garminUserId };
    } catch (error) {
      console.error("[garminOAuth] failed to complete OAuth", error);
      return {
        success: false,
        error: "Failed to complete Garmin OAuth. Please try connecting Garmin again.",
      };
    }
  },
});
