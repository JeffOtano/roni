import { APICallError } from "@ai-sdk/provider";

// ---------------------------------------------------------------------------
// Transient error classification
// ---------------------------------------------------------------------------

const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503]);

const TRANSIENT_MESSAGE_PATTERNS = [
  "high demand",
  "unavailable",
  "overloaded",
  "try again later",
  "rate limit",
  "resource_exhausted",
];

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
    if (typeof status === "number" && TRANSIENT_STATUS_CODES.has(status)) return true;
  }

  return false;
}
