import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { decrypt, encrypt } from "./tonal/encryption";
import { googleFetch, refreshGoogleToken } from "./google/client";
import { type AvailableSlot, findGaps, type FreeBusyResponse } from "./calendarHelpers";

// Re-export for test backward compatibility
export { findGaps } from "./calendarHelpers";

const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

function getEncryptionKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY env var is not set");
  return key;
}

function getGoogleCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must be set");
  }
  return { clientId, clientSecret, redirectUri };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const isCalendarConnected = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { connected: false };

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile?.googleCalendarEnabled) return { connected: false };

    return {
      connected: true,
      calendarId: profile.googleCalendarId ?? "primary",
    };
  },
});

export const getCalendarSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile) return null;

    return {
      connected: profile.googleCalendarEnabled === true,
      calendarId: profile.googleCalendarId ?? "primary",
      hasRefreshToken: profile.googleCalendarRefreshToken !== undefined,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const disconnectCalendar = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("User profile not found");

    await ctx.db.patch(profile._id, {
      googleCalendarToken: undefined,
      googleCalendarRefreshToken: undefined,
      googleCalendarTokenExpiresAt: undefined,
      googleCalendarEnabled: false,
      googleCalendarId: undefined,
    });
  },
});

// ---------------------------------------------------------------------------
// Internal mutations/queries (for actions to call)
// ---------------------------------------------------------------------------

export const storeGoogleTokens = internalMutation({
  args: {
    userId: v.id("users"),
    encryptedToken: v.string(),
    encryptedRefreshToken: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, { userId, encryptedToken, encryptedRefreshToken, expiresAt }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("User profile not found");

    await ctx.db.patch(profile._id, {
      googleCalendarToken: encryptedToken,
      ...(encryptedRefreshToken !== undefined && {
        googleCalendarRefreshToken: encryptedRefreshToken,
      }),
      googleCalendarTokenExpiresAt: expiresAt,
      googleCalendarEnabled: true,
    });
  },
});

export const getGoogleTokens = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile?.googleCalendarEnabled) return null;

    return {
      encryptedToken: profile.googleCalendarToken,
      encryptedRefreshToken: profile.googleCalendarRefreshToken,
      expiresAt: profile.googleCalendarTokenExpiresAt,
      calendarId: profile.googleCalendarId ?? "primary",
    };
  },
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const getAuthUrl = action({
  args: { origin: v.optional(v.string()) },
  handler: async (ctx, args): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { clientId, redirectUri } = getGoogleCredentials();

    // Generate an opaque, single-use state token for CSRF protection
    const token = crypto.randomUUID();
    await ctx.runMutation(internal.calendarOAuth.createOAuthState, {
      token,
      userId,
      origin: args.origin ?? "",
      createdAt: Date.now(),
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_CALENDAR_SCOPES,
      access_type: "offline",
      prompt: "consent",
      state: token,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },
});

export const handleCallback = internalAction({
  args: {
    code: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, { code, userId }) => {
    const { clientId, clientSecret, redirectUri } = getGoogleCredentials();

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      throw new Error(`Google token exchange failed (${res.status}): ${body}`);
    }

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    const keyHex = getEncryptionKey();
    const encryptedToken = await encrypt(tokens.access_token, keyHex);
    const encryptedRefreshToken = tokens.refresh_token
      ? await encrypt(tokens.refresh_token, keyHex)
      : undefined;
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    await ctx.runMutation(internal.calendar.storeGoogleTokens, {
      userId,
      encryptedToken,
      encryptedRefreshToken,
      expiresAt,
    });
  },
});

/** Resolve a valid Google access token, refreshing if expired. */
async function resolveGoogleToken(
  ctx: ActionCtx,
  userId: Id<"users">,
): Promise<{ token: string; calendarId: string }> {
  const stored = await ctx.runQuery(internal.calendar.getGoogleTokens, { userId });
  if (!stored?.encryptedToken) {
    throw new Error("Google Calendar not connected — user must authorize first");
  }

  const keyHex = getEncryptionKey();
  const now = Date.now();
  const bufferMs = 60_000; // refresh 1 min early

  if (stored.expiresAt && stored.expiresAt > now + bufferMs) {
    const token = await decrypt(stored.encryptedToken, keyHex);
    return { token, calendarId: stored.calendarId };
  }

  // Token expired or about to expire -- refresh
  if (!stored.encryptedRefreshToken) {
    throw new Error(
      "Google Calendar token expired and no refresh token available — user must re-authorize",
    );
  }

  const refreshToken = await decrypt(stored.encryptedRefreshToken, keyHex);
  const refreshed = await refreshGoogleToken(refreshToken);
  const encryptedToken = await encrypt(refreshed.access_token, keyHex);
  const expiresAt = now + refreshed.expires_in * 1000;

  await ctx.runMutation(internal.calendar.storeGoogleTokens, {
    userId,
    encryptedToken,
    expiresAt,
  });

  return { token: refreshed.access_token, calendarId: stored.calendarId };
}

export const createCalendarEvent = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    date: v.string(),
    durationMinutes: v.number(),
    description: v.optional(v.string()),
    workoutPlanId: v.optional(v.id("workoutPlans")),
  },
  handler: async (ctx, args): Promise<string | null> => {
    // Skip silently if user hasn't connected Google Calendar
    const stored = await ctx.runQuery(internal.calendar.getGoogleTokens, { userId: args.userId });
    if (!stored?.encryptedToken) return null;

    try {
      const { token, calendarId } = await resolveGoogleToken(ctx, args.userId);

      const startDate = new Date(args.date);
      const endDate = new Date(startDate.getTime() + args.durationMinutes * 60_000);

      const description = args.description ?? "Workout programmed by tonal.coach";

      type CalendarEvent = { id: string };
      const event = await googleFetch<CalendarEvent>(
        token,
        `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: "POST",
          body: {
            summary: args.title,
            description,
            start: { dateTime: startDate.toISOString() },
            end: { dateTime: endDate.toISOString() },
          },
        },
      );

      return event.id;
    } catch (e) {
      // Calendar event creation should never block workout pushes
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Failed to create calendar event for user ${args.userId}: ${message}`);
      return null;
    }
  },
});

export const getAvailableSlots = action({
  args: {
    date: v.string(),
    durationMinutes: v.number(),
  },
  handler: async (ctx, { date, durationMinutes }): Promise<AvailableSlot[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { token, calendarId } = await resolveGoogleToken(ctx, userId);

    // Query window: 6am to 10pm on the given date
    const dayStart = new Date(`${date}T06:00:00`);
    const dayEnd = new Date(`${date}T22:00:00`);

    const freeBusy = await googleFetch<FreeBusyResponse>(token, "/calendar/v3/freeBusy", {
      method: "POST",
      body: {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const busySlots = freeBusy.calendars[calendarId]?.busy ?? [];
    return findGaps(dayStart, dayEnd, busySlots, durationMinutes);
  },
});
