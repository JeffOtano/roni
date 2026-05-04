import { Agent } from "@convex-dev/agent";
import type { ContextHandler, UsageHandler } from "@convex-dev/agent";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ModelMessage } from "ai";
import { components, internal } from "../_generated/api";
import { getPromptInputBudget, getProviderConfig, type ProviderId } from "./providers";
import type { Id } from "../_generated/dataModel";
import { withAnthropicHistoryCache } from "./anthropicCache";
import { getTrainingSnapshotForChat, type TrainingSnapshotSource } from "./trainingSnapshotCache";
import {
  buildFullPromptContextWindow,
  estimateMessagesTokens,
  mergeConsecutiveSameRole,
  stripImagesFromOlderMessages,
  stripOrphanedToolCalls,
} from "./contextWindow";
import { COACH_TOOLS, ESTIMATED_TOOL_DEFINITION_TOKENS } from "./coachTools";
import { buildInstructions } from "./promptSections";

// Embeddings always bill the house key, regardless of BYOK status.
const serverProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
const sharedEmbeddingModel = serverProvider.textEmbeddingModel("gemini-embedding-001");

const STATIC_INSTRUCTIONS = buildInstructions();
const RECENT_MESSAGES_LIMIT = 40;
export const COACH_MAX_STEPS = 25;

/**
 * Cheap fingerprint of the static system prompt. Surfaces in `aiRun.promptVersion`
 * so telemetry can correlate metric shifts with prompt edits. Not cryptographic;
 * just stable across restarts of the same build.
 */
export const STATIC_INSTRUCTIONS_HASH = hashString(STATIC_INSTRUCTIONS);

