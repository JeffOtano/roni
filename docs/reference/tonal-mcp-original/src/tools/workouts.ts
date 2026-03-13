import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tonal } from "../api-client.js";
import { getMovementNames } from "./exercises.js";
import type {
  UserWorkout,
  CreateWorkoutInput,
  WorkoutEstimate,
  WorkoutSetInput,
} from "../types.js";

// High-level exercise input — Claude specifies what matters, we compute the rest
const exerciseSchema = z.object({
  movementId: z.string().uuid().describe("Movement/exercise UUID from search_movements"),
  sets: z.number().int().min(1).max(10).default(3).describe("Number of sets (default 3)"),
  reps: z
    .number()
    .int()
    .optional()
    .describe("Reps per set (for rep-based exercises). Omit for timed exercises."),
  duration: z
    .number()
    .int()
    .optional()
    .describe("Duration per set in seconds (for timed exercises like planks). Omit for rep-based."),
  spotter: z.boolean().default(false).describe("Enable digital spotter (helps with last reps)"),
  eccentric: z.boolean().default(false).describe("Enable eccentric mode (slow negatives)"),
  warmUp: z.boolean().default(false).describe("Mark as warm-up exercise"),
});

const blockSchema = z.object({
  exercises: z
    .array(exerciseSchema)
    .min(1)
    .max(6)
    .describe(
      "Exercises in this block. Multiple exercises = superset (performed back-to-back). Most blocks have 1-2 exercises.",
    ),
});

/**
 * Convert high-level blocks → flat Tonal set array.
 *
 * Block model:
 * - Each block has 1+ exercises (multiple = superset)
 * - Each exercise has N sets
 * - Sets rotate: round 1 does set 1 of each exercise, round 2 does set 2, etc.
 * - blockStart=true only on the very first set of a block
 * - setGroup identifies which exercise in the block (1-indexed)
 * - round identifies which round (1-indexed)
 * - repetition/repetitionTotal track per-exercise set count
 */
function buildSetArray(
  blocks: Array<{
    exercises: Array<{
      movementId: string;
      sets: number;
      reps?: number;
      duration?: number;
      spotter: boolean;
      eccentric: boolean;
      warmUp: boolean;
    }>;
  }>,
): WorkoutSetInput[] {
  const sets: WorkoutSetInput[] = [];

  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];
    const blockNumber = blockIdx + 1;
    const maxRounds = Math.max(...block.exercises.map((e) => e.sets));
    let isFirstInBlock = true;

    for (let round = 1; round <= maxRounds; round++) {
      for (let exIdx = 0; exIdx < block.exercises.length; exIdx++) {
        const ex = block.exercises[exIdx];
        // Skip if this exercise has fewer sets than the current round
        if (round > ex.sets) continue;

        const set: WorkoutSetInput = {
          blockStart: isFirstInBlock,
          movementId: ex.movementId,
          blockNumber,
          setGroup: exIdx + 1,
          round,
          repetition: round,
          repetitionTotal: ex.sets,
          burnout: false,
          spotter: ex.spotter,
          eccentric: ex.eccentric,
          chains: false,
          flex: false,
          warmUp: ex.warmUp,
          dropSet: false,
          weightPercentage: 100,
          description: "",
        };

        if (ex.duration) {
          set.prescribedDuration = ex.duration;
          set.prescribedResistanceLevel = 5;
        } else {
          set.prescribedReps = ex.reps ?? 10;
        }

        sets.push(set);
        isFirstInBlock = false;
      }
    }
  }

  return sets;
}

export function registerWorkoutTools(server: McpServer) {
  server.tool(
    "create_custom_workout",
    `Create a custom workout on Tonal. Specify exercises grouped into blocks.
Each block contains 1+ exercises. Multiple exercises in a block = superset (done back-to-back).
The server auto-computes all Tonal-specific fields (blockStart, rounds, setGroups, etc).

Example: 3-block workout
- Block 1: Bench Press 4x10 superset with Chest Fly 3x12
- Block 2: Overhead Press 3x8 (solo)
- Block 3: Tricep Pushdown 3x15 superset with Lateral Raise 3x12`,
    {
      title: z.string().describe("Workout title"),
      blocks: z
        .array(blockSchema)
        .min(1)
        .max(10)
        .describe("Array of exercise blocks (each block = 1+ exercises)"),
    },
    async ({ title, blocks }) => {
      const sets = buildSetArray(blocks);
      const input: CreateWorkoutInput = {
        title,
        sets,
        createdSource: "WorkoutBuilder",
      };
      const [workout, names] = await Promise.all([
        tonal.post<UserWorkout>("/v6/user-workouts", input),
        getMovementNames(),
      ]);

      // Summarize what was created
      const blockSummaries = blocks.map((b, i) => ({
        block: i + 1,
        exercises: b.exercises.map((e) => ({
          name: names.get(e.movementId) ?? e.movementId,
          sets: e.sets,
          reps: e.reps ?? null,
          duration: e.duration ?? null,
          spotter: e.spotter,
          eccentric: e.eccentric,
        })),
        isSuperset: b.exercises.length > 1,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: workout.id,
                title: workout.title,
                durationMinutes: Math.round(workout.duration / 60),
                totalSets: sets.length,
                blocks: blockSummaries,
                bodyRegions: workout.bodyRegions,
                message: `Workout "${workout.title}" created! ${Math.round(workout.duration / 60)} min, ${sets.length} total sets across ${blocks.length} blocks.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "estimate_workout",
    `Estimate duration of a workout before creating it. Uses the same block format as create_custom_workout.`,
    {
      blocks: z.array(blockSchema).min(1).max(10).describe("Array of exercise blocks to estimate"),
    },
    async ({ blocks }) => {
      const sets = buildSetArray(blocks);
      const estimate = await tonal.post<WorkoutEstimate>("/v6/user-workouts/estimate", sets);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                durationSeconds: estimate.duration,
                durationMinutes: Math.round(estimate.duration / 60),
                totalSets: sets.length,
                blocks: blocks.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool("list_custom_workouts", "List user's custom/saved workouts", {}, async () => {
    const [workouts, names] = await Promise.all([
      tonal.get<UserWorkout[]>("/v6/user-workouts"),
      getMovementNames(),
    ]);
    const summaries = workouts.map((w) => ({
      id: w.id,
      title: w.title,
      duration: w.duration,
      durationMinutes: Math.round(w.duration / 60),
      targetArea: w.targetArea,
      bodyRegions: w.bodyRegions,
      exercises: w.movementIds?.map((id) => names.get(id) ?? id) ?? [],
      createdAt: w.createdAt,
    }));
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(summaries, null, 2),
        },
      ],
    };
  });

  server.tool(
    "delete_custom_workout",
    "Delete a custom workout by ID",
    {
      workoutId: z.string().uuid().describe("Custom workout UUID to delete"),
    },
    async ({ workoutId }) => {
      await tonal.delete(`/v6/user-workouts/${workoutId}`);
      return {
        content: [
          {
            type: "text" as const,
            text: `Workout ${workoutId} deleted successfully.`,
          },
        ],
      };
    },
  );
}
