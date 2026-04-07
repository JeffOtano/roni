import type { FailureReason } from "@/components/byok/FailureBanner";

const BYOK_ERROR_CODES: readonly FailureReason[] = [
  "byok_key_invalid",
  "byok_quota_exceeded",
  "byok_safety_blocked",
  "byok_unknown_error",
  "byok_key_missing",
] as const;

/**
 * Extracts a BYOK FailureReason from an unknown error thrown by the backend.
 *
 * The backend throws plain `new Error("byok_key_invalid")` style errors. Convex
 * wraps these on the wire, so the message the client sees may contain extra
 * framing around the code. We match on substring to stay resilient.
 *
 * Returns null when the error is not a recognized BYOK failure, so callers can
 * fall through to their generic error handling.
 */
export function parseByokError(err: unknown): FailureReason | null {
  const message = err instanceof Error ? err.message : String(err);
  return BYOK_ERROR_CODES.find((code) => message.includes(code)) ?? null;
}
