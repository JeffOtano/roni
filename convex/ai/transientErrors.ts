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
  | "timeout"
  | "network"
  | "server_error";

function extractStatus(error: unknown): number | undefined {
  if (APICallError.isInstance(error)) return error.statusCode;
  if (error instanceof Error) return (error as Error & { status?: number }).status;
  return undefined;
}

export function classifyTransientError(error: unknown): TransientErrorKind | null {
  if (!isTransientError(error)) return null;

  if (error instanceof TypeError && error.message.includes("fetch")) return "network";

  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "timeout";
    const lower = error.message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("aborted")) return "timeout";
    if (OVERLOAD_MESSAGE_PATTERNS.some((p) => lower.includes(p))) return "provider_overload";
    if (lower.includes("rate limit") || lower.includes("resource_exhausted")) return "rate_limit";
  }

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
): string {
  const label = getProviderConfig(provider).label;
  switch (kind) {
    case "provider_overload":
      return `**${label} is experiencing high demand right now** — this is on their end, not Roni. Try again in a moment, or switch providers in ${SETTINGS_LINK} if it keeps happening.`;
    case "rate_limit":
      return `**${label} rate-limited this request.** Give it a minute and try again.`;
    case "timeout":
      return `**That request timed out on ${label}'s side.** Try again — a shorter message sometimes helps.`;
    case "network":
      return `**Network hiccup talking to ${label}.** Try again in a moment.`;
    case "server_error":
      return `**${label} returned a server error.** That's on their end, not Roni. Try again shortly.`;
  }
}
