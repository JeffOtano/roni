import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";

export type ProviderId = "gemini" | "claude" | "openai" | "openrouter";

export const PROMPT_OUTPUT_HEADROOM_RATIO = 0.2;

const HIGH_CAPACITY_CONTEXT_WINDOW = 625_000;
const CLAUDE_STANDARD_CONTEXT_WINDOW = 150_000;
const SMALL_CONTEXT_WINDOW = 62_500;
const HIGH_CAPACITY_PROMPT_BUDGET = reserveOutputHeadroom(HIGH_CAPACITY_CONTEXT_WINDOW);
const CLAUDE_STANDARD_PROMPT_BUDGET = reserveOutputHeadroom(CLAUDE_STANDARD_CONTEXT_WINDOW);
const SMALL_PROMPT_BUDGET = reserveOutputHeadroom(SMALL_CONTEXT_WINDOW);

export interface ProviderConfig {
  label: string;
  primaryModel: string;
  fallbackModel: string | null;
  keyRegex: RegExp;
  keyFormatError: string;
  keySourceUrl: string;
  /** Where users go to top up or check quota/billing on this provider. */
  billingUrl: string;
  keyPlaceholder: string;
  keyFieldName: string;
  keyTimestampFieldName: string;
  createLanguageModel: (apiKey: string, model: string) => LanguageModelV3;
}

function reserveOutputHeadroom(contextWindowTokens: number): number {
  return Math.floor(contextWindowTokens * (1 - PROMPT_OUTPUT_HEADROOM_RATIO));
}

function normalizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase().split("/").pop() ?? modelId.trim().toLowerCase();
}

export function getPromptInputBudget(provider: ProviderId, modelId: string): number {
  switch (provider) {
    case "openrouter":
      return SMALL_PROMPT_BUDGET;
    case "gemini": {
      const normalized = normalizeModelId(modelId);
      if (normalized.startsWith("gemini-3-") || normalized.startsWith("gemini-2.5-")) {
        return HIGH_CAPACITY_PROMPT_BUDGET;
      }
      return SMALL_PROMPT_BUDGET;
    }
    case "claude": {
      const normalized = normalizeModelId(modelId);
      if (normalized.includes("haiku")) return SMALL_PROMPT_BUDGET;
      if (normalized.includes("sonnet") || normalized.includes("opus")) {
        return CLAUDE_STANDARD_PROMPT_BUDGET;
      }
      return SMALL_PROMPT_BUDGET;
    }
    case "openai": {
      const normalized = normalizeModelId(modelId);
      if (normalized === "gpt-5.4" || normalized.startsWith("gpt-5.4-")) {
        return HIGH_CAPACITY_PROMPT_BUDGET;
      }
      return SMALL_PROMPT_BUDGET;
    }
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  gemini: {
    label: "Google Gemini",
    primaryModel: "gemini-3-flash-preview",
    fallbackModel: "gemini-2.5-flash",
    keyRegex: /^AIza[A-Za-z0-9_-]{35}$/,
    keyFormatError:
      "Key format looks wrong. Gemini keys start with 'AIza' and are 39 characters long.",
    keySourceUrl: "https://aistudio.google.com/app/apikey",
    billingUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza...",
    keyFieldName: "geminiApiKeyEncrypted",
    keyTimestampFieldName: "geminiApiKeyAddedAt",
    createLanguageModel: (apiKey, model) => {
      const provider = createGoogleGenerativeAI({ apiKey });
      return provider(model);
    },
  },
  claude: {
    label: "Anthropic Claude",
    primaryModel: "claude-sonnet-4-6",
    fallbackModel: "claude-haiku-4-5",
    keyRegex: /^sk-ant-/,
    keyFormatError: "Key format looks wrong. Claude keys start with 'sk-ant-'.",
    keySourceUrl: "https://console.anthropic.com/settings/keys",
    billingUrl: "https://console.anthropic.com/settings/billing",
    keyPlaceholder: "sk-ant-...",
    keyFieldName: "claudeApiKeyEncrypted",
    keyTimestampFieldName: "claudeApiKeyAddedAt",
    createLanguageModel: (apiKey, model) => {
      const provider = createAnthropic({ apiKey });
      return provider(model);
    },
  },
  openai: {
    label: "OpenAI",
    primaryModel: "gpt-5.4",
    fallbackModel: "gpt-5.4-mini",
    keyRegex: /^sk-(?!ant-)(?!or-)/,
    keyFormatError:
      "Key format looks wrong. OpenAI keys start with 'sk-' (but not 'sk-ant-' or 'sk-or-').",
    keySourceUrl: "https://platform.openai.com/api-keys",
    billingUrl: "https://platform.openai.com/settings/organization/billing",
    keyPlaceholder: "sk-...",
    keyFieldName: "openaiApiKeyEncrypted",
    keyTimestampFieldName: "openaiApiKeyAddedAt",
    createLanguageModel: (apiKey, model) => {
      const provider = createOpenAI({ apiKey });
      return provider(model);
    },
  },
  openrouter: {
    label: "OpenRouter",
    primaryModel: "openrouter/auto",
    fallbackModel: null,
    keyRegex: /^sk-or-/,
    keyFormatError: "Key format looks wrong. OpenRouter keys start with 'sk-or-'.",
    keySourceUrl: "https://openrouter.ai/keys",
    billingUrl: "https://openrouter.ai/credits",
    keyPlaceholder: "sk-or-...",
    keyFieldName: "openrouterApiKeyEncrypted",
    keyTimestampFieldName: "openrouterApiKeyAddedAt",
    createLanguageModel: (apiKey, model) => {
      const provider = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
      return provider.chat(model);
    },
  },
};

export function getProviderConfig(provider: ProviderId): ProviderConfig {
  const config = PROVIDERS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);
  return config;
}

export function validateKeyFormat(provider: ProviderId, key: string): boolean {
  const config = PROVIDERS[provider];
  if (!config) return false;
  return config.keyRegex.test(key);
}

export function isValidProvider(value: string): value is ProviderId {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, value);
}
