import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { GARMIN_PUSH_EVENT_TYPES } from "./garmin/webhookDispatch";
import {
  garminWebhookFailureStatus,
  verifyGarminWebhookSignature,
} from "./garmin/webhookSignature";
import { resolveAppOrigin } from "./httpOrigin";

const http = httpRouter();
auth.addHttpRoutes(http);

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
 *   1. Verifies the app-owned shared secret in the registered webhook URL.
 *   2. Logs the raw payload to garminWebhookEvents before any parsing so
 *      a normalizer bug never drops data we can't replay.
 *   3. Schedules a normalizer action, then ACKs 200 immediately so
 *      large backfill payload processing never holds Garmin's request
 *      open after the payload was already recorded.
 */
for (const eventType of GARMIN_PUSH_EVENT_TYPES) {
  http.route({
    path: `/garmin/webhook/${eventType}`,
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const rawBody = await req.text();
      const sigCheck = await verifyGarminWebhookSignature(req, rawBody);
      if (!sigCheck.valid) {
        return new Response(sigCheck.reason, {
          status: garminWebhookFailureStatus(sigCheck.reason),
        });
      }

      // Validate JSON up front so we reject malformed bodies before
      // allocating storage. The parsed object is discarded; downstream
      // functions re-parse after fetching from storage.
      try {
        JSON.parse(rawBody);
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      // Stash the full body in Convex file storage. Document fields
      // and function args are both capped at 1 MiB; multi-day dailies
      // backfill pushes routinely exceed that. Storage accepts up to
      // 1 GB per file.
      const rawPayloadStorageId = await ctx.storage.store(
        new Blob([rawBody], { type: "application/json" }),
      );

      const eventId = await (async () => {
        try {
          return await ctx.runMutation(internal.garmin.webhookEvents.recordReceived, {
            eventType,
            rawPayloadStorageId,
          });
        } catch (err) {
          console.error("[garmin] failed to record webhook payload", {
            rawPayloadStorageId,
            error: err,
          });
          // Without a webhookEvents row there is no eventId to dispatch or
          // reconcile, so fail this request and let Garmin retry the delivery.
          throw err;
        }
      })();

      try {
        await ctx.scheduler.runAfter(0, internal.garmin.webhookDispatch.dispatchGarminWebhook, {
          eventId,
          eventType,
          rawPayloadStorageId,
        });
      } catch (err) {
        try {
          await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
            eventId,
            status: "error",
            errorReason:
              err instanceof Error ? err.message : "Garmin webhook dispatch scheduling failed",
          });
        } catch {
          // The payload is already durably stored; ACK to avoid retry storms
          // even if marking the log row fails.
        }
      }

      return new Response(null, { status: 200 });
    }),
  });
}

export default http;
