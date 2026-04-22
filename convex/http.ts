import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

/**
 * Destination the browser lands on after a Garmin OAuth handshake. Set
 * via env so each environment (local, preview, prod) can redirect to its
 * own Next.js host. Falls back to the bare callback URL's origin.
 */
function resolvePostOauthRedirect(): string {
  return process.env.GARMIN_OAUTH_POST_REDIRECT_URL ?? "/settings";
}

/**
 * Garmin redirects the user's browser here at the end of the OAuth 1.0a
 * handshake with `oauth_token` and `oauth_verifier` query params. We look
 * up the request-token row we persisted at step 1, exchange for a
 * user-access-token pair, and upsert garminConnections.
 */
http.route({
  path: "/garmin/oauth/callback",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const oauthToken = url.searchParams.get("oauth_token");
    const oauthVerifier = url.searchParams.get("oauth_verifier");
    const base = resolvePostOauthRedirect();

    if (!oauthToken || !oauthVerifier) {
      return Response.redirect(`${base}?garmin=error&reason=missing_params`, 302);
    }

    const result = await ctx.runAction(internal.garmin.oauthFlow.completeGarminOAuth, {
      oauthToken,
      oauthVerifier,
    });

    if (!result.success) {
      const reason = encodeURIComponent(result.error);
      return Response.redirect(`${base}?garmin=error&reason=${reason}`, 302);
    }
    return Response.redirect(`${base}?garmin=connected`, 302);
  }),
});

export default http;
