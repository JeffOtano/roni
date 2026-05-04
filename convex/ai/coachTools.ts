import type { ToolSet } from "ai";
import { withAnthropicToolCache } from "./anthropicCache";
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
import { estimateDurationTool } from "./estimationTools";
import { estimateMessagesTokens } from "./contextWindow";
import { programWeekTool } from "./programWeekTool";
import { rebuildDayTool } from "./rebuildDayTool";
import {
  createWorkoutTool,
  deleteWorkoutTool,
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
  setWarmupBlockTool,
  swapExerciseTool,
} from "./weekModificationTools";
import {
  approveWeekPlanTool,
  deleteWeekPlanTool,
  getWeekPlanDetailsTool,
  getWorkoutPerformanceTool,
} from "./weekTools";

const TOOL_SCHEMA_TOKEN_FALLBACK = 120;

const RAW_COACH_TOOLS = {
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
  set_warmup_block: setWarmupBlockTool,
  move_session: moveSessionTool,
  adjust_session_duration: adjustSessionDurationTool,
  rebuild_day: rebuildDayTool,
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
} satisfies ToolSet;

export const COACH_TOOLS = withAnthropicToolCache(RAW_COACH_TOOLS);

function getToolDescription(tool: unknown): string {
  if (tool === null || typeof tool !== "object" || !("description" in tool)) return "";
  const description = Reflect.get(tool, "description");
  return typeof description === "string" ? description : "";
}

function estimateToolDefinitionTokens(tools: ToolSet): number {
  return Object.entries(tools).reduce((sum, [name, tool]) => {
    const description = getToolDescription(tool);
    return (
      sum +
      estimateMessagesTokens([{ role: "system", content: `${name}\n${description}` }]) +
      TOOL_SCHEMA_TOKEN_FALLBACK
    );
  }, 0);
}

export const ESTIMATED_TOOL_DEFINITION_TOKENS = estimateToolDefinitionTokens(COACH_TOOLS);
