const CONVEX_DOC_LIMIT_BYTES = 1024 * 1024;
const CACHE_SIZE_HEADROOM_BYTES = 64 * 1024;
export const MAX_CACHE_VALUE_BYTES = CONVEX_DOC_LIMIT_BYTES - CACHE_SIZE_HEADROOM_BYTES;

const CONVEX_SIZE_ERROR_PATTERN =
  /\b(is|are) too (long|large)\b|\bmaximum (size|length)\b|\bexceeds? the maximum\b/i;

export function isConvexSizeError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return CONVEX_SIZE_ERROR_PATTERN.test(msg);
}

export function estimateCacheValueBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    // Unserializable payloads (circular refs, bigints) should never be cached.
    return Number.POSITIVE_INFINITY;
  }
}

export function isCacheValueWithinLimit(value: unknown): boolean {
  return estimateCacheValueBytes(value) <= MAX_CACHE_VALUE_BYTES;
}
