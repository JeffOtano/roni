import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { GARMIN_PUSH_EVENT_TYPES } from "./garmin/webhookDispatch";
import { verifyGarminWebhookSignature } from "./garmin/webhookSignature";

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
        return new Response(sigCheck.reason ?? "Invalid signature", { status: 401 });
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
