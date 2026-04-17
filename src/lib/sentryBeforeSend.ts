import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * Messages that are intentional control-flow signals, not system failures.
 * Dropping them here keeps Sentry focused on real bugs.
 */
const SUPPRESSED_MESSAGE_SUBSTRINGS: readonly string[] = [
  // BYOK sentinels rethrown by withByokErrorSanitization / resolveProviderKey
  "byok_key_missing",
  "byok_model_missing",
  "byok_key_invalid",
  "byok_quota_exceeded",
  "byok_safety_blocked",
  "byok_unknown_error",
  "house_key_quota_exhausted",
  // User input, not a bug
  "tonal_invalid_credentials",
  "Wrong email or password",
  // Convex rate limiter — expected user-facing cap
  '"kind":"RateLimited"',
  // Auth guards firing from race conditions between session + navigation
  "Not authenticated",
];

function errorMessage(event: ErrorEvent, hint: EventHint): string | null {
  const hintError = hint.originalException;
  if (hintError instanceof Error && typeof hintError.message === "string") {
    return hintError.message;
  }
  if (typeof hintError === "string") return hintError;

  const values = event.exception?.values;
  if (values && values.length > 0) {
    const last = values[values.length - 1]?.value;
    if (typeof last === "string") return last;
  }

  if (typeof event.message === "string") return event.message;
  return null;
}

export function shouldDropSentryEvent(event: ErrorEvent, hint: EventHint): boolean {
  const message = errorMessage(event, hint);
  if (!message) return false;
  return SUPPRESSED_MESSAGE_SUBSTRINGS.some((needle) => message.includes(needle));
}

export function sentryBeforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  return shouldDropSentryEvent(event, hint) ? null : event;
}
