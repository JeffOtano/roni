/**
 * Garmin Activity + Health backfill.
 *
 * Garmin supports requesting historical summary data (activities,
 * dailies, sleeps, stress, HRV) up to 90 days back via the Wellness
 * Backfill GET endpoints at `/wellness-api/rest/backfill/{summaryType}`.
 * Each request is accepted asynchronously (HTTP 202); Garmin then
 * replays the standard Push webhooks into `garminWebhookEvents` for
 * each chunk of historical data over the following minutes.
 *
 * We trigger one request per summary type we consume. Raw payloads
 * land in `garminWebhookEvents` via the existing push routes, so
 * backfilled data participates in the same replay pipeline as live
 * data. When normalizers ship, a replay sweep will hydrate the domain
 * tables for every row that still has `status: "error"`.
 */

import { isRateLimitError } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { decryptGarminSecret, getGarminAppConfig } from "./credentials";
import { signOAuth1Request } from "./oauth1";

const BACKFILL_BASE = "https://apis.garmin.com/wellness-api/rest/backfill";

/**
 * Summary types we backfill. Activity API V1.2.4 §8 + Health API V1.2.3
 * §8 both document GET /wellness-api/rest/backfill/{summaryType}. We
 * only request types we actually consume today; `activityDetails` and
 * `moveiq` remain "on hold" in the Developer Portal.
 *
 * Per-user cap: Garmin enforces 1 month of backfill per summary type
 * per user since first connection, so each summary type has its own
 * quota and can safely coexist in one run.
 */
const CORE_BACKFILL_SUMMARY_TYPES = ["activities", "dailies", "sleeps"] as const;

const DETAILED_RECOVERY_SUMMARY_TYPES = [
  "stressDetails",
  "hrv",
  "userMetrics",
  "pulseOx",
  "respiration",
  "skinTemp",
] as const;

const BACKFILL_SUMMARY_TYPES = [
  ...CORE_BACKFILL_SUMMARY_TYPES,
  ...DETAILED_RECOVERY_SUMMARY_TYPES,
] as const;

type BackfillSummaryType = (typeof BACKFILL_SUMMARY_TYPES)[number];
type BackfillRateLimitedEntry = {
  summaryType: string;
  retryAfterSeconds?: number;
  /**
   * Number of chunks for this summary type that were not issued because
   * Garmin rate-limited the run. Absent for summary types that never
   * had a request attempted (i.e. deferred entirely after another
   * summary type 429'd first).
   */
  deferredChunks?: number;
};

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

/**
 * Throttle between requests to stay under Garmin's per-user-per-minute cap.
 * This is intentionally conservative: the user is waiting for webhook data,
 * not for this action to finish instantly.
 */
const REQUEST_SPACING_MS = 3_000;
/**
 * Statuses that suggest a retry will likely succeed. 409 is NOT
 * retryable — it means we already requested this exact window.
 */
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
/** Backoff before retrying one failed request. */
const RETRY_BACKOFF_MS = 5_000;
const DEFAULT_RATE_LIMIT_RETRY_MS = 60_000;
const MAX_RATE_LIMIT_RETRY_MS = 2 * 60_000;
const FETCH_FAILURE_STATUS = 599;

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

export function parseRetryAfterMs(headerValue: string | null, nowMs: number): number | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (trimmed === "") return null;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - nowMs);
  }

  return null;
}

function boundedRetryDelayMs(headerValue: string | null): number {
  const parsedMs = parseRetryAfterMs(headerValue, Date.now());
  const retryMs = parsedMs ?? DEFAULT_RATE_LIMIT_RETRY_MS;
  return Math.min(Math.max(retryMs, RETRY_BACKOFF_MS), MAX_RATE_LIMIT_RETRY_MS);
}

function retryDelaySeconds(ms: number): number {
  return Math.ceil(ms / 1000);
}

function isDetailedRecoverySummary(summaryType: BackfillSummaryType): boolean {
  return (DETAILED_RECOVERY_SUMMARY_TYPES as readonly string[]).includes(summaryType);
}

export function remainingBackfillSummaryTypesAfter(
  summaryType: BackfillSummaryType,
): BackfillSummaryType[] {
  const index = BACKFILL_SUMMARY_TYPES.indexOf(summaryType);
  return index >= 0 ? BACKFILL_SUMMARY_TYPES.slice(index + 1) : [];
}

interface BackfillRequestResult {
  status: number;
  retryAfterSeconds?: number;
}