function hashString(input: string): string {
  let h = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// Snapshot content includes user-entered goals, injuries, and feedback.
// Neutralizes any <training-data> tokens the user could have typed so they
// can't close the wrapper and smuggle text that reads as extra instructions.
export function escapeTrainingDataTags(input: string): string {
  return input
    .replaceAll("</training-data>", "</training_data>")
    .replaceAll("<training-data>", "<training_data>");
}

export interface CoachContextTiming {
  contextBuildMs?: number;
  snapshotBuildMs?: number;
  contextBuildCount?: number;
  contextMessageCount?: number;
  snapshotSource?: TrainingSnapshotSource;
}

export function shouldUseCrossThreadSearch(prompt: string, hasImages: boolean = false): boolean {
  if (hasImages) return true;

  const normalized = prompt
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
  if (!normalized) return true;

  const retrievalKeywords = [
    "history",
    "past",
    "previous",
    "goal",
    "injury",
    "strength",
    "readiness",
  ];
  if (retrievalKeywords.some((keyword) => normalized.includes(keyword))) return true;

  const localFollowUps = [
    "ok",
    "okay",
    "yes",
    "no",
    "thanks",
    "thank you",
    "make it harder",
    "make it easier",
    "shorter",
    "longer",
    "swap it",
    "looks good",
  ];
  if (localFollowUps.includes(normalized)) return false;
  return normalized.split(" ").length > 8;
}

export const coachAgentConfig = {
  embeddingModel: sharedEmbeddingModel,

  contextOptions: {
    recentMessages: RECENT_MESSAGES_LIMIT,
    searchOtherThreads: true,
    searchOptions: {
      limit: 10,
      vectorSearch: true,
      textSearch: true,
      vectorScoreThreshold: 0.3,
      messageRange: { before: 2, after: 1 },
    },
  },

  // No `instructions` here — STATIC_INSTRUCTIONS is injected by contextHandler so it can carry cacheControl.

  tools: COACH_TOOLS,

  maxSteps: COACH_MAX_STEPS,

  // Disable the AI SDK's built-in retry (default maxRetries: 2 = 3 attempts).
  // streamWithRetry already handles retries with primary -> retry -> fallback.
  // Without this, a terminal error like quota exhaustion triggers 9 API calls.
  callSettings: { maxRetries: 0 },

  // AI traces now flow to Phoenix Cloud via OpenTelemetry (see convex/ai/otel.ts);
  // this handler is retained only for app-side token accounting on `aiUsage`.
  usageHandler: (async (ctx, { userId, threadId, agentName, usage, model, provider }) => {
    await ctx.runMutation(internal.aiUsage.record, {
      userId: userId as Id<"users"> | undefined,
      threadId,
      agentName,
      model,
      provider,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0,
      cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? undefined,
      cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? undefined,
    });
  }) satisfies UsageHandler,
};

/** Build per-request agent config with timezone-aware context handler. */
export interface CoachAgentConfigOptions {
  userTimezone?: string;
  provider?: ProviderId;
  modelId?: string;
  retrievalEnabled?: boolean;
  timing?: CoachContextTiming;
}

export function makeCoachAgentConfig(options: CoachAgentConfigOptions = {}) {
  const { userTimezone, provider, modelId, retrievalEnabled = true, timing } = options;
  const budgetProvider = provider ?? "gemini";
  const budgetModelId = modelId ?? getProviderConfig(budgetProvider).primaryModel;
  const promptBudgetTokens = getPromptInputBudget(budgetProvider, budgetModelId);
  return {
    ...coachAgentConfig,
    contextOptions: {
      ...coachAgentConfig.contextOptions,
      searchOtherThreads: retrievalEnabled,
    },
    contextHandler: (async (ctx, args) => {
      const contextStartedAt = Date.now();
      const normalizedMessages = mergeConsecutiveSameRole(
        stripImagesFromOlderMessages(stripOrphanedToolCalls(args.allMessages)),
      );
      const hasUserTurn = normalizedMessages.some((message) => message.role === "user");
      const staticSystem: ModelMessage = {
        role: "system",
        content: STATIC_INSTRUCTIONS,
        providerOptions: {
          anthropic: {
            cacheControl: { type: "ephemeral" },
            effort: "medium",
          },
        },
      };
      const baseReservedPromptTokens =
        estimateMessagesTokens([staticSystem]) + ESTIMATED_TOOL_DEFINITION_TOKENS;

      if (!args.userId || !hasUserTurn) {
        const messages = buildFullPromptContextWindow({
          messages: normalizedMessages,
          promptBudgetTokens,
          reservedPromptTokens: baseReservedPromptTokens,
        });
        if (timing) {
          timing.contextBuildCount = (timing.contextBuildCount ?? 0) + 1;
          timing.contextMessageCount = (timing.contextMessageCount ?? 0) + messages.length;
        }
        if (timing)
          timing.contextBuildMs = (timing.contextBuildMs ?? 0) + Date.now() - contextStartedAt;
        return [staticSystem, ...messages];
      }

      const snapshotResult = await getTrainingSnapshotForChat(ctx, args.userId, userTimezone);
      if (timing) {
        timing.snapshotBuildMs = (timing.snapshotBuildMs ?? 0) + snapshotResult.snapshotBuildMs;
        timing.snapshotSource ??= snapshotResult.source;
      }
      const snapshotSystem: ModelMessage = {
        role: "system",
        content: `<training-data>\n${escapeTrainingDataTags(snapshotResult.snapshot)}\n</training-data>`,
      };
      const messages = buildFullPromptContextWindow({
        messages: normalizedMessages,
        promptBudgetTokens,
        reservedPromptTokens: baseReservedPromptTokens + estimateMessagesTokens([snapshotSystem]),
      });
      if (timing) {
        timing.contextBuildCount = (timing.contextBuildCount ?? 0) + 1;
        timing.contextMessageCount = (timing.contextMessageCount ?? 0) + messages.length;
      }
      const recordPostSnapshotContextTiming = () => {
        if (!timing) return;
        timing.contextBuildMs =
          (timing.contextBuildMs ?? 0) +
          Math.max(0, Date.now() - contextStartedAt - snapshotResult.snapshotBuildMs);
      };
      if (messages.length === 0) {
        recordPostSnapshotContextTiming();
        return [staticSystem, snapshotSystem];
      }

      // Anthropic supports interleaved system messages and has explicit prompt
      // caching. Placing the snapshot after the final user boundary keeps the
      // cached prefix (tools + static system + history up to the last
      // assistant) byte-stable, so a cacheControl marker on that assistant
      // turns it into a hit on every subsequent call in the 5-minute window.
      //
      // Gemini throws UnsupportedFunctionalityError on any system message
      // that appears after a non-system message, so we keep the snapshot at
      // system[1] for it and for any provider we can't confirm is safe
      // (OpenAI supports it but we see no caching win there; OpenRouter is a
      // passthrough to an unknown backend). Conservative default.
      if (provider === "claude") {
        let lastUserIdx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "user") {
            lastUserIdx = i;
            break;
          }
        }
        const headEnd = lastUserIdx === -1 ? messages.length : lastUserIdx + 1;
        const head = withAnthropicHistoryCache(messages.slice(0, headEnd));
        const tail = messages.slice(headEnd);
        recordPostSnapshotContextTiming();
        return [staticSystem, ...head, snapshotSystem, ...tail];
      }
      recordPostSnapshotContextTiming();
      return [staticSystem, snapshotSystem, ...messages];
    }) satisfies ContextHandler,
  };
}

