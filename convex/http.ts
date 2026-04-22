import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { GARMIN_PUSH_EVENT_TYPES } from "./garmin/webhookDispatch";
import { verifyGarminWebhookSignature } from "./garmin/webhookSignature";

const http = httpRouter();
auth.addHttpRoutes(http);

/**
 * Resolve the Next.js app origin (e.g. `http://localhost:3000`) from
 * the configured post-oauth redirect URL, with a safe fallback.
 * Absolute redirects across hosts require a full URL in the Location
 * header; a relative path would resolve against `.convex.site`.
 */
function resolveAppOrigin(): string {
  const redirect = process.env.GARMIN_OAUTH_POST_REDIRECT_URL;
  if (redirect) {
    try {
      return new URL(redirect).origin;
    } catch {
      // fall through to default
    }
  }
  return "http://localhost:3000";
}

function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

/**
 * Garmin redirects the user's browser here at the end of the OAuth 1.0a
 * handshake with `oauth_token` and `oauth_verifier` query params.
 *
 * We do NOT complete the token exchange here. The Convex HTTP host
 * (`.convex.site`) is a different origin from the Next.js app, so the
 * user's session cookie is not attached to this request — we would
 * have no way to verify the browser session belongs to the user who
 * started the flow.
 *
 * Instead we bounce to `${appOrigin}/garmin/callback` on the Next.js
 * host, which has the session cookie. That page calls the public
 * `completeGarminOAuth` action, which derives the user from the
 * authenticated Convex client and enforces the session-binding CSRF
 * check before linking.
 */
http.route({
  path: "/garmin/oauth/callback",
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const url = new URL(req.url);
    const oauthToken = url.searchParams.get("oauth_token");
    const oauthVerifier = url.searchParams.get("oauth_verifier");
    const appOrigin = resolveAppOrigin();

    if (!oauthToken || !oauthVerifier) {
      return redirectResponse(`${appOrigin}/settings?garmin=error&reason=missing_params`);
    }

    const bounce = new URL("/garmin/callback", appOrigin);
    bounce.searchParams.set("oauth_token", oauthToken);
    bounce.searchParams.set("oauth_verifier", oauthVerifier);
    return redirectResponse(bounce.toString());
  }),
});

/**
 * Garmin Push webhooks. One URL per push type (Garmin's Developer Portal
 * requires this — each API summary type registers its own URL). Each
 * handler:
 *   1. Verifies the Garmin signature header (fails-closed until the
 *      Activity/Health API doc lands; set GARMIN_WEBHOOK_SIGNATURE_VERIFY=skip
 *      on dev only).
 *   2. Logs the raw payload to garminWebhookEvents before any parsing so
 *      a normalizer bug never drops data we can't replay.
 *   3. Dispatches a normalizer action, then ACKs 200 regardless of
 *      downstream processing outcome so Garmin's 24h retry doesn't fire
 *      for a bug we already recorded.
 */
for (const eventType of GARMIN_PUSH_EVENT_TYPES) {
  http.route({
    path: `/garmin/webhook/${eventType}`,
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const rawBody = await req.text();
      const sigCheck = await verifyGarminWebhookSignature(req, rawBody);
      if (!sigCheck.valid) {
        return new Response(sigCheck.reason, { status: 401 });
      }

      let payload: unknown;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      const eventId = await ctx.runMutation(internal.garmin.webhookEvents.recordReceived, {
        eventType,
        rawPayload: payload,
      });

      await ctx.runAction(internal.garmin.webhookDispatch.dispatchGarminWebhook, {
        eventId,
        eventType,
        rawPayload: payload,
      });

      return new Response(null, { status: 200 });
    }),
  });
}

export default http;
