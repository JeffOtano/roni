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
  // Provider transient errors (Gemini turn-ordering, Anthropic overload,
  // gRPC RESOURCE_EXHAUSTED) that streamWithRetry already surfaces as a
  // friendly user-facing message. The client stream consumer still throws,
  // which is what Sentry captures here.
  "function call turn comes immediately after",
  "model is currently experiencing high demand",
  "RESOURCE_EXHAUSTED",
  // Sanitized finalize code written by getFinalizeCodeForError when a transient
  // provider error is stored in messages:finalizeMessage. The client's stream
  // consumer re-throws the stored code verbatim, so both old (raw message) and
  // new (sanitized code) representations are suppressed here.
  "provider_overload",
  // Gemini free-tier quota errors. The leading "You exceeded" prefix is
  // Gemini's exact phrasing (capitalized "You exceeded ..."), so it covers
  // both the full billing sentence and truncated variants without matching
  // generic "...have exceeded your current quota" messages from other
  // services.
  "You exceeded your current quota",
  "generate_content_free_tier_requests",
  // Gemini paid-tier billing exhaustion: "Your prepayment credits are depleted."
  // classifyByokError catches this as byok_quota_exceeded server-side, but the
  // raw string can still escape if the failure occurs outside the sanitizer.
  "credits are depleted",
];

// Collect every candidate message from the hint and event so that quota errors
// nested in event.exception.values are not missed when hint.originalException
// carries a generic wrapper message.
function errorMessages(event: ErrorEvent, hint: EventHint): string[] {
  const messages: string[] = [];

  const hintError = hint.originalException;
  if (hintError instanceof Error && typeof hintError.message === "string") {
    messages.push(hintError.message);
  } else if (typeof hintError === "string") {
    messages.push(hintError);
  }

  const values = event.exception?.values;
  if (values) {
    for (const v of values) {
      if (typeof v?.value === "string") messages.push(v.value);
    }
  }

  if (typeof event.message === "string") messages.push(event.message);

  return messages;
}

export function shouldDropSentryEvent(event: ErrorEvent, hint: EventHint): boolean {
  const messages = errorMessages(event, hint);
  if (messages.length === 0) return false;
  return messages.some((msg) =>
    SUPPRESSED_MESSAGE_SUBSTRINGS.some((needle) => msg.includes(needle)),
  );
}

export function sentryBeforeSend(event: ErrorEvent, hint: EventHint): ErrorEvent | null {
  return shouldDropSentryEvent(event, hint) ? null : event;
}