export interface CoachAgentPair {
  primary: Agent;
  fallback: Agent;
  primaryModelName: string;
}

export function buildCoachAgents(apiKey: string, userTimezone?: string): CoachAgentPair {
  const provider = createGoogleGenerativeAI({ apiKey });
  const primaryModelName = "gemini-3-flash-preview";
  const fallbackModelName = "gemini-2.5-flash";

  const primary = new Agent(components.agent, {
    name: "Roni",
    languageModel: provider(primaryModelName),
    ...makeCoachAgentConfig({ userTimezone, provider: "gemini", modelId: primaryModelName }),
  });

  const fallback = new Agent(components.agent, {
    name: "Roni (Fallback)",
    languageModel: provider(fallbackModelName),
    ...makeCoachAgentConfig({ userTimezone, provider: "gemini", modelId: fallbackModelName }),
  });

  return { primary, fallback, primaryModelName };
}

export interface ProviderAgentArgs {
  provider: ProviderId;
  apiKey: string;
  modelOverride?: string;
  userTimezone?: string;
  retrievalEnabled?: boolean;
  timing?: CoachContextTiming;
}

export function buildCoachAgentsForProvider(args: ProviderAgentArgs): CoachAgentPair {
  const { provider, apiKey, modelOverride, userTimezone, retrievalEnabled, timing } = args;
  const config = getProviderConfig(provider);

  const primaryModelName = modelOverride || config.primaryModel;
  if (!primaryModelName) {
    throw new Error(`Provider ${provider} requires a model override (no default model)`);
  }

  const primaryModel = config.createLanguageModel(apiKey, primaryModelName);
  const primary = new Agent(components.agent, {
    name: "Roni",
    languageModel: primaryModel,
    ...makeCoachAgentConfig({
      userTimezone,
      provider,
      modelId: primaryModelName,
      retrievalEnabled,
      timing,
    }),
  });

  let fallback: Agent;
  if (config.fallbackModel) {
    const fallbackModel = config.createLanguageModel(apiKey, config.fallbackModel);
    fallback = new Agent(components.agent, {
      name: "Roni (Fallback)",
      languageModel: fallbackModel,
      ...makeCoachAgentConfig({
        userTimezone,
        provider,
        modelId: config.fallbackModel,
        retrievalEnabled,
        timing,
      }),
    });
  } else {
    // No fallback (OpenRouter) -- reuse primary so streamWithRetry still works
    fallback = primary;
  }

  return { primary, fallback, primaryModelName };
}

// Never pass to streamText/generateText; storage-only (tool approvals).
// Uses coachAgentConfig directly -- no contextHandler needed since no LLM call runs.
export function buildCoachAgentForStorageOnly(): Agent {
  return new Agent(components.agent, {
    name: "Roni (Storage Only)",
    languageModel: serverProvider("gemini-2.5-flash"),
    ...coachAgentConfig,
  });
}
