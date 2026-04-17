import { Agent } from "@convex-dev/agent";
import type { ContextHandler, UsageHandler } from "@convex-dev/agent";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { ModelMessage } from "ai";
import { components, internal } from "../_generated/api";
import { getProviderConfig, type ProviderId } from "./providers";
import type { Id } from "../_generated/dataModel";
import { buildTrainingSnapshot } from "./context";
import {
  buildContextWindow,
  mergeConsecutiveSameRole,
  stripImagesFromOlderMessages,
  stripOrphanedToolCalls,
} from "./contextWindow";
import { buildInstructions } from "./promptSections";
import { captureAiGeneration } from "../lib/posthog";
// ---------------------------------------------------------------------------
// Tool registry (31 tools across 4 files)
// ---------------------------------------------------------------------------
// tools.ts (10):        search_exercises, get_strength_scores, get_strength_history,
//                       get_muscle_readiness, get_workout_history, get_workout_detail,
//                       get_training_frequency, create_workout, delete_workout,
//                       estimate_duration
//
// weekTools.ts (5):     program_week, get_week_plan_details, delete_week_plan,
//                       approve_week_plan, get_workout_performance
//
// weekModificationTools.ts (4): swap_exercise, add_exercise, move_session,
//                               adjust_session_duration
//
// coachingTools.ts (12): record_feedback, get_recent_feedback, check_deload,
//                        start_training_block, advance_training_block, set_goal,
//                        update_goal_progress, get_goals, report_injury,
//                        resolve_injury, get_injuries, get_weekly_volume
// ---------------------------------------------------------------------------
import {
  createWorkoutTool,
  deleteWorkoutTool,
  estimateDurationTool,
  getMuscleReadinessTool,
  getStrengthHistoryTool,
  getStrengthScoresTool,
  getTrainingFrequencyTool,
  getWorkoutDetailTool,
  getWorkoutHistoryTool,
  searchExercisesTool,
} from "./tools";
import {
  addExerciseTool,
  adjustSessionDurationTool,
  moveSessionTool,
  swapExerciseTool,
} from "./weekModificationTools";
import {
  approveWeekPlanTool,
  deleteWeekPlanTool,
  getWeekPlanDetailsTool,
  getWorkoutPerformanceTool,
  programWeekTool,
} from "./weekTools";
import {
  advanceTrainingBlockTool,
  checkDeloadTool,
  getGoalsTool,
  getInjuriesTool,
  getRecentFeedbackTool,
  getWeeklyVolumeTool,
  recordFeedbackTool,
  reportInjuryTool,
  resolveInjuryTool,
  setGoalTool,
  startTrainingBlockTool,
  updateGoalProgressTool,
} from "./coachingTools";

// Embeddings always bill the house key, regardless of BYOK status.
const serverProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
const sharedEmbeddingModel = serverProvider.textEmbeddingModel("gemini-embedding-001");

const STATIC_INSTRUCTIONS = buildInstructions();

export const coachAgentConfig = {
  embeddingModel: sharedEmbeddingModel,

  contextOptions: {
    recentMessages: 100,
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

  tools: {
    search_exercises: searchExercisesTool,
    get_strength_scores: getStrengthScoresTool,
    get_strength_history: getStrengthHistoryTool,
    get_muscle_readiness: getMuscleReadinessTool,
    get_workout_history: getWorkoutHistoryTool,
    get_workout_detail: getWorkoutDetailTool,
    get_training_frequency: getTrainingFrequencyTool,
    create_workout: createWorkoutTool,
    delete_workout: deleteWorkoutTool,
    estimate_duration: estimateDurationTool,
    program_week: programWeekTool,
    get_week_plan_details: getWeekPlanDetailsTool,
    delete_week_plan: deleteWeekPlanTool,
    approve_week_plan: approveWeekPlanTool,
    get_workout_performance: getWorkoutPerformanceTool,
    swap_exercise: swapExerciseTool,
    add_exercise: addExerciseTool,
    move_session: moveSessionTool,
    adjust_session_duration: adjustSessionDurationTool,
    // Coaching features
    record_feedback: recordFeedbackTool,
    get_recent_feedback: getRecentFeedbackTool,
    check_deload: checkDeloadTool,
    start_training_block: startTrainingBlockTool,
    advance_training_block: advanceTrainingBlockTool,
    set_goal: setGoalTool,
    update_goal_progress: updateGoalProgressTool,
    get_goals: getGoalsTool,
    report_injury: reportInjuryTool,
    resolve_injury: resolveInjuryTool,
    get_injuries: getInjuriesTool,
    get_weekly_volume: getWeeklyVolumeTool,
  },

  maxSteps: 25,

  // Disable the AI SDK's built-in retry (default maxRetries: 2 = 3 attempts).
  // streamWithRetry already handles retries with primary -> retry -> fallback.
  // Without this, a terminal error like quota exhaustion triggers 9 API calls.
  callSettings: { maxRetries: 0 },

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
    await captureAiGeneration({
      distinctId: userId ?? "anonymous",
      traceId: threadId,
      spanName: agentName,
      model,
      provider,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? undefined,
      cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? undefined,
    });
  }) satisfies UsageHandler,
};

