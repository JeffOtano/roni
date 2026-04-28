// Substrings of error messages that PostHog should drop before sending. They
// fall into three buckets:
//   1. Browser/extension noise we cannot fix (Firefox iOS Reader Mode injection,
//      Chrome extension `runtime.sendMessage`, cross-origin "Script error.",
//      benign "ResizeObserver loop" warnings, third-party site scripts).
//   2. Provider transient errors (Gemini quota / overload / model busy) that
//      streamWithRetry already surfaces to the user as a friendly attributed
//      message via reportError → buildProviderTransientMessage. They reach
//      PostHog only because the streaming response also throws on the client
//      stream consumer; capturing them adds noise without revealing new bugs.
//   3. Already-handled user-facing failure codes (BYOK errors, auth, rate
//      limit) that we explicitly catch and render. Mirrors sentryBeforeSend.
const SUPPRESSED_MESSAGE_SUBSTRINGS: readonly string[] = [
  // Browser / extension noise
  "__firefox__.reader",
  "Invalid call to runtime.sendMessage",
  "ResizeObserver loop",
  "Script error.",
  "n.standardSelectors",
  // Already-handled BYOK / app-level codes (mirrors sentryBeforeSend.ts)
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
  // which is what PostHog captures here.
  "function call turn comes immediately after",
  "exceeded your current quota",
  "model is currently experiencing high demand",
  "RESOURCE_EXHAUSTED",
];

import type { CaptureResult } from "posthog-js";

function extractMessages(event: CaptureResult): string[] {
  const props = event.properties;
  if (!props || typeof props !== "object") return [];
  const messages: string[] = [];
  const message = (props as Record<string, unknown>).$exception_message;
  if (typeof message === "string") messages.push(message);
  const values = (props as Record<string, unknown>).$exception_values;
  if (Array.isArray(values)) {
    for (const entry of values) {
      if (entry && typeof (entry as { value?: unknown }).value === "string") {
        messages.push((entry as { value: string }).value);
      }
    }
  }
  const list = (props as Record<string, unknown>).$exception_list;
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (entry && typeof (entry as { value?: unknown }).value === "string") {
        messages.push((entry as { value: string }).value);
      }
    }
  }
  return messages;
}

export function shouldDropPosthogEvent(event: CaptureResult | null): boolean {
  if (!event) return false;
  if (event.event !== "$exception") return false;
  const messages = extractMessages(event);
  if (messages.length === 0) return false;
  return messages.some((msg) =>
    SUPPRESSED_MESSAGE_SUBSTRINGS.some((needle) => msg.includes(needle)),
  );
}

export function posthogBeforeSend(event: CaptureResult | null): CaptureResult | null {
  return shouldDropPosthogEvent(event) ? null : event;
}
