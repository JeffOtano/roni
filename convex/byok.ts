import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";
import { encrypt } from "./tonal/encryption";

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

/**
 * Matches a well-formed Gemini API key: the "AIza" prefix followed by 35
 * characters from the URL-safe base64 alphabet. Google keys are always
 * exactly 39 characters. This is a format check only; it does not verify
 * the key works against Google AI.
 */
const GEMINI_KEY_FORMAT = /^AIza[A-Za-z0-9_-]{35}$/;

/**
 * Prepares a user-supplied Gemini API key for storage on the user's profile.
 *
 * Pure helper: no auth, no database. Trims whitespace, enforces the Gemini
 * key format, and encrypts the result with the AES-256-GCM helper from
 * convex/tonal/encryption.ts. Returns the ciphertext and an addedAt timestamp
 * ready to be patched onto a userProfiles row.
 *
 * Live validation against Google AI is intentionally NOT performed here.
 * The call site is expected to run validateGeminiKeyAgainstGoogle before
 * invoking the storing mutation, so the mutation itself stays off the hot
 * path of a network request.
 */
export async function prepareGeminiKeyForStorage(
  apiKey: string,
  encryptionKey: string,
): Promise<{ encrypted: string; addedAt: number }> {
  const trimmed = apiKey.trim();
  if (!GEMINI_KEY_FORMAT.test(trimmed)) {
    throw new Error(
      "Invalid Gemini API key format. Keys start with 'AIza' and are 39 characters long.",
    );
  }
  const encrypted = await encrypt(trimmed, encryptionKey);
  return { encrypted, addedAt: Date.now() };
}

/**
 * Encrypt and store the authenticated user's Gemini API key on their profile.
 *
 * The caller is expected to have already run live Google validation (see
 * validateGeminiKeyAgainstGoogle above) before invoking this mutation. The
 * mutation itself only does format validation via prepareGeminiKeyForStorage,
 * so it stays off the hot path of any network request.
 */
export const saveGeminiKey = mutation({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("Server misconfigured: TOKEN_ENCRYPTION_KEY not set");
    }

    const { encrypted, addedAt } = await prepareGeminiKeyForStorage(args.apiKey, encryptionKey);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("User profile not found");

    await ctx.db.patch(profile._id, {
      geminiApiKeyEncrypted: encrypted,
      geminiApiKeyAddedAt: addedAt,
    });
  },
});