/** Build per-request agent config with timezone-aware context handler. */
export function makeCoachAgentConfig(userTimezone?: string) {
  return {
    ...coachAgentConfig,
    contextHandler: (async (ctx, args) => {
      const messages = buildContextWindow(
        mergeConsecutiveSameRole(
          stripImagesFromOlderMessages(stripOrphanedToolCalls(args.allMessages)),
        ),
      );
      // Snapshot is added after this so the per-call snapshot doesn't bust the prefix cache.
      const systemMessages: ModelMessage[] = [
        {
          role: "system",
          content: STATIC_INSTRUCTIONS,
          providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
        },
      ];
      if (args.userId) {
        const snapshot = await buildTrainingSnapshot(ctx, args.userId, userTimezone);
        systemMessages.push({
          role: "system",
          content: `<training-data>\n${snapshot}\n</training-data>`,
        });
      }
      return [...systemMessages, ...messages];
    }) satisfies ContextHandler,
  };
}

export interface CoachAgentPair {
  primary: Agent;
  fallback: Agent;
}

export function buildCoachAgents(apiKey: string, userTimezone?: string): CoachAgentPair {
  const provider = createGoogleGenerativeAI({ apiKey });
  const config = makeCoachAgentConfig(userTimezone);

  const primary = new Agent(components.agent, {
    name: "Tonal Coach",
    languageModel: provider("gemini-3-flash-preview"),
    ...config,
  });

  const fallback = new Agent(components.agent, {
    name: "Tonal Coach (Fallback)",
    languageModel: provider("gemini-2.5-flash"),
    ...config,
  });

  return { primary, fallback };
}

export interface ProviderAgentArgs {
  provider: ProviderId;
  apiKey: string;
  modelOverride?: string;
  userTimezone?: string;
}

export function buildCoachAgentsForProvider(args: ProviderAgentArgs): CoachAgentPair {
  const { provider, apiKey, modelOverride, userTimezone } = args;
  const config = getProviderConfig(provider);
  const agentConfig = makeCoachAgentConfig(userTimezone);

  const primaryModelName = modelOverride || config.primaryModel;
  if (!primaryModelName) {
    throw new Error(`Provider ${provider} requires a model override (no default model)`);
  }

  const primaryModel = config.createLanguageModel(apiKey, primaryModelName);
  const primary = new Agent(components.agent, {
    name: "Tonal Coach",
    languageModel: primaryModel,
    ...agentConfig,
  });

  let fallback: Agent;
  if (config.fallbackModel) {
    const fallbackModel = config.createLanguageModel(apiKey, config.fallbackModel);
    fallback = new Agent(components.agent, {
      name: "Tonal Coach (Fallback)",
      languageModel: fallbackModel,
      ...agentConfig,
    });
  } else {
    // No fallback (OpenRouter) -- reuse primary so streamWithRetry still works
    fallback = primary;
  }

  return { primary, fallback };
}

// Never pass to streamText/generateText; storage-only (tool approvals).
// Uses coachAgentConfig directly -- no contextHandler needed since no LLM call runs.
export function buildCoachAgentForStorageOnly(): Agent {
  return new Agent(components.agent, {
    name: "Tonal Coach (Storage Only)",
    languageModel: serverProvider("gemini-2.5-flash"),
    ...coachAgentConfig,
  });
}
