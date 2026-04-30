import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";
import type {
  Activity,
  Movement,
  MuscleReadiness,
  StrengthScore,
  StrengthScoreHistoryEntry,
} from "../tonal/types";
import type { EnrichedWorkoutDetail } from "../workoutDetail";
import { requireUserId, withToolTracking } from "./helpers";

export const KNOWN_TRAINING_TYPES = [
  "Strength",
  "High Intensity",
  "Mobility",
  "Recovery",
  "Yoga",
  "Pilates",
  "Pre & Postnatal",
] as const;

export const searchExercisesTool = createTool({
  description:
    "Search Tonal's exercise catalog by name, muscle group, and/or training type. Use this before naming, suggesting, swapping, or programming exercises; results include canonical Tonal names, movement IDs, accessory requirements, and duration-vs-rep behavior. Default match is name-strict (matches name/shortName only) — set looseMatch:true to also match in descriptions if a strict search returns nothing.",
  inputSchema: z.object({
    name: z
      .string()
      .optional()
      .describe(
        "Exercise name or common name (e.g. 'Romanian Deadlift', 'RDL'). Match is on name and shortName by default — descriptions are not searched.",
      ),
    muscleGroup: z
      .string()
      .optional()
      .describe("Use when exploring options for a body part, e.g. Chest, Back, Quads, Shoulders."),
    trainingType: z
      .enum(KNOWN_TRAINING_TYPES)
      .optional()
      .describe(
        `Use to narrow by type. Valid values: ${KNOWN_TRAINING_TYPES.join(", ")}. Note: there is NO 'Warm-up' tag — Tonal warmups are tagged 'Mobility'.`,
      ),
    looseMatch: z
      .boolean()
      .optional()
      .describe(
        "When true, fall back to matching in exercise descriptions in addition to name/shortName. Use only if a strict search returns no results. Default: false (strict, name-only).",
      ),
  }),
  execute: withToolTracking("search_exercises", async (ctx, input, _options) => {
    const results = (await ctx.runQuery(internal.tonal.movementSearchQueries.searchMovements, {
      name: input.name,
      muscleGroup: input.muscleGroup,
      trainingType: input.trainingType,
      limit: 30,
      matchMode: input.looseMatch ? "loose" : "strict",
    })) as Movement[];

    return results.map((m) => ({
      movementId: m.id,
      name: m.name,
      muscleGroups: m.muscleGroups,
      onMachine: m.onMachine,
      skillLevel: m.skillLevel,
      accessory: m.onMachineInfo?.accessory ?? "None",
      trainingTypes: m.trainingTypes ?? [],
      isDurationBased: !m.countReps,
    }));
  }),
});

export const getStrengthScoresTool = createTool({
  description:
    "Get Tonal Strength Scores by body region. These are a PROPRIETARY fitness metric on a 0-999 scale — NOT weight in pounds. Higher means stronger relative to the user's body. Use actual workout history (avgWeightLbs) for real weight data.",
  inputSchema: z.object({}),
  execute: withToolTracking(
    "get_strength_scores",
    async (
      ctx,
      _input,
      _options,
    ): Promise<{
      note: string;
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
        note: "Tonal Strength Scores are a proprietary metric (0-999 scale), NOT weight in pounds. Do not report these as lbs.",
        scores: scores.map((s) => ({
          region: s.bodyRegionDisplay,
          score: s.score,
        })),
        overall: distribution.overallScore,
        percentile: distribution.percentile,
      };
    },
  ),
});

export const getStrengthHistoryTool = createTool({
  description: "Get strength score history over time by region (last 30 entries per region).",
  inputSchema: z.object({}),
  execute: withToolTracking(
    "get_strength_history",
    async (ctx, _input, _options): Promise<StrengthScoreHistoryEntry[]> => {
      const userId = requireUserId(ctx);
      const history = (await ctx.runAction(internal.tonal.proxyProjected.fetchStrengthHistory, {
        userId,
      })) as StrengthScoreHistoryEntry[];
      // Cap returned entries to prevent large tool results from bloating context
      return history.slice(0, 30);
    },
  ),
});

export const getMuscleReadinessTool = createTool({
  description: "Get muscle readiness (0-100) per muscle group.",
  inputSchema: z.object({}),
  execute: withToolTracking(
    "get_muscle_readiness",
    async (ctx, _input, _options): Promise<MuscleReadiness> => {
      const userId = requireUserId(ctx);
      return (await ctx.runAction(internal.tonal.proxy.fetchMuscleReadiness, {
        userId,
      })) as MuscleReadiness;
    },
  ),
});

