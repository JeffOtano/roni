import { APICallError } from "@ai-sdk/provider";
import { getProviderConfig, type ProviderId } from "./providers";

// ---------------------------------------------------------------------------
// Transient error classification
// ---------------------------------------------------------------------------

const TRANSIENT_MESSAGE_PATTERNS = [
  "high demand",
  "unavailable",
  "overloaded",
  "try again later",
  "rate limit",
  "resource_exhausted",
];

const OVERLOAD_MESSAGE_PATTERNS = ["high demand", "unavailable", "overloaded", "try again later"];

// Vercel AI SDK wraps provider errors: .message is generic, the real text
// lives on .responseBody / .cause.message. Pattern-match across all of them.
function gatherErrorText(error: Error): string {
  const parts: string[] = [error.message];
  if ("responseBody" in error && typeof error.responseBody === "string") {
    parts.push(error.responseBody);
  }
  if ("cause" in error && error.cause instanceof Error) {
    parts.push(error.cause.message);
  }
  if ("data" in error && error.data && typeof error.data === "object") {
    try {
      parts.push(JSON.stringify(error.data));
    } catch {
      // Circular refs or BigInts in error.data must not crash classification —
      // we still have .message + .responseBody to work with.
    }
  }
  return parts.join(" ").toLowerCase();
}

/**
 * Quota errors are technically retryable per HTTP semantics (status 429),
 * but Gemini's RPM/RPD/input-token quotas don't clear in the 3s retry window.
 * Treat them as terminal so we don't waste two extra attempts + ~6s.
 */
export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = gatherErrorText(error);
  if (isInputTokenCountQuota(text)) return true;
  if (text.includes("you exceeded your current quota")) return true;
  if (text.includes("resource_exhausted") && text.includes("quota")) return true;
  if (text.includes("insufficient_quota")) return true;
  return false;
}

/**
 * Distinguishes Gemini's input-token quota (context too large) from other
 * quota variants. Surfaces a "start a fresh thread" message instead of the
 * generic rate-limit one.
 */
export function isContextLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return isInputTokenCountQuota(gatherErrorText(error));
}

// Require both the metric name AND an exceed/quota signal — a hypothetical
// malformed-prompt error that mentions `input_token_count` shouldn't be
// reclassified as a transient quota error and silently swallow Discord pages.
function isInputTokenCountQuota(text: string): boolean {
  if (!text.includes("input_token_count")) return false;
  return (
    text.includes("quota") ||
    text.includes("exceed") || // matches exceed / exceeds / exceeded
    text.includes("limit") || // Gemini sometimes phrases as "limit reached" / "limit exceeded"
    text.includes("resource_exhausted")
  );
}

export function isTransientError(error: unknown): boolean {
  // Prefer the SDK's own retry decision — it knows provider-specific cases
  // like Anthropic 529 "overloaded" that our pattern list would miss.
  if (APICallError.isInstance(error)) return error.isRetryable;

  if (error instanceof TypeError && error.message.includes("fetch")) return true;

  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return true;

    const lower = error.message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("aborted")) return true;
    if (TRANSIENT_MESSAGE_PATTERNS.some((p) => lower.includes(p))) return true;

    const status = (error as Error & { status?: number }).status;
    if (typeof status === "number") {
      if (status === 429 || (status >= 500 && status <= 599)) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Transient error kind — drives user-facing messaging
// ---------------------------------------------------------------------------

export type TransientErrorKind =
  | "provider_overload"
  | "rate_limit"
  | "context_limit"
  | "timeout"
  | "network"
  | "server_error";

function extractStatus(error: unknown): number | undefined {
  if (APICallError.isInstance(error)) return error.statusCode;
  if (error instanceof Error) return (error as Error & { status?: number }).status;
  return undefined;
}

export function classifyTransientError(error: unknown): TransientErrorKind | null {
  // Context-limit quota is checked before isTransientError because we treat
  // it as terminal (skip retries) but still want a transient-style message.
  // isContextLimitError already requires a quota signal, so unrelated errors
  // mentioning "input_token_count" won't reach this branch.
  if (isContextLimitError(error)) return "context_limit";

  if (!isTransientError(error) && !isQuotaError(error)) return null;

  if (error instanceof TypeError && error.message.includes("fetch")) return "network";

  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "timeout";
    const lower = error.message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("aborted")) return "timeout";
    if (OVERLOAD_MESSAGE_PATTERNS.some((p) => lower.includes(p))) return "provider_overload";
    if (lower.includes("rate limit") || lower.includes("resource_exhausted")) return "rate_limit";
  }

  if (isQuotaError(error)) return "rate_limit";

  const status = extractStatus(error);
  if (status === 429) return "rate_limit";
  if (typeof status === "number" && status >= 500) return "server_error";

  // Transient but unmatched (e.g., APICallError with isRetryable=true and no
  // recognizable message/status). Overload is the safest user-facing framing.
  return "provider_overload";
}

// ---------------------------------------------------------------------------
// User-facing messages that attribute the outage to the upstream provider
// ---------------------------------------------------------------------------

const SETTINGS_LINK = "[Settings](/settings)";

export function buildProviderTransientMessage(
  kind: TransientErrorKind,
  provider: ProviderId,
  isByok?: boolean,
): string {
  const label = getProviderConfig(provider).label;
  switch (kind) {
    case "provider_overload":
      return `**${label} is experiencing high demand right now** — this is on their end, not Roni. Try again in a moment, or switch providers in ${SETTINGS_LINK} if it keeps happening.`;
    case "rate_limit": {
      const base = `**${label} rate-limited this request.** Give it a minute and try again.`;
      if (isByok === false) {
        return `${base} If this keeps happening, add your own ${label} API key in ${SETTINGS_LINK} to avoid the shared quota.`;
      }
      return base;
    }
    case "context_limit":
      return `**This conversation has gotten too long for ${label}.** Start a fresh chat thread to continue.`;
    case "timeout":
      return `**That request timed out on ${label}'s side.** Try again — a shorter message sometimes helps.`;
    case "network":
      return `**Network hiccup talking to ${label}.** Try again in a moment.`;
    case "server_error":
      return `**${label} returned a server error.** That's on their end, not Roni. Try again shortly.`;
  }
}
