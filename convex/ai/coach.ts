import { Agent } from "@convex-dev/agent";
import type { ContextHandler, UsageHandler } from "@convex-dev/agent";
import type { ModelMessage, UserContent } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { components, internal } from "../_generated/api";
import { getProviderConfig, type ProviderId } from "./providers";
import type { Id } from "../_generated/dataModel";
import { buildTrainingSnapshot } from "./context";
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

export function mergeConsecutiveSameRole(messages: ModelMessage[]): ModelMessage[] {
  if (messages.length <= 1) return messages;

  const result: ModelMessage[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prev = result[result.length - 1];
    const curr = messages[i];

    // Never merge system messages; the provider extracts them separately.
    if (prev.role !== curr.role || prev.role === "system") {
      result.push(curr);
      continue;
    }

    const toParts = (c: ModelMessage["content"]): Array<Record<string, unknown>> =>
      typeof c === "string" ? [{ type: "text", text: c }] : (c as Array<Record<string, unknown>>);

    const merged = [...toParts(prev.content), ...toParts(curr.content)];
    result[result.length - 1] = { ...prev, content: merged } as ModelMessage;
  }

  return result;
}

export function stripOrphanedToolCalls(messages: ModelMessage[]): ModelMessage[] {
  const approvalIdToToolCallId = new Map<string, string>();
  const toolCallIdsWithApprovalRequests = new Set<string>();
  const resolvedToolCallIds = new Set<string>();
  for (const msg of messages) {
    if (typeof msg.content === "string" || !Array.isArray(msg.content)) continue;
    for (const part of msg.content as Array<{
      type: string;
      approvalId?: string;
      toolCallId?: string;
    }>) {
      if (part.type === "tool-approval-request" && part.approvalId && part.toolCallId) {
        approvalIdToToolCallId.set(part.approvalId, part.toolCallId);
        toolCallIdsWithApprovalRequests.add(part.toolCallId);
      }
      if (part.type === "tool-result" && part.toolCallId) {
        resolvedToolCallIds.add(part.toolCallId);
      }
    }
  }

  for (const msg of messages) {
    if (typeof msg.content === "string" || !Array.isArray(msg.content)) continue;
    for (const part of msg.content as Array<{ type: string; approvalId?: string }>) {
      if (part.type === "tool-approval-response" && part.approvalId) {
        const toolCallId = approvalIdToToolCallId.get(part.approvalId);
        if (toolCallId) {
          resolvedToolCallIds.add(toolCallId);
        }
      }
    }
  }

  return messages
    .map((msg) => {
      if (msg.role !== "assistant") return msg;
      if (typeof msg.content === "string" || !Array.isArray(msg.content)) return msg;

      const parts = msg.content as Array<{ type: string; toolCallId?: string }>;
      const hasToolCalls = parts.some((p) => p.type === "tool-call");
      if (!hasToolCalls) return msg;

      const filtered = parts.filter(
        (p) =>
          p.type !== "tool-call" ||
          (p.toolCallId &&
            (resolvedToolCallIds.has(p.toolCallId) ||
              toolCallIdsWithApprovalRequests.has(p.toolCallId))),
      );

      if (filtered.length === 0) return null;
      return { ...msg, content: filtered } as ModelMessage;
    })
    .filter((msg): msg is ModelMessage => msg !== null);
}

/**
 * Remove image parts from all messages except the most recent user message.
 * Images stored in older messages cause unbounded memory growth when loaded
 * via recentMessages, leading to 64 MB OOM on Convex actions.
 */
function stripImagesFromOlderMessages(messages: ModelMessage[]): ModelMessage[] {
  // Find the index of the last user message (the one that may contain fresh images)
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  return messages.map((msg, idx) => {
    // Keep the most recent user message intact (it has the current images)
    if (idx === lastUserIdx) return msg;
    // Only user messages can contain image parts from buildPrompt
    if (msg.role !== "user") return msg;
    // String content has no images
    if (typeof msg.content === "string") return msg;
    if (!Array.isArray(msg.content)) return msg;

    const filtered = (msg.content as Array<{ type: string }>).filter(
      (part) => part.type !== "image",
    );
    // If all parts were images, replace with a placeholder
    if (filtered.length === 0) {
      return { ...msg, content: "[image message]" };
    }
    return { ...msg, content: filtered as UserContent };
  });
}

// Embeddings always bill the house key, regardless of BYOK status.
const serverProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
const sharedEmbeddingModel = serverProvider.textEmbeddingModel("gemini-embedding-001");

export const coachAgentConfig = {
  embeddingModel: sharedEmbeddingModel,

  contextOptions: {
    recentMessages: 30,
    searchOtherThreads: true,
    searchOptions: {
      limit: 10,
      vectorSearch: true,
      textSearch: true,
      vectorScoreThreshold: 0.3,
      messageRange: { before: 2, after: 1 },
    },
  },

  instructions: buildInstructions(),

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

  contextHandler: (async (ctx, args) => {
    const messages = mergeConsecutiveSameRole(
      stripImagesFromOlderMessages(stripOrphanedToolCalls(args.allMessages)),
    );

    if (!args.userId) return messages;

    const snapshot = await buildTrainingSnapshot(ctx, args.userId);
    const snapshotMessage = {
      role: "system" as const,
      content: `<training-data>\n${snapshot}\n</training-data>`,
    };
    return [snapshotMessage, ...messages];
  }) satisfies ContextHandler,
};

export interface CoachAgentPair {
  primary: Agent;
  fallback: Agent;
}

export function buildCoachAgents(apiKey: string): CoachAgentPair {
  const provider = createGoogleGenerativeAI({ apiKey });

  const primary = new Agent(components.agent, {
    name: "Tonal Coach",
    languageModel: provider("gemini-3-flash-preview"),
    ...coachAgentConfig,
  });

  const fallback = new Agent(components.agent, {
    name: "Tonal Coach (Fallback)",
    languageModel: provider("gemini-2.5-flash"),
    ...coachAgentConfig,
  });

  return { primary, fallback };
}

export interface ProviderAgentArgs {
  provider: ProviderId;
  apiKey: string;
  modelOverride?: string;
}

export function buildCoachAgentsForProvider(args: ProviderAgentArgs): CoachAgentPair {
  const { provider, apiKey, modelOverride } = args;
  const config = getProviderConfig(provider);

  const primaryModelName = modelOverride || config.primaryModel;
  if (!primaryModelName) {
    throw new Error(`Provider ${provider} requires a model override (no default model)`);
  }

  const primaryModel = config.createLanguageModel(apiKey, primaryModelName);
  const primary = new Agent(components.agent, {
    name: "Tonal Coach",
    languageModel: primaryModel,
    ...coachAgentConfig,
  });

  let fallback: Agent;
  if (config.fallbackModel) {
    const fallbackModel = config.createLanguageModel(apiKey, config.fallbackModel);
    fallback = new Agent(components.agent, {
      name: "Tonal Coach (Fallback)",
      languageModel: fallbackModel,
      ...coachAgentConfig,
    });
  } else {
    // No fallback (OpenRouter) -- reuse primary so streamWithRetry still works
    fallback = primary;
  }

  return { primary, fallback };
}

// Never pass to streamText/generateText; storage-only.
export function buildCoachAgentForStorageOnly(): Agent {
  return new Agent(components.agent, {
    name: "Tonal Coach (Storage Only)",
    languageModel: serverProvider("gemini-2.5-flash"),
    ...coachAgentConfig,
  });
}
