import { createTool, type ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type {
  Activity,
  Movement,
  MuscleReadiness,
  StrengthScore,
  StrengthScoreHistoryEntry,
  WorkoutActivityDetail,
} from "../tonal/types";
import { requireUserId } from "./helpers";

async function getGlobalMovementCatalog(ctx: ToolCtx): Promise<Movement[]> {
  return ctx.runQuery(internal.tonal.movementSync.getAllMovements);
}

export const searchExercisesTool = createTool({
  description: "Search Tonal exercise catalog by name and/or muscle group.",
  inputSchema: z.object({
    name: z.string().optional().describe("Exercise name substring"),
    muscleGroup: z.string().optional().describe("e.g. Chest, Back, Quads, Shoulders"),
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
      results = results.filter((m) => m.muscleGroups.some((mg) => mg.toLowerCase() === g));
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
  description: "Get Tonal strength scores by body region and percentile.",
  inputSchema: z.object({}),
  execute: async (
    ctx,
  ): Promise<{
    scores: { region: string; score: number }[];
    overall: number;
    percentile: number;
  }> => {
    const userId = requireUserId(ctx);
    const scores = (await ctx.runAction(internal.tonal.proxy.fetchStrengthScores, {
      userId,
    })) as StrengthScore[];

    const distribution = (await ctx.runAction(internal.tonal.proxy.fetchStrengthDistribution, {
      userId,
    })) as { overallScore: number; percentile: number };

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
  description: "Get strength score history over time by region.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<StrengthScoreHistoryEntry[]> => {
    const userId = requireUserId(ctx);
    return (await ctx.runAction(internal.tonal.proxy.fetchStrengthHistory, {
      userId,
    })) as StrengthScoreHistoryEntry[];
  },
});

export const getMuscleReadinessTool = createTool({
  description: "Get muscle readiness (0-100) per muscle group.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<MuscleReadiness> => {
    const userId = requireUserId(ctx);
    return (await ctx.runAction(internal.tonal.proxy.fetchMuscleReadiness, {
      userId,
    })) as MuscleReadiness;
  },
});

export const getWorkoutHistoryTool = createTool({
  description: "Get recent workout history (dates, titles, target areas, volume).",
  inputSchema: z.object({
    limit: z.number().optional().default(20).describe("Max workouts to return"),
  }),
  execute: async (ctx, input) => {
    const userId = requireUserId(ctx);
    const activities = (await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
      userId,
      limit: input.limit,
    })) as Activity[];

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
  description: "Get full workout detail (exercises, sets, reps, volume).",
  inputSchema: z.object({
    activityId: z.string().describe("Activity ID from workout history"),
  }),
  execute: async (ctx, input): Promise<WorkoutActivityDetail> => {
    const userId = requireUserId(ctx);
    return (await ctx.runAction(internal.tonal.proxy.fetchWorkoutDetail, {
      userId,
      activityId: input.activityId,
    })) as WorkoutActivityDetail;
  },
});

export const getTrainingFrequencyTool = createTool({
  description: "Training frequency per muscle group from recent history.",
  inputSchema: z.object({}),
  execute: async (ctx) => {
    const userId = requireUserId(ctx);
    const activities = (await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
      userId,
      limit: 30,
    })) as Activity[];

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
    "Create a custom workout on Tonal. Confirm with the user first. Use movementIds from search_exercises. A date prefix is added automatically to the title on Tonal.",
  inputSchema: z.object({
    title: z
      .string()
      .describe(
        'Short descriptive name: target area + style. Do NOT include dates. Examples: "Upper Body Strength", "Leg Day – Quad Focus", "Push – Chest & Triceps".',
      ),
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
  execute: async (
    ctx,
    input,
  ): Promise<
    | { success: true; workoutId: string; title: string; setCount: number; planId: string }
    | { success: false; error: string }
  > => {
    const userId = requireUserId(ctx);

    // Pre-validate movement IDs against the movements table
    const allMovementIds = input.blocks.flatMap((b) => b.exercises.map((e) => e.movementId));
    const validatedMovements = await ctx.runQuery(internal.tonal.movementSync.getByTonalIds, {
      tonalIds: allMovementIds,
    });
    const validIds = new Set(validatedMovements.map((m) => m.id));
    const invalidIds = allMovementIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return {
        success: false,
        error: `Invalid movementIds: ${invalidIds.join(", ")}. You MUST call search_exercises first to get valid IDs from Tonal's catalog. Do not guess or fabricate IDs.`,
      };
    }

    return ctx.runAction(internal.tonal.mutations.createWorkout, {
      userId,
      title: input.title,
      blocks: input.blocks,
    });
  },
});
export const deleteWorkoutTool = createTool({
  description: "Delete a custom workout from Tonal.",
  inputSchema: z.object({
    workoutId: z.string().describe("Tonal workout ID"),
  }),
  execute: async (ctx, input): Promise<{ deleted: true }> => {
    const userId = requireUserId(ctx);
    return (await ctx.runAction(internal.tonal.mutations.deleteWorkout, {
      userId,
      workoutId: input.workoutId,
    })) as { deleted: true };
  },
});

export const estimateDurationTool = createTool({
  description: "Estimate workout duration from exercise blocks.",
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
    const userId = requireUserId(ctx);
    const result = (await ctx.runAction(internal.tonal.mutations.estimateWorkout, {
      userId,
      blocks: input.blocks,
    })) as { duration: number };
    return { estimatedMinutes: Math.round(result.duration / 60) };
  },
});

export const listProgressPhotosTool = createTool({
  description:
    "List progress photos (id, date). Use for compare only if analysis enabled in Settings.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<{ photos: { id: string; createdAt: number }[] }> => {
    const userId = requireUserId(ctx);
    const rows = (await ctx.runQuery(internal.progressPhotos.listByUserId, {
      userId,
    })) as { _id: Id<"progressPhotos">; createdAt: number }[];
    return {
      photos: rows.map((r) => ({ id: r._id, createdAt: r.createdAt })),
    };
  },
});

export const compareProgressPhotosTool = createTool({
  description:
    "Compare two progress photos; brief factual observations. Requires analysis enabled and list_progress_photos ids.",
  inputSchema: z.object({
    photoId1: z.string().describe("First photo id (earlier)"),
    photoId2: z.string().describe("Second photo id (later)"),
  }),
  execute: async (ctx, input): Promise<{ observations: string; error?: string }> => {
    const userId = requireUserId(ctx);
    try {
      const observations = await ctx.runAction(internal.progressPhotos.compareProgressPhotos, {
        userId,
        photoId1: input.photoId1 as Id<"progressPhotos">,
        photoId2: input.photoId2 as Id<"progressPhotos">,
      });
      return { observations };
    } catch (err) {
      return {
        observations: "",
        error: err instanceof Error ? err.message : "Comparison failed",
      };
    }
  },
});