export const getWorkoutHistoryTool = createTool({
  description:
    "LIST a window of recent completed workouts: one row per workout with activityId, date, title, target area, total volume, duration. Start here when the user asks 'what have I done lately' or you need an activityId to drill into. Does NOT include exercise names or per-movement details — call get_workout_detail with the activityId for that. Does NOT include PR/plateau/trend analysis — call get_workout_performance for that.",
  inputSchema: z.object({
    limit: z.number().optional().default(20).describe("Max workouts to return"),
  }),
  execute: withToolTracking("get_workout_history", async (ctx, input, _options) => {
    const userId = requireUserId(ctx);
    const activities = (await ctx.runAction(
      internal.tonal.workoutHistoryProxy.fetchWorkoutHistory,
      {
        userId,
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
  }),
});

export const getWorkoutDetailTool = createTool({
  description:
    "DRILL into a SINGLE completed workout by activityId: returns every exercise (with resolved movementName + muscleGroups), every set (weight, reps, duration, PR flag), per-movement summaries. Use this when the user asks about specific exercises in a specific workout — never guess from titles. Requires an activityId (get one from get_workout_history first). Does NOT compare across workouts — that is get_workout_performance.",
  inputSchema: z.object({
    activityId: z.string().describe("Activity ID from workout history"),
  }),
  execute: withToolTracking(
    "get_workout_detail",
    async (ctx, input, _options): Promise<EnrichedWorkoutDetail | null> => {
      // Call the internal action with explicit userId. Calling the public
      // action via `api.workoutDetail.getWorkoutDetail` from the agent runtime
      // failed ~46% of the time with "Not authenticated" — the agent runtime
      // doesn't reliably propagate auth context through runAction.
      const userId = requireUserId(ctx);
      const detail = (await ctx.runAction(internal.workoutDetail.getWorkoutDetailInternal, {
        userId,
        activityId: input.activityId,
      })) as EnrichedWorkoutDetail | null;
      return detail;
    },
  ),
});

export const getTrainingFrequencyTool = createTool({
  description: "Training frequency per muscle group from recent history.",
  inputSchema: z.object({}),
  execute: withToolTracking("get_training_frequency", async (ctx, _input, _options) => {
    const userId = requireUserId(ctx);
    const activities = (await ctx.runAction(
      internal.tonal.workoutHistoryProxy.fetchWorkoutHistory,
      {
        userId,
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
  }),
});

export const createWorkoutTool = createTool({
  description:
    "Create a ONE-OFF custom workout on Tonal. ONLY for single standalone workouts, NEVER for weekly programming. For weekly plans (Push/Pull/Legs, Upper/Lower, etc.), use program_week instead. Every movementId MUST come from a prior search_exercises call. For duration-based exercises (isDurationBased=true from search_exercises), specify 'duration' in seconds instead of 'reps'.",
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
  execute: withToolTracking(
    "create_workout",
    async (
      ctx,
      input,
      _options,
    ): Promise<
      | {
          success: true;
          workoutId: string;
          title: string;
          setCount: number;
          planId: string;
          divergenceWarning?: string;
        }
      | { success: false; error: string }
    > => {
      const userId = requireUserId(ctx);

      // Pre-validate movement IDs against the movements table
      const allMovementIds = input.blocks.flatMap((b) => b.exercises.map((e) => e.movementId));
      const validatedMovements: Movement[] = await ctx.runQuery(
        internal.tonal.movementSync.getByTonalIds,
        {
          tonalIds: allMovementIds,
        },
      );
      const validIds = new Set(validatedMovements.map((m) => m.id));
      const invalidIds = allMovementIds.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        const pctInvalid = invalidIds.length / allMovementIds.length;
        const isLikelyHallucination = pctInvalid > 0.3 || invalidIds.length >= 3;
        return {
          success: false,
          error: isLikelyHallucination
            ? `STOP: ${invalidIds.length} of ${allMovementIds.length} movement IDs are invalid. You are fabricating IDs. You MUST call search_exercises for EACH exercise to get real UUIDs from Tonal's catalog. If you are building a weekly plan, use program_week instead of create_workout.`
            : `Invalid movementIds: ${invalidIds.join(", ")}. Call search_exercises to get valid IDs. Do not guess or reuse IDs from previous conversations.`,
        };
      }

      // Auto-correct duration vs reps based on movement.countReps
      const movementMap = new Map(validatedMovements.map((m) => [m.id, m]));
      const correctedBlocks = input.blocks.map((block) => ({
        exercises: block.exercises.map((ex) => {
          const movement = movementMap.get(ex.movementId);
          if (movement && !movement.countReps) {
            // Duration-based movement: use duration, ignore reps
            return { ...ex, duration: ex.duration ?? 30, reps: undefined };
          }
          // Rep-based movement: use reps, ignore duration
          return { ...ex, reps: ex.reps ?? 10, duration: undefined };
        }),
      }));

      const pushed = await ctx.runAction(internal.tonal.mutations.createWorkout, {
        userId,
        title: input.title,
        blocks: correctedBlocks,
      });

      if (!pushed.success) return pushed;

      // Strip pushDivergence from the LLM-visible return; it is a structured object
      // the LLM has no schema for. Surface only a human-readable warning when needed.
      const { pushDivergence: _pushDivergence, ...pushedSummary } = pushed;

      if (
        _pushDivergence &&
        (_pushDivergence.missingMovements.length > 0 ||
          _pushDivergence.extraMovements.length > 0 ||
          _pushDivergence.setCountMismatches.length > 0)
      ) {
        console.warn(`createWorkoutTool: divergence on ${pushed.workoutId}`, _pushDivergence);
        return {
          ...pushedSummary,
          divergenceWarning: `WARNING: Tonal stored the workout differently than sent. Missing movements: ${_pushDivergence.missingMovements.length}. Set-count mismatches: ${_pushDivergence.setCountMismatches.length}. Tell the user to verify the workout on their Tonal.`,
        };
      }

      return pushedSummary;
    },
  ),
});
export const deleteWorkoutTool = createTool({
  description: "Delete a custom workout from Tonal.",
  inputSchema: z.object({
    workoutId: z.string().describe("Tonal workout ID"),
  }),
  execute: withToolTracking(
    "delete_workout",
    async (ctx, input, _options): Promise<{ deleted: true }> => {
      const userId = requireUserId(ctx);
      return (await ctx.runAction(internal.tonal.mutations.deleteWorkout, {
        userId,
        workoutId: input.workoutId,
      })) as { deleted: true };
    },
  ),
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
  execute: withToolTracking(
    "estimate_duration",
    async (ctx, input, _options): Promise<{ estimatedMinutes: number }> => {
      const userId = requireUserId(ctx);
      const result = (await ctx.runAction(internal.tonal.mutations.estimateWorkout, {
        userId,
        blocks: input.blocks,
      })) as { duration: number };
      return { estimatedMinutes: Math.round(result.duration / 60) };
    },
  ),
});
