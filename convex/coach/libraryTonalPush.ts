import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

type WorkoutToPush = {
  slug: string;
  title: string;
  blocks: Array<{
    exercises: Array<{
      movementId: string;
      sets: number;
      reps?: number;
      duration?: number;
      warmUp?: boolean;
      spotter?: boolean;
      eccentric?: boolean;
      chains?: boolean;
      burnout?: boolean;
      dropSet?: boolean;
    }>;
  }>;
  tonalWorkoutId?: string;
};

export const pushToTonalBatch = internalAction({
  args: {
    serviceAccountUserId: v.id("users"),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (
    ctx,
    { serviceAccountUserId, cursor },
  ): Promise<{
    pushed: number;
    failed: number;
    nextCursor: string;
    isDone: boolean;
  }> => {
    const result: {
      unpushed: WorkoutToPush[];
      isDone: boolean;
      continueCursor: string;
    } = await ctx.runQuery(internal.coach.libraryGenerationActions.getUnpushedWorkouts, {
      paginationOpts: { numItems: 10, cursor },
    });

    let pushed = 0;
    let failed = 0;

    const total = result.unpushed.length;
    console.log(`[push] Starting batch: ${total} workouts to process, isDone=${result.isDone}`);

    for (const workout of result.unpushed) {
      try {
        let workoutId = workout.tonalWorkoutId;
        let deepLinkUrl: string | undefined;

        // Try to share existing workout first
        if (workoutId) {
          console.log(`[push] ${pushed + 1}/${total} Sharing existing: ${workout.slug}`);
          try {
            const shareResult: { deepLinkUrl: string } = await ctx.runAction(
              internal.tonal.mutations.shareWorkout,
              { userId: serviceAccountUserId, workoutId },
            );
            deepLinkUrl = shareResult.deepLinkUrl;
          } catch {
            console.log(`[push] ${pushed + 1}/${total} Share failed (stale ID), recreating...`);
            workoutId = undefined; // Fall through to create
          }
        }

        // Create fresh if no ID or share failed (stale ID)
        if (!workoutId) {
          console.log(`[push] ${pushed + 1}/${total} Creating: ${workout.slug}`);
          const createResult: { id: string } = await ctx.runAction(
            internal.tonal.mutations.doTonalCreateWorkout,
            {
              userId: serviceAccountUserId,
              title: workout.title,
              blocks: workout.blocks,
            },
          );
          workoutId = createResult.id;
          console.log(`[push] ${pushed + 1}/${total} Created: ${workout.slug} -> ${workoutId}`);
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Share the newly created workout
          console.log(`[push] ${pushed + 1}/${total} Sharing new: ${workout.slug}`);
          try {
            const shareResult: { deepLinkUrl: string } = await ctx.runAction(
              internal.tonal.mutations.shareWorkout,
              { userId: serviceAccountUserId, workoutId },
            );
            deepLinkUrl = shareResult.deepLinkUrl;
          } catch (shareErr) {
            console.error(`[push] FAILED to share ${workout.slug}:`, shareErr);
          }
        }

        await ctx.runMutation(internal.coach.libraryGenerationActions.setTonalWorkoutId, {
          slug: workout.slug,
          tonalWorkoutId: workoutId,
          tonalDeepLinkUrl: deepLinkUrl,
        });
        pushed++;

        const status = deepLinkUrl ? "OK" : "NO LINK";
        console.log(`[push] ${pushed}/${total} Done: ${workout.slug} [${status}]`);

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        console.error(`Failed to push ${workout.slug}:`, e);
        failed++;
        if (failed >= 3) break;
      }
    }

    return {
      pushed,
      failed,
      nextCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
