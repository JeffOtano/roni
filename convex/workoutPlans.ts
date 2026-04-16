import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";
import { api, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { blockInputValidator } from "./validators";
import * as analytics from "./lib/posthog";

type RetryPushResult = { success: true; workoutId: string } | { success: false; error: string };

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("pushing"),
  v.literal("pushed"),
  v.literal("completed"),
  v.literal("deleted"),
  v.literal("failed"),
);

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    tonalWorkoutId: v.optional(v.string()),
    source: v.optional(v.string()),
    title: v.string(),
    blocks: blockInputValidator,
    status: statusValidator,
    pushErrorReason: v.optional(v.string()),
    estimatedDuration: v.optional(v.number()),
    createdAt: v.number(),
    pushedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("workoutPlans", args);
  },
});

/** Pushed AI-programmed workout IDs for a user (for activation matching). */
export const getPushedAiWorkoutIds = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const plans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return plans
      .filter(
        (p) =>
          p.status === "pushed" &&
          p.tonalWorkoutId !== undefined &&
          (p.source === "tonal_coach" || p.source === undefined),
      )
      .map((p) => p.tonalWorkoutId as string);
  },
});

/** Find workout plan by user and Tonal workout ID (for week day completion sync). */
export const getByUserIdAndTonalWorkoutId = internalQuery({
  args: {
    userId: v.id("users"),
    tonalWorkoutId: v.string(),
  },
  handler: async (ctx, { userId, tonalWorkoutId }) => {
    const plans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return plans.find((p) => p.tonalWorkoutId === tonalWorkoutId) ?? null;
  },
});

/** Recent movement IDs from pushed/completed plans (for exercise selection no-repeat). */
export const getRecentMovementIds = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const plans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const allMovementIds = plans
      .filter((p) => p.status === "pushed" || p.status === "completed")
      .flatMap((p) => p.blocks.flatMap((b) => b.exercises.map((ex) => ex.movementId)));

    return [...new Set(allMovementIds)].slice(-50);
  },
});

export const updatePushOutcome = internalMutation({
  args: {
    planId: v.id("workoutPlans"),
    status: v.union(v.literal("pushed"), v.literal("failed")),
    tonalWorkoutId: v.optional(v.string()),
    pushErrorReason: v.optional(v.string()),
    pushedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { planId, status, tonalWorkoutId, pushErrorReason, pushedAt } = args;
    await ctx.db.patch(planId, {
      status,
      ...(tonalWorkoutId !== undefined && { tonalWorkoutId }),
      ...(pushedAt !== undefined && { pushedAt }),
      pushErrorReason: status === "pushed" ? undefined : pushErrorReason,
    });
  },
});

export const transitionToPushing = internalMutation({
  args: { planId: v.id("workoutPlans") },
  handler: async (ctx, { planId }): Promise<boolean> => {
    const plan = await ctx.db.get(planId);
    if (!plan || (plan.status !== "draft" && plan.status !== "failed")) return false;
    await ctx.db.patch(planId, { status: "pushing" as const });
    return true;
  },
});

export const getPlanForCurrentUser = query({
  args: { planId: v.id("workoutPlans") },
  handler: async (ctx, { planId }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;
    const plan = await ctx.db.get(planId);
    if (!plan || plan.userId !== userId) return null;
    return plan;
  },
});

export const getById = internalQuery({
  args: {
    planId: v.id("workoutPlans"),
    userId: v.id("users"),
  },
  handler: async (ctx, { planId, userId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan || plan.userId !== userId) return null;
    return plan;
  },
});

/** Get a plan by ID without ownership check (internal use only). */
export const getByIdInternal = internalQuery({
  args: { planId: v.id("workoutPlans") },
  handler: async (ctx, { planId }) => {
    return ctx.db.get(planId);
  },
});

/** Atomically claim a recovered Tonal workout if no other plan already owns it. */
export const claimRecoveredWorkout = internalMutation({
  args: {
    planId: v.id("workoutPlans"),
    userId: v.id("users"),
    tonalWorkoutId: v.string(),
    pushedAt: v.number(),
  },
  handler: async (ctx, { planId, userId, tonalWorkoutId, pushedAt }) => {
    const plan = await ctx.db.get(planId);
    if (!plan || plan.userId !== userId) {
      return { error: "Plan not found or not owned by user" } as const;
    }

    const plans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    if (plans.some((p) => p._id !== planId && p.tonalWorkoutId === tonalWorkoutId)) {
      return { error: "Workout already claimed" } as const;
    }

    await ctx.db.patch(planId, {
      status: "pushed" as const,
      tonalWorkoutId,
      pushedAt,
      pushErrorReason: undefined,
    });
    return { ok: true } as const;
  },
});

