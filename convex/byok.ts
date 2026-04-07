// BYOK (bring-your-own-key) grandfathering gate.
//
// Users whose _creationTime is before BYOK_REQUIRED_AFTER are grandfathered
// on the shared Gemini key (set via GOOGLE_GENERATIVE_AI_API_KEY env var).
//
// Users whose _creationTime is at or after BYOK_REQUIRED_AFTER must provide
// their own Gemini API key via the onboarding flow before they can use chat.
//
// IMPORTANT: BYOK_REQUIRED_AFTER below is a placeholder value (year 2286)
// so that all current users and test fixtures are grandfathered during
// development. On launch day, the cutover sequence replaces this with
// Date.now() immediately before deploying to prod. See Phase 8 of
// docs/superpowers/plans/2026-04-07-open-source-release.md.
export const BYOK_REQUIRED_AFTER = 9999999999999;

/**
 * Returns true if a user with the given creation time must provide
 * their own Gemini API key, false if they are grandfathered on the
 * shared house key.
 */
export function isBYOKRequired(creationTime: number): boolean {
  return creationTime >= BYOK_REQUIRED_AFTER;
}

/**
 * Result of validating a Gemini API key against Google AI.
 *
 * The shape is intentionally minimal: only a discriminant and a coarse reason
 * code. The raw key MUST NEVER appear in any field of this type, even in
 * error paths, because Google AI error responses can echo the key back to us
 * (for example: "API key AIza... is invalid"). Surfacing such a response to
 * the user or to a logging sink would leak the key.
 */
export type GeminiValidationResult =
  | { valid: true }
  | {
      valid: false;
      reason: "invalid_key" | "quota_exceeded" | "network_error" | "unknown";
    };

const GEMINI_LIST_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Validates a Gemini API key by making a lightweight list-models call to
 * Google AI. Returns a typed result that NEVER contains the raw key.
 *
 * Implementation notes:
 * - We never read the response body. The status code is sufficient to
 *   classify the result, and Google AI error bodies can echo the key.
 * - We never include the caught error in the return value, because thrown
 *   fetch errors (and any wrapping done by undici / node) can carry the
 *   request URL, which contains the key as a query parameter.
 * - The fetchImpl parameter exists purely for dependency injection in tests.
 */
export async function validateGeminiKeyAgainstGoogle(
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeminiValidationResult> {
  let response: Response;
  try {
    const url = `${GEMINI_LIST_MODELS_URL}?key=${encodeURIComponent(key)}`;
    response = await fetchImpl(url);
  } catch {
    return { valid: false, reason: "network_error" };
  }

  if (response.ok) {
    return { valid: true };
  }

  if (response.status === 401 || response.status === 403) {
    return { valid: false, reason: "invalid_key" };
  }

  if (response.status === 429) {
    return { valid: false, reason: "quota_exceeded" };
  }

  return { valid: false, reason: "unknown" };
}
