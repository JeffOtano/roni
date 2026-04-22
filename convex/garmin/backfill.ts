/**
 * Garmin Activity + Health backfill.
 *
 * Garmin supports requesting historical summary data (activities,
 * dailies, sleeps, stress, HRV) up to 90 days back via POST endpoints
 * on `/wellness-api/rest/backfill/{summaryType}`. Each request is
 * accepted asynchronously (HTTP 202); Garmin then fires the standard
 * Push webhooks for each chunk of historical data over the following
 * minutes.
 *
 * We trigger one request per summary type we consume. Raw payloads
 * land in `garminWebhookEvents` via the existing push routes, so
 * backfilled data participates in the same replay pipeline as live
 * data. When normalizers ship, a replay sweep will hydrate the domain
 * tables for every row that still has `status: "error"`.
 */

import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { decryptGarminSecret, getGarminAppConfig } from "./credentials";
import { signOAuth1Request } from "./oauth1";

const BACKFILL_BASE = "https://apis.garmin.com/wellness-api/rest/backfill";

/** Summary types we consume; each gets its own backfill request. */
const BACKFILL_SUMMARY_TYPES = ["activities", "dailies", "sleeps", "stressDetails", "hrv"] as const;

const MIN_DAYS = 1;
const MAX_DAYS = 90;
const SECONDS_PER_DAY = 86_400;

export type RequestGarminBackfillResult =
  | {
      success: true;
      windowDays: number;
      accepted: readonly string[];
      rejected: readonly { summaryType: string; status: number }[];
    }
  | { success: false; error: string };

export const requestGarminBackfill = action({
  args: {
    days: v.number(),
  },
  handler: async (ctx, { days }): Promise<RequestGarminBackfillResult> => {
    if (!Number.isFinite(days) || days < MIN_DAYS || days > MAX_DAYS) {
      return { success: false, error: `days must be between ${MIN_DAYS} and ${MAX_DAYS}` };
    }

    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) return { success: false, error: "Not authenticated" };

    try {
      await ctx.runMutation(internal.garmin.connections.acquireBackfillSlot, { userId });
    } catch {
      return {
        success: false,
        error: "Garmin backfill is limited to once per day. Please try again later.",
      };
    }

    const connection = await ctx.runQuery(internal.garmin.connections.getActiveConnectionByUserId, {
      userId,
    });
    if (!connection) {
      return { success: false, error: "Garmin is not connected" };
    }

    const [accessToken, accessTokenSecret] = await Promise.all([
      decryptGarminSecret(connection.accessTokenEncrypted),
      decryptGarminSecret(connection.accessTokenSecretEncrypted),
    ]);

    const config = getGarminAppConfig();
    const endSeconds = Math.floor(Date.now() / 1000);
    const startSeconds = endSeconds - days * SECONDS_PER_DAY;

    const accepted: string[] = [];
    const rejected: { summaryType: string; status: number }[] = [];

    for (const summaryType of BACKFILL_SUMMARY_TYPES) {
      const url = new URL(`${BACKFILL_BASE}/${summaryType}`);
      url.searchParams.set("summaryStartTimeInSeconds", String(startSeconds));
      url.searchParams.set("summaryEndTimeInSeconds", String(endSeconds));

      const signed = await signOAuth1Request(
        {
          consumerKey: config.consumerKey,
          consumerSecret: config.consumerSecret,
          token: accessToken,
          tokenSecret: accessTokenSecret,
        },
        { method: "POST", url: url.toString() },
      );

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { Authorization: signed.authorizationHeader },
      });

      // Garmin returns 202 Accepted for queued backfills; 200 can also
      // appear for immediate processing. Anything in 2xx is success.
      if (res.status >= 200 && res.status < 300) {
        accepted.push(summaryType);
      } else {
        rejected.push({ summaryType, status: res.status });
      }
    }

    return { success: true, windowDays: days, accepted, rejected };
  },
});
