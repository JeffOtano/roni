import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { mcpHandler } from "./mcp/server";
import { internal } from "./_generated/api";

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({
  path: "/mcp",
  method: "POST",
  handler: mcpHandler,
});

http.route({
  path: "/api/google-calendar/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const stateToken = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const fallbackUrl = process.env.APP_URL ?? "http://localhost:3000";

    // If Google returned an error, redirect with the error message.
    // We may not have a valid state token, so use fallback URL.
    if (error) {
      return Response.redirect(
        `${fallbackUrl}/settings?calendar_error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !stateToken) {
      return new Response("Missing code or state parameter", { status: 400 });
    }

    // Validate the opaque state token: must exist, be unused, and < 10 min old
    const stateResult = await ctx.runMutation(internal.calendarOAuth.consumeOAuthState, {
      token: stateToken,
      now: Date.now(),
    });

    if (!stateResult.ok) {
      const messages: Record<string, string> = {
        invalid_state: "Invalid OAuth state — please try connecting again",
        state_already_used: "OAuth state already used — please try connecting again",
        state_expired: "OAuth session expired — please try connecting again",
      };
      const msg = messages[stateResult.error] ?? "OAuth state validation failed";
      return Response.redirect(`${fallbackUrl}/settings?calendar_error=${encodeURIComponent(msg)}`);
    }

    const appUrl = stateResult.origin || fallbackUrl;

    try {
      await ctx.runAction(internal.calendar.handleCallback, {
        code,
        userId: stateResult.userId,
      });
      return Response.redirect(`${appUrl}/settings?calendar_connected=true`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("Google Calendar callback error:", message);
      return Response.redirect(
        `${appUrl}/settings?calendar_error=${encodeURIComponent("Failed to connect Google Calendar")}`,
      );
    }
  }),
});

export default http;
