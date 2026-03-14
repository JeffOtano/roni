import type { ToolContext, ToolDefinition, ToolHandler } from "../registry";
import { internal } from "../../_generated/api";
import type { BlockInput } from "../../tonal/transforms";

async function createCustomWorkout(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const title = args.title as string;
  const blocks = args.blocks as BlockInput[];

  const result = await toolCtx.ctx.runAction(internal.tonal.mutations.doTonalCreateWorkout, {
    userId: toolCtx.userId,
    title,
    blocks,
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { id: result.id, title, message: `Workout "${title}" created!` },
          null,
          2,
        ),
      },
    ],
  };
}

async function estimateWorkout(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const blocks = args.blocks as BlockInput[];

  const result = await toolCtx.ctx.runAction(internal.tonal.mutations.estimateWorkout, {
    userId: toolCtx.userId,
    blocks,
  });

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

async function listCustomWorkouts(
  toolCtx: ToolContext,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const workouts = await toolCtx.ctx.runAction(internal.tonal.proxy.fetchCustomWorkouts, {
    userId: toolCtx.userId,
  });

  return {
    content: [{ type: "text", text: JSON.stringify(workouts, null, 2) }],
  };
}

async function deleteCustomWorkout(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const workoutId = args.workoutId as string;

  await toolCtx.ctx.runAction(internal.tonal.mutations.deleteWorkout, {
    userId: toolCtx.userId,
    workoutId,
  });

  return {
    content: [{ type: "text", text: `Workout ${workoutId} deleted successfully.` }],
  };
}

const EXERCISE_SCHEMA_DESCRIPTION =
  "Each exercise: { movementId (UUID), sets (1-10, default 3), reps (number), duration (seconds, for timed), spotter (bool), eccentric (bool), warmUp (bool) }";

export const workoutToolDefinitions: ToolDefinition[] = [
  {
    name: "create_custom_workout",
    description: `Create a custom workout on Tonal. Specify exercises grouped into blocks.
Each block contains 1+ exercises. Multiple exercises in a block = superset.
${EXERCISE_SCHEMA_DESCRIPTION}`,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Workout title" },
        blocks: {
          type: "array",
          description:
            "Array of exercise blocks. Each block = { exercises: [{ movementId, sets?, reps?, duration?, spotter?, eccentric?, warmUp? }] }",
        },
      },
      required: ["title", "blocks"],
    },
  },
  {
    name: "estimate_workout",
    description: `Estimate duration of a workout before creating it. Same block format as create_custom_workout.
${EXERCISE_SCHEMA_DESCRIPTION}`,
    inputSchema: {
      type: "object",
      properties: {
        blocks: {
          type: "array",
          description: "Array of exercise blocks to estimate",
        },
      },
      required: ["blocks"],
    },
  },
  {
    name: "list_custom_workouts",
    description: "List user's custom/saved workouts",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "delete_custom_workout",
    description: "Delete a custom workout by ID",
    inputSchema: {
      type: "object",
      properties: {
        workoutId: {
          type: "string",
          description: "Custom workout UUID to delete",
        },
      },
      required: ["workoutId"],
    },
  },
];

export const workoutToolHandlers: Record<string, ToolHandler> = {
  create_custom_workout: (tc, args) => createCustomWorkout(tc, args),
  estimate_workout: (tc, args) => estimateWorkout(tc, args),
  list_custom_workouts: (tc) => listCustomWorkouts(tc),
  delete_custom_workout: (tc, args) => deleteCustomWorkout(tc, args),
};
