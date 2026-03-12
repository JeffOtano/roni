import { createTool, type ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Movement, Activity, StrengthScore } from "../tonal/types";

async function getGlobalMovementCatalog(ctx: ToolCtx): Promise<Movement[]> {
  const cached = await ctx.runQuery(internal.tonal.cache.getCacheEntry, {
    userId: undefined,
    dataType: "movements",
  });
  return (cached?.data as Movement[]) ?? [];
}

export const searchExercisesTool = createTool({
  description:
    "Search Tonal's exercise catalog by name and/or muscle group. Returns matching exercises with movementId, name, and muscle groups.",
  inputSchema: z.object({
    name: z.string().optional().describe("Exercise name substring to search"),
    muscleGroup: z
      .string()
      .optional()
      .describe(
        "e.g. Chest, Back, Quads, Shoulders, Biceps, Triceps, Abs, Glutes, Hamstrings, Calves",
      ),
  }),
  execute: async (ctx, input) => {
    const catalog = await getGlobalMovementCatalog(ctx);
    let results = catalog;

    if (input.name) {
      const q = input.name.toLowerCase();
      results = results.filter((m) => m.name.toLowerCase().includes(q));
    }
    if (input.muscleGroup) {
      const g = input.muscleGroup.toLowerCase();
      results = results.filter((m) =>
        m.muscleGroups.some((mg) => mg.toLowerCase() === g),
      );
    }

    return results.slice(0, 30).map((m) => ({
      movementId: m.id,
      name: m.name,
      muscleGroups: m.muscleGroups,
      onMachine: m.onMachine,
      skillLevel: m.skillLevel,
    }));
  },
});

export const getStrengthScoresTool = createTool({
  description:
    "Get the user's current Tonal strength scores broken down by body region (upper, lower, core, overall) and their percentile ranking.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<{
    scores: { region: string; score: number }[];
    overall: number;
    percentile: number;
  }> => {
    if (!ctx.userId) throw new Error("Not authenticated");
    const scores = (await ctx.runAction(
      internal.tonal.proxy.fetchStrengthScores,
      { userId: ctx.userId as any },
    )) as StrengthScore[];

    const distribution = (await ctx.runAction(
      internal.tonal.proxy.fetchStrengthDistribution,
      { userId: ctx.userId as any },
    )) as { overallScore: number; percentile: number };

    return {
      scores: scores.map((s) => ({
        region: s.bodyRegionDisplay,
        score: s.score,
      })),
      overall: distribution.overallScore,
      percentile: distribution.percentile,
    };
  },
});

export const getStrengthHistoryTool = createTool({
  description:
    "Get the user's strength score history over time showing trends for upper, lower, core, and overall scores.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<unknown> => {
    if (!ctx.userId) throw new Error("Not authenticated");
    const history: unknown = await ctx.runAction(
      internal.tonal.proxy.fetchStrengthHistory,
      { userId: ctx.userId as any },
    );
    return history;
  },
});

export const getMuscleReadinessTool = createTool({
  description:
    "Get muscle readiness scores (0-100) for each muscle group. Higher = more recovered and ready to train.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<unknown> => {
    if (!ctx.userId) throw new Error("Not authenticated");
    return ctx.runAction(internal.tonal.proxy.fetchMuscleReadiness, {
      userId: ctx.userId as any,
    });
  },
});

export const getWorkoutHistoryTool = createTool({
  description:
    "Get the user's recent workout history showing dates, workout titles, target areas, and total volume.",
  inputSchema: z.object({
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Number of recent workouts to fetch"),
  }),
  execute: async (ctx, input) => {
    if (!ctx.userId) throw new Error("Not authenticated");
    const activities = (await ctx.runAction(
      internal.tonal.proxy.fetchWorkoutHistory,
      {
        userId: ctx.userId as any,
        limit: input.limit,
      },
    )) as Activity[];

    return activities.map((a) => ({
      activityId: a.activityId,
      date: a.activityTime,
      title: a.workoutPreview.workoutTitle,
      targetArea: a.workoutPreview.targetArea,
      totalVolume: a.workoutPreview.totalVolume,
      duration: a.workoutPreview.totalDuration,
      type: a.workoutPreview.workoutType,
    }));
  },
});

