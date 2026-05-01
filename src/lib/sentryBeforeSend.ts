import type { ErrorEvent, EventHint } from "@sentry/nextjs";

const SUPPRESSED_MESSAGE_SUBSTRINGS: readonly string[] = [
  "byok_key_missing",
  "byok_model_missing",
  "byok_key_invalid",
  "byok_quota_exceeded",
  "byok_safety_blocked",
  "byok_unknown_error",
  "house_key_quota_exhausted",
  "tonal_invalid_credentials",
  "Wrong email or password",
  '"kind":"RateLimited"',
  "Not authenticated",
  // Gemini free-tier quota errors are handled: the user receives a friendly
  // rate-limit message. These strings surface via @convex-dev/agent's internal
  // finalizeMessage call before our sanitized code can be written, so they
  // appear in Sentry even though the error is fully handled.
  "exceeded your current quota",
  "generate_content_free_tier_requests",
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
