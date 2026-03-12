import { Agent } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { components } from "../_generated/api";
import { buildTrainingSnapshot } from "./context";
import {
  searchExercisesTool,
  getStrengthScoresTool,
  getStrengthHistoryTool,
  getMuscleReadinessTool,
  getWorkoutHistoryTool,
  getWorkoutDetailTool,
  getTrainingFrequencyTool,
  createWorkoutTool,
  deleteWorkoutTool,
  estimateDurationTool,
} from "./tools";

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
- IMPORTANT: Only use exercise names and movementIds from the search_exercises tool. Never invent exercise names.`,

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
  },

  maxSteps: 10,

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
