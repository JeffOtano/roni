import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getProviderConfig, type ProviderId } from "./ai/providers";

export const providerIdValidator = v.union(
  v.literal("gemini"),
  v.literal("claude"),
  v.literal("openai"),
  v.literal("openrouter"),
);

export type ProviderKeyResult = {
  provider: ProviderId;
  apiKey: string;
  modelOverride?: string;
  isHouseKey?: boolean;
};

export type ProviderKeyInfo =
  | { hasKey: false }
  | { hasKey: true; maskedLast4: string; addedAt: number };

export type ProviderSettings = {
  selectedProvider: ProviderId;
  modelOverride: string | null;
  keys: Record<ProviderId, ProviderKeyInfo>;
};

export const KEY_FIELD_MAP: Record<ProviderId, keyof Doc<"userProfiles">> = {
  gemini: "geminiApiKeyEncrypted",
  claude: "claudeApiKeyEncrypted",
  openai: "openaiApiKeyEncrypted",
  openrouter: "openrouterApiKeyEncrypted",
};

export function normalizeModelOverride(
  modelOverride: string | null | undefined,
): string | undefined {
  const trimmed = modelOverride?.trim();
  return trimmed ? trimmed : undefined;
}

export function assertProviderHasRequiredModel(
  provider: ProviderId,
  modelOverride: string | undefined,
): void {
  if (!modelOverride && !getProviderConfig(provider).primaryModel) {
    throw new Error("byok_model_missing");
  }
}

export function getModelOverrideForProvider(
  provider: ProviderId,
  modelOverride: string | undefined,
): string | undefined {
  return provider === "openrouter" ? modelOverride : undefined;
}
