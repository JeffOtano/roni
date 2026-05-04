import type { CaptureResult } from "posthog-js";

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
  // Gemini paid-tier billing exhaustion: surfaces as "Your prepayment credits
  // are depleted." for both BYOK and house-key users. classifyByokError maps
  // this to byok_quota_exceeded server-side, but the raw string can still
  // escape if the failure happens outside withByokErrorSanitization.
  "credits are depleted",
];

function getStringProp(props: Record<string, unknown>, key: string): string | undefined {
  const value = props[key];
  return typeof value === "string" ? value : undefined;
}

function getArrayProp(props: Record<string, unknown>, key: string): unknown[] | undefined {
  const value = props[key];
  return Array.isArray(value) ? value : undefined;
}

function entryValueString(entry: unknown): string | undefined {
  if (entry === null || typeof entry !== "object") return undefined;
  if (!("value" in entry)) return undefined;
  const value = (entry as { value: unknown }).value;
  return typeof value === "string" ? value : undefined;
}

function extractMessages(event: CaptureResult): string[] {
  const rawProps = event.properties;
  if (!rawProps || typeof rawProps !== "object") return [];
  const props = rawProps as Record<string, unknown>;

  const messages: string[] = [];

  const message = getStringProp(props, "$exception_message");
  if (message !== undefined) messages.push(message);

  for (const entry of getArrayProp(props, "$exception_values") ?? []) {
    const value = entryValueString(entry);
    if (value !== undefined) messages.push(value);
  }

  for (const entry of getArrayProp(props, "$exception_list") ?? []) {
    const value = entryValueString(entry);
    if (value !== undefined) messages.push(value);
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
