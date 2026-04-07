import { v } from "convex/values";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { getEffectiveUserId } from "./lib/auth";
import { decrypt, encrypt } from "./tonal/encryption";

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
 * Resolves the Gemini API key to use for a given user profile.
 *
 * Decision tree (in priority order):
 *
 * 1. BYOK_DISABLED kill switch: if the env var is "true", always returns the
 *    house key. Operators can flip this during an incident to force all users
 *    back onto the house key without a code deploy.
 * 2. Grandfathered user (creationTime < BYOK_REQUIRED_AFTER): returns the
 *    house key.
 * 3. BYOK user with no key set: throws "byok_key_missing".
 * 4. BYOK user with key set: decrypts and returns the user's key.
 *
 * The throw semantics are the critical invariant of the BYOK release: on ANY
 * BYOK failure, this function throws a typed error rather than silently
 * falling back to the house key. Callers must handle the error explicitly so
 * the frontend can surface it to the user. Silently falling back would
 * re-create the cost bleed the OSS release is meant to solve.
 */
export async function resolveGeminiKey(
  profile: Doc<"userProfiles"> | null,
  userCreationTime: number,
): Promise<string> {
  // Kill switch: operator can flip this during an incident to force all users
  // back onto the house key without a code deploy.
  if (process.env.BYOK_DISABLED === "true") {
    const houseKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!houseKey) throw new Error("byok_disabled_no_house_key");
    return houseKey;
  }

  // Grandfathered path: user existed before BYOK launch, keeps using house key.
  if (!isBYOKRequired(userCreationTime)) {
    const houseKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!houseKey) throw new Error("grandfathered_no_house_key");
    return houseKey;
  }

  // BYOK required but no key stored.
  if (!profile?.geminiApiKeyEncrypted) {
    throw new Error("byok_key_missing");
  }

  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("byok_misconfigured_no_encryption_key");

  return await decrypt(profile.geminiApiKeyEncrypted, encryptionKey);
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

/**
 * Clear the authenticated user's stored Gemini API key.
 *
 * Patches both the ciphertext and the addedAt timestamp back to undefined.
 * After this runs, isBYOKRequired logic on the calling layer will treat the
 * user as having no key on file.
 */
export const removeGeminiKey = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("User profile not found");

    await ctx.db.patch(profile._id, {
      geminiApiKeyEncrypted: undefined,
      geminiApiKeyAddedAt: undefined,
    });
  },
});

/**
 * Internal-only query that returns the user creation time and the user's
 * stored profile (if any), used by chat actions to resolve which Gemini key
 * to bill against. Returns the raw ciphertext, never plaintext: the calling
 * action runs decrypt() inside the action runtime via resolveGeminiKey().
 *
 * Takes userId as an explicit argument because the chat action runtime
 * receives userId from the caller (via processMessage args), not from
 * getEffectiveUserId.
 */
export const _getKeyResolutionContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    userCreationTime: number;
    profile: Doc<"userProfiles"> | null;
  } | null> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    return {
      userCreationTime: user._creationTime,
      profile,
    };
  },
});

/**
 * Internal-only query that returns the raw ciphertext for the authenticated
 * user's stored Gemini key. Used by getGeminiKeyStatus, which decrypts in an
 * action runtime so the plaintext never crosses a query boundary.
 *
 * Returns null if the user is unauthenticated, has no profile, or has no key
 * stored. Never returns plaintext.
 */
export const _getGeminiKeyRaw = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return null;
    return {
      encrypted: profile.geminiApiKeyEncrypted,
      addedAt: profile.geminiApiKeyAddedAt,
    };
  },
});

/**
 * Returns the last 4 characters of an already-decrypted Gemini API key.
 *
 * Pure helper extracted so the masking rule (last 4 only, never more) lives in
 * one place and can be unit tested. The caller is responsible for ensuring the
 * input is the decrypted plaintext; this function does not perform decryption.
 */
export function maskGeminiKey(decrypted: string): string {
  return decrypted.slice(-4);
}

/**
 * Public action that returns a masked view of the authenticated user's stored
 * Gemini API key. The key is decrypted in memory inside this action only long
 * enough to compute the last 4 characters; the full plaintext NEVER leaves the
 * action and is never returned to the caller.
 *
 * Lives in an action (rather than a query) because decryption uses Web Crypto,
 * which we exercise from the action runtime elsewhere in convex/calendarActions
 * and convex/tonal modules.
 */
export const getGeminiKeyStatus = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ hasKey: false } | { hasKey: true; maskedLast4: string; addedAt: number }> => {
    const raw = await ctx.runQuery(internal.byok._getGeminiKeyRaw, {});
    if (!raw || !raw.encrypted) return { hasKey: false };

    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("Server misconfigured: TOKEN_ENCRYPTION_KEY not set");
    }

    const decrypted = await decrypt(raw.encrypted, encryptionKey);
    const maskedLast4 = maskGeminiKey(decrypted);
    return { hasKey: true, maskedLast4, addedAt: raw.addedAt ?? 0 };
  },
});

/**
 * Public query that returns whether the authenticated user must provide their
 * own Gemini API key (BYOK) and whether they currently have one stored. Used by
 * the onboarding orchestrator to decide whether to insert the BYOK capture step
 * into the flow.
 *
 * Returns the safe default `{ requiresBYOK: false, hasKey: false }` for any
 * unauthenticated or missing-user case so the UI can render without throwing.
 */
export const getBYOKStatus = query({
  args: {},
  handler: async (ctx): Promise<{ requiresBYOK: boolean; hasKey: boolean }> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return { requiresBYOK: false, hasKey: false };
    const user = await ctx.db.get(userId);
    if (!user) return { requiresBYOK: false, hasKey: false };
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return {
      requiresBYOK: isBYOKRequired(user._creationTime),
      hasKey: !!profile?.geminiApiKeyEncrypted,
    };
  },
});
