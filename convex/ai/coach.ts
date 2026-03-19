import { Agent } from "@convex-dev/agent";
import type { ContextHandler, UsageHandler } from "@convex-dev/agent";
import type { ModelMessage, UserContent } from "ai";
import { google } from "@ai-sdk/google";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { buildTrainingSnapshot } from "./context";
import { buildInstructions } from "./promptSections";
import {
  compareProgressPhotosTool,
  createWorkoutTool,
  deleteWorkoutTool,
  estimateDurationTool,
  getMuscleReadinessTool,
  getStrengthHistoryTool,
  getStrengthScoresTool,
  getTrainingFrequencyTool,
  getWorkoutDetailTool,
  getWorkoutHistoryTool,
  listProgressPhotosTool,
  searchExercisesTool,
} from "./tools";
import {
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

export const coachAgentConfig = {
  embeddingModel: google.textEmbeddingModel("gemini-embedding-001"),

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
    list_progress_photos: listProgressPhotosTool,
    compare_progress_photos: compareProgressPhotosTool,
    program_week: programWeekTool,
    get_week_plan_details: getWeekPlanDetailsTool,
    delete_week_plan: deleteWeekPlanTool,
    approve_week_plan: approveWeekPlanTool,
    get_workout_performance: getWorkoutPerformanceTool,
    swap_exercise: swapExerciseTool,
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

  contextHandler: (async (ctx, args) => {
    if (!args.userId) return [...args.allMessages];

    const snapshot = await buildTrainingSnapshot(ctx, args.userId);
    const snapshotMessage = {
      role: "system" as const,
      content: `<training-data>\n${snapshot}\n</training-data>`,
    };
    // Strip image parts from all messages except the most recent user message
    // to prevent OOM from large image data accumulating in context.
    const messages = stripImagesFromOlderMessages(args.allMessages);
    return [snapshotMessage, ...messages];
  }) satisfies ContextHandler,
};

export const coachAgent = new Agent(components.agent, {
  name: "Tonal Coach",
  languageModel: google("gemini-2.5-pro"),
  ...coachAgentConfig,
});

export const coachAgentFallback = new Agent(components.agent, {
  name: "Tonal Coach (Fallback)",
  languageModel: google("gemini-2.5-flash"),
  ...coachAgentConfig,
});
