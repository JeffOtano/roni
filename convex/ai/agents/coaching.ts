import { Agent } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { components } from "../../_generated/api";
import { coachAgentConfig } from "../coach";
import { searchExercisesTool } from "../tools";
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
} from "../coachingTools";

const config = {
  embeddingModel: coachAgentConfig.embeddingModel,
  contextOptions: coachAgentConfig.contextOptions,
  instructions: coachAgentConfig.instructions,
  contextHandler: coachAgentConfig.contextHandler,
  usageHandler: coachAgentConfig.usageHandler,
  maxSteps: 15,
  tools: {
    search_exercises: searchExercisesTool,
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
};

export const coachingAgent = new Agent(components.agent, {
  name: "Coaching Specialist",
  languageModel: google("gemini-2.5-pro"),
  ...config,
});

export const coachingAgentFallback = new Agent(components.agent, {
  name: "Coaching Specialist (Fallback)",
  languageModel: google("gemini-2.5-flash"),
  ...config,
});
