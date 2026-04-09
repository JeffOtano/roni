import type { ToolContext, ToolDefinition, ToolHandler } from "../registry";
import { internal } from "../../_generated/api";
import { aggregateProgressMetrics, aggregateTrainingFrequency } from "./aggregations";
import type {
  Activity,
  FormattedWorkoutSummary,
  Movement,
  WorkoutActivityDetail,
} from "../../tonal/types";

// --- Tool handlers ---

async function listWorkoutHistory(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const limit = (args.limit as number | undefined) ?? 20;
  const activities: Activity[] = await toolCtx.ctx.runAction(
    internal.tonal.proxy.fetchWorkoutHistory,
    {
      userId: toolCtx.userId,
      limit,
    },
  );

  const summary = activities.map((a) => ({
    activityId: a.activityId,
    date: a.activityTime,
    title: a.workoutPreview.workoutTitle,
    targetArea: a.workoutPreview.targetArea,
    volume: a.workoutPreview.totalVolume,
    duration: a.workoutPreview.totalDuration,
    coach: a.workoutPreview.coachName,
  }));

  return {
    content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
  };
}

async function getWorkoutDetail(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const activityId = args.activityId as string;
  const detail = await toolCtx.ctx.runAction(internal.tonal.proxy.fetchWorkoutDetail, {
    userId: toolCtx.userId,
    activityId,
  });
  if (!detail) {
    return { content: [{ type: "text", text: "Workout activity not found." }] };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
  };
}

async function getWorkoutMovements(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const activityId = args.activityId as string;

  const [detail, formatted, movements] = (await Promise.all([
    toolCtx.ctx.runAction(internal.tonal.proxy.fetchWorkoutDetail, {
      userId: toolCtx.userId,
      activityId,
    }),
    toolCtx.ctx
      .runAction(internal.tonal.proxy.fetchFormattedSummary, {
        userId: toolCtx.userId,
        summaryId: activityId,
      })
      .catch(() => null),
    toolCtx.ctx.runQuery(internal.tonal.movementSync.getAllMovements),
  ])) as [WorkoutActivityDetail | null, FormattedWorkoutSummary | null, Movement[]];

  if (!detail) {
    return { content: [{ type: "text", text: "Workout activity not found." }] };
  }

  const typedDetail = detail as WorkoutActivityDetail;
  const movementMap = new Map(movements.map((m) => [m.id, m]));

  // Volume per movement from formatted summary
  const volumeMap = new Map<string, number>();
  if (formatted?.movementSets) {
    for (const ms of formatted.movementSets) {
      volumeMap.set(ms.movementId, ms.totalVolume);
    }
  }

  // Group sets by movementId
  const byMovement = new Map<
    string,
    { sets: number; totalReps: number; usedSpotter: boolean; usedEccentric: boolean }
  >();

  for (const set of typedDetail.workoutSetActivity ?? []) {
    const existing = byMovement.get(set.movementId) ?? {
      sets: 0,
      totalReps: 0,
      usedSpotter: false,
      usedEccentric: false,
    };
    existing.sets += 1;
    existing.totalReps += set.repetition;
    if (set.spotter) existing.usedSpotter = true;
    if (set.eccentric) existing.usedEccentric = true;
    byMovement.set(set.movementId, existing);
  }

  const result = Array.from(byMovement.entries()).map(([movementId, data]) => {
    const movement = movementMap.get(movementId);
    const volumeLbs = volumeMap.get(movementId) ?? 0;
    return {
      movementId,
      name: movement?.name ?? "Unknown",
      muscleGroups: movement?.muscleGroups ?? [],
      sets: data.sets,
      totalReps: data.totalReps,
      volumeLbs,
      avgWeightPerRep:
        data.totalReps > 0 && volumeLbs > 0 ? Math.round(volumeLbs / data.totalReps) : null,
      usedSpotter: data.usedSpotter,
      usedEccentric: data.usedEccentric,
    };
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { activityId, totalMovements: result.length, movements: result },
          null,
          2,
        ),
      },
    ],
  };
}

async function getProgressMetrics(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const limit = (args.limit as number | undefined) ?? 50;
  const activities = await toolCtx.ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
    userId: toolCtx.userId,
    limit,
  });

  const result = aggregateProgressMetrics(activities);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

async function getStrengthScoreHistory(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const limit = (args.limit as number | undefined) ?? 20;
  const history = await toolCtx.ctx.runAction(internal.tonal.proxy.fetchStrengthHistory, {
    userId: toolCtx.userId,
  });

  const sliced = history.slice(0, limit);
  return {
    content: [{ type: "text", text: JSON.stringify(sliced, null, 2) }],
  };
}

async function getTrainingFrequency(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const days = (args.days as number | undefined) ?? 30;
  const activities = await toolCtx.ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
    userId: toolCtx.userId,
    limit: 100,
  });

  const result = aggregateTrainingFrequency(activities, days);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

// --- Definitions and exports ---

export const analyticsToolDefinitions: ToolDefinition[] = [
  {
    name: "list_workout_history",
    description: "List recent workout activities with date, title, volume, and duration",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of recent workouts to return (default 20, max 100)",
          default: 20,
          maximum: 100,
        },
      },
    },
  },
  {
    name: "get_workout_detail",
    description: "Get full detail for a specific workout activity including sets and reps",
    inputSchema: {
      type: "object",
      properties: {
        activityId: {
          type: "string",
          description: "Activity UUID from workout history",
        },
      },
      required: ["activityId"],
    },
  },
  {
    name: "get_workout_movements",
    description:
      "Get movement breakdown for a workout — sets, reps, and volume per exercise with names",
    inputSchema: {
      type: "object",
      properties: {
        activityId: {
          type: "string",
          description: "Activity UUID from workout history",
        },
      },
      required: ["activityId"],
    },
  },
  {
    name: "get_progress_metrics",
    description:
      "Get aggregated progress metrics: total/avg volume, duration, workouts by target area",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of recent workouts to aggregate (default 50)",
          default: 50,
        },
      },
    },
  },
  {
    name: "get_strength_score_history",
    description: "Get strength score history over time — upper, lower, core, overall per workout",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of history entries to return (default 20)",
          default: 20,
        },
      },
    },
  },
  {
    name: "get_training_frequency",
    description: "Get training frequency breakdown by target area over a time period",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days to look back (default 30)",
          default: 30,
        },
      },
    },
  },
];

export const analyticsToolHandlers: Record<string, ToolHandler> = {
  list_workout_history: (tc, args) => listWorkoutHistory(tc, args),
  get_workout_detail: (tc, args) => getWorkoutDetail(tc, args),
  get_workout_movements: (tc, args) => getWorkoutMovements(tc, args),
  get_progress_metrics: (tc, args) => getProgressMetrics(tc, args),
  get_strength_score_history: (tc, args) => getStrengthScoreHistory(tc, args),
  get_training_frequency: (tc, args) => getTrainingFrequency(tc, args),
};
