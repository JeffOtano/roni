import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { Activity } from "./tonal/types";
import * as analytics from "./lib/posthog";

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
const ELIGIBLE_USERS_PAGE_SIZE = 100;

/**
 * Activation metric: "first AI-programmed workout completed on Tonal."
 * See docs/activation-metric.md for signup vs activation definitions.
 */

/**
 * Activation rate within 72h for a signup cohort.
 * Cohort = userProfiles where tonalConnectedAt is in the last `days` days.
 * Activated = those with firstAiWorkoutCompletedAt set and (firstAiWorkoutCompletedAt - tonalConnectedAt) <= 72h.
 * See docs/activation-metric.md.
 */
export const getActivationRate72h = internalQuery({
  args: {
    /** Look at signups in the last N days. */
    days: v.number(),
  },
  handler: async (ctx, { days }) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const cohort = (await ctx.db
      .query("userProfiles")
      .withIndex("by_tonalConnectedAt", (q) => q.gte("tonalConnectedAt", cutoff))
      .collect()) as Array<Doc<"userProfiles"> & { tonalConnectedAt: number }>;
    const total = cohort.length;
    const activated = cohort.filter(
      (p) =>
        p.firstAiWorkoutCompletedAt !== undefined &&
        p.firstAiWorkoutCompletedAt - p.tonalConnectedAt <= SEVENTY_TWO_HOURS_MS,
    ).length;
    return {
      total,
      activated,
      rate: total > 0 ? activated / total : 0,
    };
  },
});

/**
 * One page of user IDs with Tonal connected but no first-completion timestamp yet.
 * No index supports "field is undefined", so we paginate the full table and
 * filter per page. Caller loops until `isDone`.
 */
export const getEligibleUserIdsPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db.query("userProfiles").paginate(paginationOpts);
    return {
      ...result,
      page: result.page
        .filter((p) => p.firstAiWorkoutCompletedAt === undefined)
        .map((p) => p.userId),
    };
  },
});

/**
 * Checks Tonal activities for completed AI-programmed workouts and records
 * first completion timestamp on userProfiles when not already set.
 */
export const checkActivation = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const pushedIds = await ctx.runQuery(internal.workoutPlans.getPushedAiWorkoutIds, { userId });
    if (pushedIds.length === 0) return;

    let activities: Activity[];
    try {
      activities = (await ctx.runAction(
        internal.tonal.mutations.fetchWorkoutHistoryForEligibility,
        { userId },
      )) as Activity[];
    } catch (error) {
      console.error("[activation] Failed to fetch workout history for eligibility", error);
      void ctx.runAction(internal.discord.notifyError, {
        source: "activation",
        message: `Eligibility check failed: ${error instanceof Error ? error.message : String(error)}`,
        userId,
      });
      return;
    }

    const ourIdsSet = new Set(pushedIds);
    const completed = activities.filter(
      (a: Activity) => a.workoutPreview?.workoutId && ourIdsSet.has(a.workoutPreview.workoutId),
    );
    if (completed.length === 0) return;

    const sorted = [...completed].sort(
      (a, b) => new Date(a.activityTime).getTime() - new Date(b.activityTime).getTime(),
    );
    const firstCompletedAt = new Date(sorted[0].activityTime).getTime();

    await ctx.runMutation(internal.userProfiles.setFirstAiWorkoutCompletedAt, {
      userId,
      completedAt: firstCompletedAt,
    });

    // Sync completed workouts to week plan day status (each completed Tonal workout → mark linked day(s) completed).
    const completedTonalIds = [
      ...new Set(completed.map((a: Activity) => a.workoutPreview.workoutId)),
    ];
    for (const tonalWorkoutId of completedTonalIds) {
      const plan = await ctx.runQuery(internal.workoutPlans.getByUserIdAndTonalWorkoutId, {
        userId,
        tonalWorkoutId,
      });
      if (!plan) continue;
      const daySlots = await ctx.runQuery(
        internal.weekPlans.getWeekPlanDaysWithWorkoutPlanInternal,
        { userId, workoutPlanId: plan._id },
      );
      for (const { weekPlanId, dayIndex } of daySlots) {
        await ctx.runMutation(internal.weekPlans.setDayStatusInternal, {
          weekPlanId,
          dayIndex,
          status: "completed",
        });
      }
    }
  },
});

/**
 * Runs activation check for all eligible users. Called by cron.
 * Processes in small batches with delay to avoid Tonal rate limits.
 */
const BATCH_SIZE = 5;
const DELAY_MS = 2000;

export const runActivationCheckForEligibleUsers = internalAction({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let totalChecked = 0;

    while (true) {
      const result: { page: Id<"users">[]; isDone: boolean; continueCursor: string } =
        await ctx.runQuery(internal.activation.getEligibleUserIdsPage, {
          paginationOpts: { cursor, numItems: ELIGIBLE_USERS_PAGE_SIZE },
        });

      for (let i = 0; i < result.page.length; i += BATCH_SIZE) {
        const batch = result.page.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (userId) => {
            try {
              await ctx.runAction(internal.activation.checkActivation, { userId });
            } catch (error) {
              console.error(`[activation] Check failed for user ${userId}:`, error);
              void ctx.runAction(internal.discord.notifyError, {
                source: "activationCheck",
                message: `Activation check failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
                userId,
              });
            }
          }),
        );
        if (i + BATCH_SIZE < result.page.length) {
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }
      }

      totalChecked += result.page.length;
      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    analytics.captureSystem("activation_check_completed", {
      users_checked: totalChecked,
    });
    await analytics.flush();
  },
});
