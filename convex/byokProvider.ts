import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getEffectiveUserId } from "./lib/auth";
import { rateLimiter } from "./rateLimits";
import { decrypt } from "./tonal/encryption";
import { isValidProvider, type ProviderId } from "./ai/providers";
import type { ProviderKeyInfo, ProviderSettings } from "./byok";

type RawKeyEntry = { encrypted?: string; addedAt?: number };

export const _getAllProviderKeysRaw = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;
    const p = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!p) return null;

    const sp: ProviderId =
      p.selectedProvider && isValidProvider(p.selectedProvider) ? p.selectedProvider : "gemini";

    return {
      selectedProvider: sp,
      modelOverride: p.modelOverride ?? null,
      keys: {
        gemini: { encrypted: p.geminiApiKeyEncrypted, addedAt: p.geminiApiKeyAddedAt },
        claude: { encrypted: p.claudeApiKeyEncrypted, addedAt: p.claudeApiKeyAddedAt },
        openai: { encrypted: p.openaiApiKeyEncrypted, addedAt: p.openaiApiKeyAddedAt },
        openrouter: { encrypted: p.openrouterApiKeyEncrypted, addedAt: p.openrouterApiKeyAddedAt },
      } satisfies Record<ProviderId, RawKeyEntry>,
    };
  },
});

export const getProviderSettings = action({
  args: {},
  handler: async (ctx): Promise<ProviderSettings | null> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) return null;

    await rateLimiter.limit(ctx, "getProviderSettings", { key: userId, throws: true });

    const raw = await ctx.runQuery(internal.byokProvider._getAllProviderKeysRaw, {});
    if (!raw) return null;

    const encKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!encKey) throw new Error("Server misconfigured: TOKEN_ENCRYPTION_KEY not set");

    const providerIds: readonly ProviderId[] = ["gemini", "claude", "openai", "openrouter"];
    const keys = {} as Record<ProviderId, ProviderKeyInfo>;
    for (const pid of providerIds) {
      const entry = raw.keys[pid];
      if (!entry.encrypted) {
        keys[pid] = { hasKey: false };
      } else {
        const d = await decrypt(entry.encrypted, encKey);
        keys[pid] = { hasKey: true, maskedLast4: d.slice(-4), addedAt: entry.addedAt ?? 0 };
      }
    }
    return {
      selectedProvider: raw.selectedProvider as ProviderId,
      modelOverride: raw.modelOverride,
      keys,
    };
  },
});
