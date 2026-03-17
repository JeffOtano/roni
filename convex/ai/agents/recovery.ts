import { Agent } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { components } from "../../_generated/api";
import { coachAgentConfig } from "../coach";
import {
  compareProgressPhotosTool,
  getMuscleReadinessTool,
  getStrengthHistoryTool,
  getStrengthScoresTool,
  getTrainingFrequencyTool,
  getWorkoutDetailTool,
  getWorkoutHistoryTool,
  listProgressPhotosTool,
  searchExercisesTool,
} from "../tools";
import { getWorkoutPerformanceTool } from "../weekTools";
import { getWeeklyVolumeTool } from "../coachingTools";

const config = {
  embeddingModel: coachAgentConfig.embeddingModel,
  contextOptions: coachAgentConfig.contextOptions,
  instructions: coachAgentConfig.instructions,
  contextHandler: coachAgentConfig.contextHandler,
  usageHandler: coachAgentConfig.usageHandler,
  maxSteps: 15,
  tools: {
    search_exercises: searchExercisesTool,
    get_strength_scores: getStrengthScoresTool,
    get_strength_history: getStrengthHistoryTool,
    get_muscle_readiness: getMuscleReadinessTool,
    get_workout_history: getWorkoutHistoryTool,
    get_workout_detail: getWorkoutDetailTool,
    get_training_frequency: getTrainingFrequencyTool,
    get_weekly_volume: getWeeklyVolumeTool,
    get_workout_performance: getWorkoutPerformanceTool,
    list_progress_photos: listProgressPhotosTool,
    compare_progress_photos: compareProgressPhotosTool,
  },
};

export const recoveryAgent = new Agent(components.agent, {
  name: "Data & Recovery Specialist",
  languageModel: google("gemini-2.5-pro"),
  ...config,
});

export const recoveryAgentFallback = new Agent(components.agent, {
  name: "Data & Recovery Specialist (Fallback)",
  languageModel: google("gemini-2.5-flash"),
  ...config,
});
