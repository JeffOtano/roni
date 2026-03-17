import { Agent } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { components } from "../../_generated/api";
import { coachAgentConfig } from "../coach";
import {
  createWorkoutTool,
  deleteWorkoutTool,
  estimateDurationTool,
  searchExercisesTool,
} from "../tools";
import {
  adjustSessionDurationTool,
  moveSessionTool,
  swapExerciseTool,
} from "../weekModificationTools";
import {
  approveWeekPlanTool,
  deleteWeekPlanTool,
  getWeekPlanDetailsTool,
  getWorkoutPerformanceTool,
  programWeekTool,
} from "../weekTools";

const config = {
  embeddingModel: coachAgentConfig.embeddingModel,
  contextOptions: coachAgentConfig.contextOptions,
  instructions: coachAgentConfig.instructions,
  contextHandler: coachAgentConfig.contextHandler,
  usageHandler: coachAgentConfig.usageHandler,
  maxSteps: 25,
  tools: {
    search_exercises: searchExercisesTool,
    create_workout: createWorkoutTool,
    delete_workout: deleteWorkoutTool,
    estimate_duration: estimateDurationTool,
    program_week: programWeekTool,
    get_week_plan_details: getWeekPlanDetailsTool,
    delete_week_plan: deleteWeekPlanTool,
    approve_week_plan: approveWeekPlanTool,
    get_workout_performance: getWorkoutPerformanceTool,
    swap_exercise: swapExerciseTool,
    move_session: moveSessionTool,
    adjust_session_duration: adjustSessionDurationTool,
  },
};

export const programmingAgent = new Agent(components.agent, {
  name: "Programming Specialist",
  languageModel: google("gemini-2.5-pro"),
  ...config,
});

export const programmingAgentFallback = new Agent(components.agent, {
  name: "Programming Specialist (Fallback)",
  languageModel: google("gemini-2.5-flash"),
  ...config,
});
