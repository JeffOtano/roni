import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getEffectiveUserId } from "./lib/auth";
import { rateLimiter } from "./rateLimits";
import { decrypt, encrypt } from "./tonal/encryption";
import { getProviderConfig, isValidProvider, type ProviderId } from "./ai/providers";
import {
  assertProviderHasRequiredModel,
  getModelOverrideForProvider,
  KEY_FIELD_MAP,
  normalizeModelOverride,
  providerIdValidator,
} from "./byokShared";
export type { ProviderKeyInfo, ProviderKeyResult, ProviderSettings } from "./byokShared";
import type { ProviderKeyResult } from "./byokShared";

// Set at OSS launch. Users created before this timestamp are grandfathered
// onto the house key; anyone created after must provide BYOK.
export const BYOK_REQUIRED_AFTER = Date.parse("2026-04-08T19:03:52.114Z");

export function isBYOKRequired(creationTime: number): boolean {
  return creationTime >= BYOK_REQUIRED_AFTER;
}

export async function resolveProviderKey(
  profile: Doc<"userProfiles"> | null,
  userCreationTime: number,
): Promise<ProviderKeyResult> {
  if (process.env.BYOK_DISABLED === "true") {
    const houseKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!houseKey) throw new Error("byok_disabled_no_house_key");
    return { provider: "gemini", apiKey: houseKey, isHouseKey: true };
  }

  // Resolve the active provider, defaulting to gemini when unset or invalid
  const provider: ProviderId =
    profile?.selectedProvider && isValidProvider(profile.selectedProvider)
      ? profile.selectedProvider
      : "gemini";
  const keyField = KEY_FIELD_MAP[provider];
  const encryptedKey = profile?.[keyField] as string | undefined;
  const modelOverride = normalizeModelOverride(profile?.modelOverride);

  if (encryptedKey) {
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) throw new Error("byok_misconfigured_no_encryption_key");

    const apiKey = await decrypt(encryptedKey, encryptionKey);
    assertProviderHasRequiredModel(provider, modelOverride);
    return {
      provider,
      apiKey,
      modelOverride: getModelOverrideForProvider(provider, modelOverride),
    };
  }

  // Fallback: for grandfathered users, use house key if no BYOK key is configured
  if (!isBYOKRequired(userCreationTime)) {
    const gfProvider = (profile?.selectedProvider as ProviderId) ?? "gemini";
    if (gfProvider !== "gemini") {
      const encrypted = profile?.[
        getProviderConfig(gfProvider).keyFieldName as keyof typeof profile
      ] as string | undefined;
      if (encrypted) {
        const ek = process.env.TOKEN_ENCRYPTION_KEY;
        if (!ek) throw new Error("byok_misconfigured_no_encryption_key");
        assertProviderHasRequiredModel(gfProvider, modelOverride);
        return {
          provider: gfProvider,
          apiKey: await decrypt(encrypted, ek),
          modelOverride: getModelOverrideForProvider(gfProvider, modelOverride),
        };
      }
    }
    const houseKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!houseKey) throw new Error("grandfathered_no_house_key");
    return { provider: "gemini", apiKey: houseKey, isHouseKey: true };
  }

  // BYOK required but no valid key found
  throw new Error("byok_key_missing");
}

export async function resolveProviderApiKey(
  profile: Doc<"userProfiles"> | null,
  userCreationTime: number,
): Promise<string> {
  const result = await resolveProviderKey(profile, userCreationTime);
  return result.apiKey;
}

import { maskGeminiKey, prepareGeminiKeyForStorage } from "./byokValidation";

export { type GeminiValidationResult, validateGeminiKeyAgainstGoogle } from "./byokValidation";
export { maskGeminiKey, prepareGeminiKeyForStorage };

export const _saveProviderKeyInternal = internalMutation({
  args: {
    userId: v.id("users"),
    provider: providerIdValidator,
    apiKey: v.string(),
    encryptionKey: v.string(),
    modelOverride: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await saveProviderKeyCore(
      ctx,
      args.userId,
      args.provider as ProviderId,
      args.apiKey,
      args.encryptionKey,
      args.modelOverride,
    );
  },
});

