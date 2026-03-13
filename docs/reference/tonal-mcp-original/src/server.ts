import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { tonal } from "./api-client.js";
import { cache, PROFILE_TTL } from "./cache.js";
import { getUserId } from "./user-id.js";
import { getMovements } from "./tools/exercises.js";
import { registerUserTools } from "./tools/user.js";
import { registerExerciseTools } from "./tools/exercises.js";
import { registerAnalyticsTools } from "./tools/analytics.js";
import { registerWorkoutTools } from "./tools/workouts.js";
import type { TonalUser, StrengthScore, MuscleReadiness } from "./types.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "tonal",
    version: "1.0.0",
  });

  // --- Resources ---

  server.resource(
    "exercises",
    "tonal://exercises",
    {
      description:
        "Full Tonal movements/exercises library with IDs, names, and muscle groups. Use this to look up movement IDs for workout creation.",
    },
    async () => {
      const movements = await getMovements();
      const summary = movements.map((m) => ({
        id: m.id,
        name: m.name,
        muscleGroups: m.muscleGroups,
        onMachine: m.onMachine,
        skillLevel: m.skillLevel,
      }));
      return {
        contents: [
          {
            uri: "tonal://exercises",
            mimeType: "application/json",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    },
  );

  server.resource(
    "user-profile",
    "tonal://user-profile",
    {
      description: "Tonal user profile with strength scores snapshot (uses authenticated user)",
    },
    async (uri) => {
      const userId = await getUserId();
      const cacheKey = `/v6/users/${userId}`;
      let user = cache.get<TonalUser>(cacheKey);
      if (!user) {
        user = await tonal.get<TonalUser>(cacheKey);
        cache.set(cacheKey, user, PROFILE_TTL);
      }
      const scores = await tonal.get<StrengthScore[]>(
        `/v6/users/${userId}/strength-scores/current`,
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                ...user,
                strengthScores: scores.map((s) => ({
                  region: s.bodyRegionDisplay,
                  score: s.score,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.resource(
    "muscle-readiness",
    "tonal://muscle-readiness",
    {
      description:
        "Current muscle recovery/readiness per muscle group (0-100 scale, uses authenticated user)",
    },
    async (uri) => {
      const userId = await getUserId();
      const readiness = await tonal.get<MuscleReadiness>(
        `/v6/users/${userId}/muscle-readiness/current`,
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(readiness, null, 2),
          },
        ],
      };
    },
  );

  // --- Prompts ---

  server.prompt(
    "build_workout",
    "Build a custom Tonal workout targeting specific muscle groups and duration",
    {
      muscleGroups: z
        .string()
        .describe("Comma-separated muscle groups to target (e.g. Chest,Shoulders,Triceps)"),
      durationMinutes: z.string().describe("Target workout duration in minutes (e.g. 20, 30, 45)"),
      difficulty: z.string().describe("Difficulty level: beginner, intermediate, or advanced"),
    },
    async ({ muscleGroups, durationMinutes, difficulty }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
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
    }),
  );

  server.prompt(
    "weekly_plan",
    "Design a weekly Tonal training plan based on goals and recovery",
    {
      daysPerWeek: z.string().describe("Training days per week (3-6)"),
      goals: z.string().describe("Training goal: strength, endurance, or hybrid"),
    },
    async ({ daysPerWeek, goals }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
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
- ${goals === "strength" ? "Focus on compound lifts, 3-5 rep range, longer rest" : ""}
- ${goals === "endurance" ? "Higher rep ranges (12-20), shorter rest, circuit-style blocks" : ""}
- ${goals === "hybrid" ? "Mix heavy compound days with higher-rep accessory days" : ""}
- Include at least one rest day between intense sessions`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "analyze_progress",
    "Analyze Tonal training progress and suggest improvements",
    {
      timeframe: z.string().describe("Analysis period: week, month, or quarter"),
    },
    async ({ timeframe }) => {
      const limit = timeframe === "week" ? 7 : timeframe === "month" ? 30 : 90;
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
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
    },
  );

  // --- Tools ---

  registerUserTools(server);
  registerExerciseTools(server);
  registerAnalyticsTools(server);
  registerWorkoutTools(server);

  return server;
}
