/**
 * Per-ActionCtx in-memory dedupe for Tonal proxy reads.
 *
 * The AI agent fans many tool calls into a single Convex action. Without this
 * dedupe, each tool independently re-reads userProfiles (for token decryption)
 * and re-runs cachedFetch's tonalCache lookup. The WeakMaps are keyed by ctx,
 * so entries are GC'd when the action ends — no cross-request leak.
 */

import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type TokenEntry = { token: string; tonalUserId: string };

const TOKEN_MEMO = new WeakMap<ActionCtx, Map<string, Promise<TokenEntry>>>();
const CACHED_FETCH_MEMO = new WeakMap<ActionCtx, Map<string, Promise<unknown>>>();

export function getTokenMemo(ctx: ActionCtx): Map<string, Promise<TokenEntry>> {
  let memo = TOKEN_MEMO.get(ctx);
  if (!memo) {
    memo = new Map();
    TOKEN_MEMO.set(ctx, memo);
  }
  return memo;
}

export function getCachedFetchMemo(ctx: ActionCtx): Map<string, Promise<unknown>> {
  let memo = CACHED_FETCH_MEMO.get(ctx);
  if (!memo) {
    memo = new Map();
    CACHED_FETCH_MEMO.set(ctx, memo);
  }
  return memo;
}

/**
 * Replace the request-scoped token memo entry for a user. Called by
 * withTokenRetry after a 401-driven refresh so subsequent withTonalToken
 * calls in the same action return the fresh token without another DB read.
 */
export function primeTokenMemo(ctx: ActionCtx, userId: Id<"users">, entry: TokenEntry): void {
  getTokenMemo(ctx).set(userId, Promise.resolve(entry));
}

/**
 * Drop the request-scoped token memo entry for a user. Called by
 * withTokenRetry when another writer is refreshing the token, so the next
 * withTonalToken call re-reads the freshly persisted credentials.
 */
export function clearTokenMemo(ctx: ActionCtx, userId: Id<"users">): void {
  getTokenMemo(ctx).delete(userId);
}