export const getWorkoutDetailTool = createTool({
  description:
    "Get detailed information about a specific workout including all exercises, sets, reps, and volume.",
  inputSchema: z.object({
    activityId: z.string().describe("The activity ID from workout history"),
  }),
  execute: async (ctx, input): Promise<unknown> => {
    if (!ctx.userId) throw new Error("Not authenticated");
    return ctx.runAction(internal.tonal.proxy.fetchWorkoutDetail, {
      userId: ctx.userId as any,
      activityId: input.activityId,
    });
  },
});

export const getTrainingFrequencyTool = createTool({
  description:
    "Analyze training frequency by looking at recent workout history to determine how often each muscle group is being trained.",
  inputSchema: z.object({}),
  execute: async (ctx) => {
    if (!ctx.userId) throw new Error("Not authenticated");
    const activities = (await ctx.runAction(
      internal.tonal.proxy.fetchWorkoutHistory,
      {
        userId: ctx.userId as any,
        limit: 30,
      },
    )) as Activity[];

    const muscleGroupCounts: Record<string, number> = {};
    const lastTrained: Record<string, string> = {};

    for (const a of activities) {
      const area = a.workoutPreview.targetArea;
      if (area) {
        muscleGroupCounts[area] = (muscleGroupCounts[area] || 0) + 1;
        if (!lastTrained[area]) {
          lastTrained[area] = a.activityTime;
        }
      }
    }

    return {
      sessionsPerArea: muscleGroupCounts,
      lastTrainedPerArea: lastTrained,
      totalSessions: activities.length,
      periodDays: 30,
    };
  },
});

export const createWorkoutTool = createTool({
  description:
    "Create a custom workout on the user's Tonal. Always confirm with user first. Use movementIds from search_exercises.",
  inputSchema: z.object({
    title: z.string().describe("Workout title"),
    blocks: z
      .array(
        z.object({
          exercises: z
            .array(
              z.object({
                movementId: z.string().describe("UUID from search_exercises"),
                sets: z.number().int().min(1).max(10).default(3),
                reps: z.number().int().optional(),
                duration: z.number().int().optional(),
                spotter: z.boolean().default(false),
                eccentric: z.boolean().default(false),
                warmUp: z.boolean().default(false),
              }),
            )
            .min(1)
            .max(6),
        }),
      )
      .min(1)
      .max(10),
  }),
  execute: async (ctx, input): Promise<unknown> => {
    if (!ctx.userId) throw new Error("Not authenticated");
    return ctx.runAction(internal.tonal.proxy.createWorkout, {
      userId: ctx.userId as any,
      title: input.title,
      blocks: input.blocks,
    });
  },
});

export const deleteWorkoutTool = createTool({
  description: "Delete a custom workout from the user's Tonal.",
  inputSchema: z.object({
    workoutId: z.string().describe("The Tonal workout ID to delete"),
  }),
  execute: async (ctx, input): Promise<unknown> => {
    if (!ctx.userId) throw new Error("Not authenticated");
    return ctx.runAction(internal.tonal.proxy.deleteWorkout, {
      userId: ctx.userId as any,
      workoutId: input.workoutId,
    });
  },
});

export const estimateDurationTool = createTool({
  description:
    "Estimate how long a workout will take based on the exercise blocks.",
  inputSchema: z.object({
    blocks: z
      .array(
        z.object({
          exercises: z
            .array(
              z.object({
                movementId: z.string(),
                sets: z.number().int().min(1).max(10).default(3),
                reps: z.number().int().optional(),
                duration: z.number().int().optional(),
              }),
            )
            .min(1),
        }),
      )
      .min(1),
  }),
  execute: async (ctx, input): Promise<{ estimatedMinutes: number }> => {
    if (!ctx.userId) throw new Error("Not authenticated");
    const result = (await ctx.runAction(
      internal.tonal.proxy.estimateWorkout,
      {
        userId: ctx.userId as any,
        blocks: input.blocks,
      },
    )) as { duration: number };
    return { estimatedMinutes: Math.round(result.duration / 60) };
  },
});
