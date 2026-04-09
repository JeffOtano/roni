import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { getEffectiveUserId } from "./lib/auth";
import { rateLimiter } from "./rateLimits";
import { decrypt, encrypt } from "./tonal/encryption";

// Set at OSS launch (2026-04-08). Users created before this timestamp are
// grandfathered onto the house key; anyone created after must provide BYOK.
export const BYOK_REQUIRED_AFTER = 1775675032114;

export function isBYOKRequired(creationTime: number): boolean {
  return creationTime >= BYOK_REQUIRED_AFTER;
}

export async function resolveGeminiKey(
  profile: Doc<"userProfiles"> | null,
  userCreationTime: number,
): Promise<string> {
  // Kill switch: operators flip BYOK_DISABLED to force everyone back on the house key.
  if (process.env.BYOK_DISABLED === "true") {
    const houseKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!houseKey) throw new Error("byok_disabled_no_house_key");
    return houseKey;
  }

  if (!isBYOKRequired(userCreationTime)) {
    const houseKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!houseKey) throw new Error("grandfathered_no_house_key");
    return houseKey;
  }

  if (!profile?.geminiApiKeyEncrypted) {
    throw new Error("byok_key_missing");
  }

  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("byok_misconfigured_no_encryption_key");

  return await decrypt(profile.geminiApiKeyEncrypted, encryptionKey);
}

// Result must never include the raw key: Google AI error bodies echo it back.
export type GeminiValidationResult =
  | { valid: true }
  | {
      valid: false;
      reason: "invalid_key" | "quota_exceeded" | "network_error" | "unknown";
    };

const GEMINI_LIST_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export async function validateGeminiKeyAgainstGoogle(
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeminiValidationResult> {
  let response: Response;
  try {
    const url = `${GEMINI_LIST_MODELS_URL}?key=${encodeURIComponent(key)}`;
    response = await fetchImpl(url);
  } catch {
    // Bare catch: undici fetch errors can include the request URL (which contains the key).
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

const GEMINI_KEY_FORMAT = /^AIza[A-Za-z0-9_-]{35}$/;

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

export const _checkHouseKeyQuota = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await rateLimiter.limit(ctx, "houseKeyMonthly", { key: userId, throws: true });
  },
});

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

export function maskGeminiKey(decrypted: string): string {
  return decrypted.slice(-4);
}

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
