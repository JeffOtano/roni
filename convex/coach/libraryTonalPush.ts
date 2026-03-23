import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

export const clearTonalFields = internalMutation({
  args: {},
  handler: async (ctx) => {
    const workouts = await ctx.db.query("libraryWorkouts").take(100);
    let cleared = 0;
    for (const w of workouts) {
      if (w.tonalWorkoutId || w.tonalDeepLinkUrl) {
        await ctx.db.patch(w._id, {
          tonalWorkoutId: undefined,
          tonalDeepLinkUrl: undefined,
        });
        cleared++;
      }
    }
    return { cleared, hasMore: workouts.length === 100 };
  },
});

export const pushToTonalBatch = internalAction({
  args: { serviceAccountUserId: v.id("users") },
  handler: async (
    ctx,
    { serviceAccountUserId },
  ): Promise<{ pushed: number; failed: number; remaining: number }> => {
    const unpushed: Array<{
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
    }> = await ctx.runQuery(internal.coach.libraryGenerationActions.getUnpushedWorkouts);

    if (unpushed.length === 0) return { pushed: 0, failed: 0, remaining: 0 };

    let pushed = 0;
    let failed = 0;

    for (const workout of unpushed) {
      try {
        let workoutId = workout.tonalWorkoutId;

        if (!workoutId) {
          const result: { id: string } = await ctx.runAction(
            internal.tonal.mutations.doTonalCreateWorkout,
            {
              userId: serviceAccountUserId,
              title: workout.title,
              blocks: workout.blocks,
            },
          );
          workoutId = result.id;
        }

        let deepLinkUrl: string | undefined;
        try {
          const shareResult: { deepLinkUrl: string } = await ctx.runAction(
            internal.tonal.mutations.shareWorkout,
            { userId: serviceAccountUserId, workoutId },
          );
          deepLinkUrl = shareResult.deepLinkUrl;
        } catch (shareErr) {
          console.error(`Failed to share ${workout.slug}:`, shareErr);
        }

        await ctx.runMutation(internal.coach.libraryGenerationActions.setTonalWorkoutId, {
          slug: workout.slug,
          tonalWorkoutId: workoutId,
          tonalDeepLinkUrl: deepLinkUrl,
        });
        pushed++;

        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (e) {
        console.error(`Failed to push ${workout.slug}:`, e);
        failed++;
        if (failed >= 3) break;
      }
    }

    return { pushed, failed, remaining: unpushed.length - pushed - failed };
  },
});