async function saveProviderKeyCore(
  ctx: MutationCtx,
  userId: Id<"users">,
  provider: ProviderId,
  apiKey: string,
  encryptionKey: string,
  modelOverride?: string,
): Promise<void> {
  const config = getProviderConfig(provider);
  const trimmed = apiKey.trim();
  if (!config.keyRegex.test(trimmed)) {
    throw new Error(config.keyFormatError);
  }

  const encrypted = await encrypt(trimmed, encryptionKey);
  const addedAt = Date.now();

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (!profile) throw new Error("User profile not found");

  const nextModelOverride = normalizeModelOverride(modelOverride);
  const effectiveModelOverride = nextModelOverride ?? normalizeModelOverride(profile.modelOverride);

  const autoSwitch = effectiveModelOverride !== undefined || config.primaryModel !== "";

  const patch: Partial<Doc<"userProfiles">> = {
    [config.keyFieldName]: encrypted,
    [config.keyTimestampFieldName]: addedAt,
    ...(autoSwitch ? { selectedProvider: provider } : {}),
  };

  if (provider === "openrouter" && nextModelOverride !== undefined) {
    patch.modelOverride = nextModelOverride;
  }

  await ctx.db.patch(profile._id, patch);
}

async function removeProviderKeyCore(
  ctx: MutationCtx,
  userId: Id<"users">,
  provider: ProviderId,
): Promise<void> {
  const config = getProviderConfig(provider);

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();

  if (!profile) throw new Error("User profile not found");

  const patch: Record<string, undefined | string> = {
    [config.keyFieldName]: undefined,
    [config.keyTimestampFieldName]: undefined,
  };

  if (profile.selectedProvider === provider) {
    const fallback = (["gemini", "claude", "openai", "openrouter"] as const).find((p) => {
      if (p === provider) return false;
      if (!profile[KEY_FIELD_MAP[p]]) return false;
      return true;
    });
    patch.selectedProvider = fallback ?? undefined;
  }

  await ctx.db.patch(profile._id, patch as Partial<Doc<"userProfiles">>);
}

export const saveGeminiKey = action({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("Server misconfigured: TOKEN_ENCRYPTION_KEY not set");
    }

    await ctx.runMutation(internal.byok._saveProviderKeyInternal, {
      userId,
      provider: "gemini",
      apiKey: args.apiKey,
      encryptionKey,
    });
  },
});

export const removeGeminiKey = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await removeProviderKeyCore(ctx, userId, "gemini");
  },
});

export const saveProviderKey = action({
  args: {
    provider: providerIdValidator,
    apiKey: v.string(),
    modelOverride: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("Server misconfigured: TOKEN_ENCRYPTION_KEY not set");
    }

    await ctx.runMutation(internal.byok._saveProviderKeyInternal, {
      userId,
      provider: args.provider,
      apiKey: args.apiKey,
      encryptionKey,
      modelOverride: args.modelOverride,
    });
  },
});

export const removeProviderKey = mutation({
  args: { provider: providerIdValidator },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await removeProviderKeyCore(ctx, userId, args.provider as ProviderId);
  },
});

export const setSelectedProvider = mutation({
  args: { provider: providerIdValidator },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const provider = args.provider as ProviderId;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("User profile not found");

    const keyField = KEY_FIELD_MAP[provider];
    if (!profile[keyField]) {
      throw new Error(`No API key on file for ${provider}`);
    }

    assertProviderHasRequiredModel(provider, normalizeModelOverride(profile.modelOverride));

    await ctx.db.patch(profile._id, { selectedProvider: provider });
  },
});

export const setModelOverride = mutation({
  args: { modelOverride: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) throw new Error("User profile not found");

    const nextModelOverride = normalizeModelOverride(args.modelOverride);
    const selectedProvider =
      profile.selectedProvider && isValidProvider(profile.selectedProvider)
        ? profile.selectedProvider
        : "gemini";
    assertProviderHasRequiredModel(selectedProvider, nextModelOverride);

    await ctx.db.patch(profile._id, {
      modelOverride: nextModelOverride,
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
    const hasAnyKey = (["gemini", "claude", "openai", "openrouter"] as const).some(
      (p) => !!profile?.[KEY_FIELD_MAP[p]],
    );
    return {
      requiresBYOK: isBYOKRequired(user._creationTime),
      hasKey: hasAnyKey,
    };
  },
});
