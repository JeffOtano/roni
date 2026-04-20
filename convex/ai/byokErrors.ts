import { APICallError } from "@ai-sdk/provider";
import { getProviderConfig, type ProviderId } from "./providers";

const SETTINGS_LINK = "[Settings](/settings)";

export type ByokErrorCode =
  | "byok_key_invalid"
  | "byok_quota_exceeded"
  | "byok_safety_blocked"
  | "byok_unknown_error";

export function buildByokErrorMessage(code: ByokErrorCode, provider: ProviderId): string {
  const config = getProviderConfig(provider);
  const billingLink = `[${config.label} billing](${config.billingUrl})`;
  switch (code) {
    case "byok_key_invalid":
      return `**${config.label} rejected your API key.** Check or replace it in ${SETTINGS_LINK}, then try again.`;
    case "byok_quota_exceeded":
      return `**${config.label} is rejecting requests** — your account is out of credit or over quota. Top up at ${billingLink}, or switch providers in ${SETTINGS_LINK}, then try again.`;
    case "byok_safety_blocked":
      return `**${config.label} blocked that response for safety.** Try rephrasing and sending again.`;
    case "byok_unknown_error":
      return `**${config.label} returned an unexpected error.** Check your key in ${SETTINGS_LINK} or try again later.`;
  }
}

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
    parts.push(JSON.stringify(error.data));
  }
  return parts.join(" ").toLowerCase();
}

export function classifyByokError(error: unknown): ByokErrorCode | null {
  if (!(error instanceof Error)) return null;

  // APICallError exposes a typed statusCode; fall back to ad-hoc `.status`
  // on bare errors (raw fetch, provider SDKs that don't wrap in APICallError).
  const status = APICallError.isInstance(error)
    ? error.statusCode
    : (error as Error & { status?: number }).status;
  const lower = gatherErrorText(error);

  if (status === 401 || status === 403) return "byok_key_invalid";
  if (
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("authentication_error") ||
    lower.includes("invalid_api_key") ||
    lower.includes("incorrect api key")
  ) {
    return "byok_key_invalid";
  }

  if (status === 429) return "byok_quota_exceeded";
  if (
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate_limit_error") ||
    lower.includes("rate_limit_exceeded") ||
    lower.includes("credits are depleted") ||
    lower.includes("credit balance") ||
    lower.includes("insufficient_quota") ||
    lower.includes("billing")
  ) {
    return "byok_quota_exceeded";
  }

  if (
    lower.includes("safety") ||
    lower.includes("blocked") ||
    lower.includes("content_policy") ||
    lower.includes("output_blocked") ||
    lower.includes("content_policy_violation")
  ) {
    return "byok_safety_blocked";
  }

  return null;
}

// Google AI error bodies can echo the decrypted key — never rethrow raw.
export async function withByokErrorSanitization<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = classifyByokError(err);
    if (code !== null) throw new Error(code);
    throw err;
  }
}
