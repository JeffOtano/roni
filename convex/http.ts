import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { mcpHandler } from "./mcp/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

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
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Google returns an error param if the user denied access
    if (error) {
      return Response.redirect(
        `${getAppUrl()}/settings?calendar_error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return new Response("Missing code or state parameter", { status: 400 });
    }

    const userId = state as Id<"users">;

    try {
      await ctx.runAction(internal.calendar.handleCallback, { code, userId });
      return Response.redirect(`${getAppUrl()}/settings?calendar_connected=true`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("Google Calendar callback error:", message);
      return Response.redirect(
        `${getAppUrl()}/settings?calendar_error=${encodeURIComponent("Failed to connect Google Calendar")}`,
      );
    }
  }),
});

function getAppUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export default http;
