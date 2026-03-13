import type { PromptDefinition, PromptHandler } from "./registry";

async function buildWorkoutPrompt(params: Record<string, string>): ReturnType<PromptHandler> {
  const { muscleGroups, durationMinutes, difficulty } = params;
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Build me a ${durationMinutes}-minute Tonal workout targeting: ${muscleGroups}. Difficulty: ${difficulty}.

Instructions:
1. Use search_movements to find exercises for each target muscle group
2. Select 4-8 exercises that create a balanced workout
3. Group them into blocks — each block has 1-2 exercises (2 = superset)
4. Use estimate_workout with the blocks to check duration
5. Adjust sets/reps/blocks if the estimate doesn't match the target
6. Use create_custom_workout with the final blocks to create it

Block structure tips:
- Each block = 1-2 exercises. Single exercise = straight sets. Two = superset.
- Start with compound movements in early blocks, isolation in later blocks
- 2-4 sets per exercise, 8-12 reps for hypertrophy, 4-6 for strength
- Enable spotter on heavy compound lifts (bench press, squats)
- Beginners: 3-4 blocks, 3 sets each, no supersets
- Advanced: 4-6 blocks, supersets, consider eccentric mode on key lifts`,
        },
      },
    ],
  };
}

async function weeklyPlanPrompt(params: Record<string, string>): ReturnType<PromptHandler> {
  const { daysPerWeek, goals } = params;
  const goalGuidance =
    goals === "strength"
      ? "Focus on compound lifts, 3-5 rep range, longer rest"
      : goals === "endurance"
        ? "Higher rep ranges (12-20), shorter rest, circuit-style blocks"
        : "Mix heavy compound days with higher-rep accessory days";

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Design a ${daysPerWeek}-day weekly Tonal training plan. Goal: ${goals}.

Instructions:
1. Use get_muscle_readiness to check current recovery status
2. Use list_workout_history to review recent training (last 7-14 days)
3. Use get_strength_scores to understand current strength levels
4. Design the weekly split (e.g. Push/Pull/Legs, Upper/Lower, Full Body)
5. For each day, use search_movements to pick exercises
6. Create each day's workout with create_custom_workout

Guidelines:
- Prioritize recovered muscle groups first in the week
- Don't train the same muscle group on consecutive days
- ${goalGuidance}
- Include at least one rest day between intense sessions`,
        },
      },
    ],
  };
}

async function analyzeProgressPrompt(params: Record<string, string>): ReturnType<PromptHandler> {
  const { timeframe } = params;
  const limit = timeframe === "week" ? 7 : timeframe === "month" ? 30 : 90;
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Analyze my Tonal training progress for the past ${timeframe}.

Instructions:
1. Use get_progress_metrics with limit=${limit} to get workout history overview
2. Use list_workout_history with limit=${limit} for detailed session info
3. Use get_strength_scores to see current strength levels
4. Use get_muscle_readiness to check recovery status

Analyze:
- Training frequency and consistency
- Volume trends (are they progressing?)
- Target area balance (are any muscle groups neglected?)
- Workout type variety
- Duration patterns

Provide:
- A summary of training patterns
- Strengths and areas for improvement
- Specific recommendations for the next ${timeframe}
- Any muscle imbalances or overtraining concerns`,
        },
      },
    ],
  };
}

export const mcpPromptDefinitions: PromptDefinition[] = [
  {
    name: "build_workout",
    description: "Build a custom Tonal workout targeting specific muscle groups",
    arguments: [
      {
        name: "muscleGroups",
        description: "Comma-separated muscle groups (e.g. Chest,Shoulders,Triceps)",
        required: true,
      },
      { name: "durationMinutes", description: "Target duration in minutes", required: true },
      {
        name: "difficulty",
        description: "beginner, intermediate, or advanced",
        required: true,
      },
    ],
  },
  {
    name: "weekly_plan",
    description: "Design a weekly Tonal training plan based on goals and recovery",
    arguments: [
      { name: "daysPerWeek", description: "Training days per week (3-6)", required: true },
      { name: "goals", description: "strength, endurance, or hybrid", required: true },
    ],
  },
  {
    name: "analyze_progress",
    description: "Analyze training progress and suggest improvements",
    arguments: [{ name: "timeframe", description: "week, month, or quarter", required: true }],
  },
];

export const mcpPromptHandlers: Record<string, PromptHandler> = {
  build_workout: buildWorkoutPrompt,
  weekly_plan: weeklyPlanPrompt,
  analyze_progress: analyzeProgressPrompt,
};