/** Retry pushing a failed/draft plan to Tonal. TOCTOU-safe via transitionToPushing. */
export const retryPush = action({
  args: { planId: v.id("workoutPlans") },
  handler: async (ctx, { planId }): Promise<RetryPushResult> => {
    const plan = (await ctx.runQuery(api.workoutPlans.getPlanForCurrentUser, {
      planId,
    })) as Doc<"workoutPlans"> | null;
    if (!plan) return { success: false, error: "Plan not found or access denied" };
    const userId = plan.userId;
    if (plan.status !== "failed" && plan.status !== "draft")
      return {
        success: false,
        error:
          plan.status === "pushing"
            ? "Push already in progress"
            : `Plan cannot be retried (status: ${plan.status})`,
      };
    const claimed = await ctx.runMutation(internal.workoutPlans.transitionToPushing, { planId });
    if (!claimed)
      return {
        success: false,
        error: "Plan cannot be retried or another push is in progress",
      };
    try {
      const result = await ctx.runAction(internal.tonal.mutations.doTonalCreateWorkout, {
        userId,
        title: plan.title,
        blocks: plan.blocks,
      });
      const id = result.id;
      const now = Date.now();
      await ctx.runMutation(internal.workoutPlans.updatePushOutcome, {
        planId,
        status: "pushed",
        tonalWorkoutId: id,
        pushedAt: now,
      });
      await ctx.runMutation(internal.tonal.cache.setCacheEntry, {
        userId,
        dataType: "customWorkouts",
        data: null,
        fetchedAt: 0,
        expiresAt: 0,
      });
      analytics.capture(userId, "workout_pushed", { plan_id: planId });
      await analytics.flush();
      return { success: true, workoutId: id };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.workoutPlans.updatePushOutcome, {
        planId,
        status: "failed",
        pushErrorReason: message,
      });
      analytics.capture(userId, "workout_push_failed", { plan_id: planId, error: message });
      await analytics.flush();
      return { success: false, error: message };
    }
  },
});

const STUCK_PUSH_CUTOFF_MS = 5 * 60 * 1000;
const STUCK_PUSH_BATCH_SIZE = 50;

/** Plan IDs stuck in "pushing" longer than cutoff (for cron recovery). */
export const getStuckPushingPlanIds = internalQuery({
  args: {
    cutoffTs: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cutoffTs, limit = STUCK_PUSH_BATCH_SIZE }) => {
    const plans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_status", (q) => q.eq("status", "pushing"))
      .collect();
    return plans
      .filter((p) => p.createdAt < cutoffTs)
      .map((p) => p._id)
      .slice(0, limit);
  },
});

/** Try to find and claim a matching workout on Tonal for a stuck plan. */
async function tryRecoverPlan(
  ctx: ActionCtx,
  planId: Id<"workoutPlans">,
  plan: Doc<"workoutPlans">,
): Promise<boolean> {
  try {
    const customWorkouts = await ctx.runAction(internal.tonal.proxy.fetchCustomWorkouts, {
      userId: plan.userId,
    });
    const planCreatedIso = new Date(plan.createdAt).toISOString();
    const candidates = customWorkouts.filter(
      (w: { id: string; title: string; createdAt: string }) =>
        w.title === plan.title && w.createdAt >= planCreatedIso,
    );

    if (candidates.length > 1) {
      await ctx.runMutation(internal.workoutPlans.updatePushOutcome, {
        planId,
        status: "failed",
        pushErrorReason: `Ambiguous: ${candidates.length} Tonal matches for "${plan.title}"`,
      });
      console.warn(
        `[stuckPushRecovery] ${candidates.length} ambiguous Tonal matches for plan ${planId} - marking failed`,
      );
      return true;
    }

    if (candidates.length === 1) {
      const result = await ctx.runMutation(internal.workoutPlans.claimRecoveredWorkout, {
        planId,
        userId: plan.userId,
        tonalWorkoutId: candidates[0].id,
        pushedAt: Date.now(),
      });
      if ("ok" in result) {
        analytics.capture(plan.userId, "workout_push_recovered", { plan_id: planId });
        console.log(
          `[stuckPushRecovery] Recovered plan ${planId} - found matching workout ${candidates[0].id} on Tonal`,
        );
        return true;
      }
      await ctx.runMutation(internal.workoutPlans.updatePushOutcome, {
        planId,
        status: "failed",
        pushErrorReason: result.error,
      });
      console.warn(
        `[stuckPushRecovery] Could not claim workout ${candidates[0].id} for plan ${planId}: ${result.error}`,
      );
      return true; // Handled with specific reason, not generic timeout.
    }

    return false;
  } catch (err) {
    console.warn(`[stuckPushRecovery] Could not check Tonal for plan ${planId}:`, err);
    return false;
  }
}

/** Cron: mark stuck "pushing" plans as failed, recovering any that made it to Tonal. */
export const runStuckPushRecovery = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const cutoffTs = Date.now() - STUCK_PUSH_CUTOFF_MS;
      const ids = await ctx.runQuery(internal.workoutPlans.getStuckPushingPlanIds, {
        cutoffTs,
        limit: STUCK_PUSH_BATCH_SIZE,
      });
      for (const planId of ids) {
        const plan = await ctx.runQuery(internal.workoutPlans.getByIdInternal, { planId });
        if (!plan) {
          console.warn(`[stuckPushRecovery] Plan ${planId} no longer exists, skipping`);
          continue;
        }

        const recovered = await tryRecoverPlan(ctx, planId, plan);
        if (!recovered) {
          await ctx.runMutation(internal.workoutPlans.updatePushOutcome, {
            planId,
            status: "failed",
            pushErrorReason: "Push timed out",
          });
        }
      }
      await analytics.flush();
    } catch (error) {
      console.error("[stuckPushRecovery] Recovery failed:", error);
      void ctx.runAction(internal.discord.notifyError, {
        source: "stuckPushRecovery",
        message: `Stuck push recovery failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  },
});

export const markDeleted = internalMutation({
  args: { tonalWorkoutId: v.string() },
  handler: async (ctx, { tonalWorkoutId }) => {
    const plan = await ctx.db
      .query("workoutPlans")
      .withIndex("by_tonalWorkoutId", (q) => q.eq("tonalWorkoutId", tonalWorkoutId))
      .unique();

    if (plan) {
      await ctx.db.patch(plan._id, { status: "deleted" as const });
    }
  },
});

export const getByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("workoutPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});
