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
      paginationOpts: { numItems: 50, cursor },
    });

    let pushed = 0;
    let failed = 0;

    for (const workout of result.unpushed) {
      try {
        let workoutId = workout.tonalWorkoutId;

        if (!workoutId) {
          const createResult: { id: string } = await ctx.runAction(
            internal.tonal.mutations.doTonalCreateWorkout,
            {
              userId: serviceAccountUserId,
              title: workout.title,
              blocks: workout.blocks,
            },
          );
          workoutId = createResult.id;
          // Wait for Tonal to process the new workout
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        let deepLinkUrl: string | undefined;
        try {
          const shareResult: { deepLinkUrl: string } = await ctx.runAction(
            internal.tonal.mutations.shareWorkout,
            { userId: serviceAccountUserId, workoutId },
          );
          deepLinkUrl = shareResult.deepLinkUrl;
        } catch {
          // Retry once with delay
          await new Promise((resolve) => setTimeout(resolve, 3000));
          try {
            const retry: { deepLinkUrl: string } = await ctx.runAction(
              internal.tonal.mutations.shareWorkout,
              { userId: serviceAccountUserId, workoutId },
            );
            deepLinkUrl = retry.deepLinkUrl;
          } catch (retryErr) {
            console.error(`Failed to share ${workout.slug}:`, retryErr);
          }
        }

        await ctx.runMutation(internal.coach.libraryGenerationActions.setTonalWorkoutId, {
          slug: workout.slug,
          tonalWorkoutId: workoutId,
          tonalDeepLinkUrl: deepLinkUrl,
        });
        pushed++;

        await new Promise((resolve) => setTimeout(resolve, 1500));
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
