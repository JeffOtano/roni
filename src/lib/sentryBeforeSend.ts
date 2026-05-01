import type { ErrorEvent, EventHint } from "@sentry/nextjs";

// Mirrors src/lib/posthogBeforeSend.ts. Drops are split into three buckets:
//   1. Browser/extension noise we cannot fix (Firefox iOS Reader Mode injection,
//      Chrome extension `runtime.sendMessage`, cross-origin "Script error.",
//      benign "ResizeObserver loop" warnings, third-party site scripts).
//   2. Provider transient errors (Gemini quota / overload / model busy) that
//      streamWithRetry already surfaces to the user as a friendly attributed
//      message via reportError → buildProviderTransientMessage. They reach
//      Sentry only because the streaming response also throws on the client
//      stream consumer; capturing them adds noise without revealing new bugs.
//   3. Already-handled user-facing failure codes (BYOK errors, auth, rate
//      limit, tonal credentials).
const SUPPRESSED_MESSAGE_SUBSTRINGS: readonly string[] = [
  // Browser / extension noise
  "__firefox__.reader",
  "Invalid call to runtime.sendMessage",
  "ResizeObserver loop",
  "Script error.",
  "n.standardSelectors",
  // Already-handled BYOK / app-level codes
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
  // Gemini / provider transient errors that already produce an attributed
  // user-facing message server-side. The client stream consumer still throws,
  // which is what Sentry captures here.
  "function call turn comes immediately after",
  "exceeded your current quota",
  "model is currently experiencing high demand",
  "RESOURCE_EXHAUSTED",
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