export type RequestGarminBackfillResult =
  | {
      success: true;
      windowDays: number;
      /** Summary types with at least one accepted chunk. */
      accepted: readonly string[];
      /** Summary types Garmin rate-limited. These can be retried later. */
      rateLimited: readonly {
        summaryType: string;
        retryAfterSeconds?: number;
        deferredChunks?: number;
      }[];
      /** Non-rate-limit failures — multiple entries per type possible. */
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

    // Acquire the daily slot only after we've confirmed there's a live
    // connection with decryptable secrets. Otherwise a missing/broken
    // connection would burn the user's once-per-day quota before we
    // could ever issue a request.
    try {
      await ctx.runMutation(internal.garmin.connections.acquireBackfillSlot, { userId });
    } catch (error) {
      if (!isRateLimitError(error)) {
        console.error("[garminBackfill] failed to acquire backfill rate-limit slot", {
          userId,
          error,
        });
        return {
          success: false,
          error: "Unable to start Garmin backfill. Please try again later.",
        };
      }
      return {
        success: false,
        error: "Garmin backfill is limited to once per day. Please try again later.",
      };
    }
    const endSeconds = Math.floor(Date.now() / 1000);
    const startSeconds = endSeconds - days * SECONDS_PER_DAY;

    const chunks = chunkWindow(startSeconds, endSeconds, MAX_DAYS_PER_REQUEST);
    const acceptedSet = new Set<string>();
    const rateLimited: BackfillRateLimitedEntry[] = [];
    const rejected: { summaryType: string; status: number }[] = [];
    let requestIndex = 0;
    let skipRemainingDetailedRecovery = false;
    let lastDetailedRecoveryRetryAfterSeconds: number | undefined;
    let stopAfterRateLimit = false;

    for (const summaryType of BACKFILL_SUMMARY_TYPES) {
      if (stopAfterRateLimit) break;
      if (skipRemainingDetailedRecovery && isDetailedRecoverySummary(summaryType)) {
        rateLimited.push({
          summaryType,
          retryAfterSeconds: lastDetailedRecoveryRetryAfterSeconds,
          deferredChunks: chunks.length,
        });
        continue;
      }

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
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

        const requestResult = await requestBackfillChunk(getOnce);

        if (requestResult.status === 429) {
          // The current chunk was rejected, and any chunks after it
          // weren't attempted. Record both so callers can reconstruct
          // exactly what still needs to be backfilled for this type.
          const deferredChunksForCurrentType = chunks.length - chunkIndex;
          rateLimited.push({
            summaryType,
            retryAfterSeconds: requestResult.retryAfterSeconds,
            deferredChunks: deferredChunksForCurrentType,
          });
          if (isDetailedRecoverySummary(summaryType)) {
            lastDetailedRecoveryRetryAfterSeconds = requestResult.retryAfterSeconds;
            skipRemainingDetailedRecovery = true;
            break;
          }
          rateLimited.push(
            ...remainingBackfillSummaryTypesAfter(summaryType).map((deferredSummaryType) => ({
              summaryType: deferredSummaryType,
              retryAfterSeconds: requestResult.retryAfterSeconds,
              deferredChunks: chunks.length,
            })),
          );
          stopAfterRateLimit = true;
          break;
        }

        // 202 Accepted is the documented happy path; some 2xx statuses
        // also indicate success. 409 means this exact window was
        // already requested — treat as success so the user isn't spooked.
        if (
          (requestResult.status >= 200 && requestResult.status < 300) ||
          requestResult.status === 409
        ) {
          acceptedSet.add(summaryType);
        } else {
          rejected.push({ summaryType, status: requestResult.status });
        }
      }
    }

    return {
      success: true,
      windowDays: days,
      accepted: Array.from(acceptedSet),
      rateLimited,
      rejected,
    };
  },
});

export async function requestBackfillChunk(
  getOnce: () => Promise<Response>,
): Promise<BackfillRequestResult> {
  let res: Response;
  try {
    res = await getOnce();
  } catch {
    return { status: FETCH_FAILURE_STATUS };
  }
  if (!RETRYABLE_STATUSES.has(res.status)) {
    return { status: res.status };
  }

  const retryDelayMs =
    res.status === 429 ? boundedRetryDelayMs(res.headers.get("retry-after")) : RETRY_BACKOFF_MS;
  await sleep(retryDelayMs);
  try {
    res = await getOnce();
  } catch {
    return { status: FETCH_FAILURE_STATUS };
  }

  if (res.status === 429) {
    return {
      status: res.status,
      retryAfterSeconds: retryDelaySeconds(boundedRetryDelayMs(res.headers.get("retry-after"))),
    };
  }

  return { status: res.status };
}
