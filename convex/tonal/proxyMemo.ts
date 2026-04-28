/**
 * Per-ActionCtx in-memory dedupe for Tonal proxy reads. The AI agent fans
 * many tool calls into a single action; the WeakMap-by-ctx pattern lets
 * entries GC when the action ends so there's no cross-request leak.
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

export function primeTokenMemo(ctx: ActionCtx, userId: Id<"users">, entry: TokenEntry): void {
  getTokenMemo(ctx).set(userId, Promise.resolve(entry));
}

export function clearTokenMemo(ctx: ActionCtx, userId: Id<"users">): void {
  getTokenMemo(ctx).delete(userId);
}
