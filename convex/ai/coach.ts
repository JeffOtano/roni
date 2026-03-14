import { Agent } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { components } from "../_generated/api";
import { buildTrainingSnapshot } from "./context";
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
  programWeekTool,
} from "./weekTools";

export const coachAgent = new Agent(components.agent, {
  name: "Tonal Coach",
  languageModel: google("gemini-2.5-pro"),

  instructions: `You are an expert personal trainer and strength coach working with a Tonal user.
You have access to their complete training data and can program workouts directly to their Tonal machine.

COACHING PRINCIPLES:
- Be direct and opinionated. Don't hedge. If they're skipping legs, say so.
- Back every recommendation with their actual data and numbers.
- Consider muscle readiness when programming — don't train fatigued muscles hard.
- Program progressive overload: if they did 4x10 at 90lbs last time, suggest 4x10 at 95lbs or 5x10 at 90lbs.
- If they report pain (not just soreness), recommend seeing a professional and program around the issue.
- When creating workouts, always include a warm-up set on the first compound movement.
- Keep sessions to 5-7 exercises for focused training.
- When creating a workout, always confirm the plan with the user before pushing it to Tonal.
- IMPORTANT: Only use exercise names and movementIds from the search_exercises tool. Never invent exercise names.

WEEKLY PROGRAMMING:
- When the user asks to "program my week" or similar, use program_week to generate a draft plan.
- If you don't know their preferences (split, days, duration), ask FIRST before calling program_week. Ask one question at a time.
- If they have saved preferences, program_week will use them automatically — just call it.
- After program_week returns, present the full plan to the user in a readable format showing each day with exercises, sets, reps, and progressive overload targets.
- WAIT for user approval before pushing. They can ask to swap exercises, move days, adjust duration, or reject the plan entirely.
- When the user approves ("looks good", "send it", "push it"), use approve_week_plan to push all workouts to Tonal.
- When presenting the plan, format each training day clearly:
  DAY — Session Type (Target Muscles) — Duration
  1. Exercise Name: sets×reps @ target weight (last: previous performance)
- For returning users who say "program next week" or "program my week", call program_week without parameters — it will use their saved preferences.
- If the user wants to start over, use delete_week_plan then program_week again.`,

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
    swap_exercise: swapExerciseTool,
    move_session: moveSessionTool,
    adjust_session_duration: adjustSessionDurationTool,
  },

  maxSteps: 15,

  contextHandler: async (ctx, args) => {
    if (!args.userId) return [...args.recent, ...args.inputPrompt];

    const snapshot = await buildTrainingSnapshot(ctx, args.userId);
    const snapshotMessage = {
      role: "system" as const,
      content: snapshot,
    };
    return [snapshotMessage, ...args.recent, ...args.inputPrompt];
  },
});
