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

/**
 * Summary types we backfill. The Activity API V1.2.4 doc §8 also lists
 * `activityDetails` and `moveiq`, but those are rejected with 400
 * unless the partner has enabled those endpoint types in the Developer
 * Portal. We only consume activities today, so keep the list aligned
 * with what's enabled. Health API summaries (dailies, sleeps, etc.)
 * live under a different backfill surface.
 */
const BACKFILL_SUMMARY_TYPES = ["activities"] as const;

const MIN_DAYS = 1;
/**
 * Max days per backfill *call* is 30 per Garmin's Activity API spec
 * (Summary Backfill section). We can issue multiple calls to cover a
 * larger window, but each single call must stay within 30 days.
 */
const MAX_DAYS_PER_REQUEST = 30;
/** Max days per overall backfill *run*, chunked into 30-day requests. */
const MAX_DAYS = 90;
const SECONDS_PER_DAY = 86_400;

/** Throttle between requests to stay under Garmin's per-user-per-minute cap. */
const REQUEST_SPACING_MS = 500;
/**
 * Statuses that suggest a retry will likely succeed. 409 is NOT
 * retryable — it means we already requested this exact window.
 */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
/** Backoff before retrying one failed request. */
const RETRY_BACKOFF_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Split a full window into N 30-day chunks, oldest-first. */
export function chunkWindow(
  startSeconds: number,
  endSeconds: number,
  maxDaysPerChunk: number,
): { start: number; end: number }[] {
  const chunks: { start: number; end: number }[] = [];
  const chunkSeconds = maxDaysPerChunk * SECONDS_PER_DAY;
  let cursor = startSeconds;
  while (cursor < endSeconds) {
    const chunkEnd = Math.min(cursor + chunkSeconds, endSeconds);
    chunks.push({ start: cursor, end: chunkEnd });
    cursor = chunkEnd;
  }
  return chunks;
}

export type RequestGarminBackfillResult =
  | {
      success: true;
      windowDays: number;
      /** Summary types with at least one accepted chunk. */
      accepted: readonly string[];
      /** Any chunk that failed — multiple entries per type possible. */
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

    const chunks = chunkWindow(startSeconds, endSeconds, MAX_DAYS_PER_REQUEST);
    const acceptedSet = new Set<string>();
    const rejected: { summaryType: string; status: number }[] = [];
    let requestIndex = 0;

    for (const summaryType of BACKFILL_SUMMARY_TYPES) {
      for (const chunk of chunks) {
        if (requestIndex > 0) await sleep(REQUEST_SPACING_MS);
        requestIndex++;

        const url = new URL(`${BACKFILL_BASE}/${summaryType}`);
        url.searchParams.set("summaryStartTimeInSeconds", String(chunk.start));
        url.searchParams.set("summaryEndTimeInSeconds", String(chunk.end));

        const getOnce = async (): Promise<Response> => {
          // Signature must be fresh per attempt — nonce + timestamp are
          // re-generated so retries aren't flagged as replays.
          const signed = await signOAuth1Request(
            {
              consumerKey: config.consumerKey,
              consumerSecret: config.consumerSecret,
              token: accessToken,
              tokenSecret: accessTokenSecret,
            },
            { method: "GET", url: url.toString() },
          );
          return fetch(url.toString(), {
            method: "GET",
            headers: { Authorization: signed.authorizationHeader },
          });
        };

        let res = await getOnce();
        if (RETRYABLE_STATUSES.has(res.status)) {
          await sleep(RETRY_BACKOFF_MS);
          res = await getOnce();
        }

        // 202 Accepted is the documented happy path; some 2xx statuses
        // also indicate success. 409 means this exact window was
        // already requested — treat as success so the user isn't spooked.
        if ((res.status >= 200 && res.status < 300) || res.status === 409) {
          acceptedSet.add(summaryType);
        } else {
          rejected.push({ summaryType, status: res.status });
        }
      }
    }

    return {
      success: true,
      windowDays: days,
      accepted: Array.from(acceptedSet),
      rejected,
    };
  },
});
