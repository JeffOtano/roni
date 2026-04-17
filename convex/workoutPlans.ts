import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { blockInputValidator } from "./validators";
import * as analytics from "./lib/posthog";
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { workflow } from "./workflows";

type RetryPushResult = { success: true; started: true } | { success: false; error: string };

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
      .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "pushed"))
      .collect();
    return plans
      .filter(
        (p) =>
          p.tonalWorkoutId !== undefined && (p.source === "tonal_coach" || p.source === undefined),
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
    const plan = await ctx.db
      .query("workoutPlans")
      .withIndex("by_tonalWorkoutId", (q) => q.eq("tonalWorkoutId", tonalWorkoutId))
      .unique();
    if (!plan || plan.userId !== userId) return null;
    return plan;
  },
});

/** Recent movement IDs from pushed/completed plans (for exercise selection no-repeat). */
export const getRecentMovementIds = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const [pushed, completed] = await Promise.all([
      ctx.db
        .query("workoutPlans")
        .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "pushed"))
        .collect(),
      ctx.db
        .query("workoutPlans")
        .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "completed"))
        .collect(),
    ]);
    const recentPlans = [...pushed, ...completed].sort((a, b) => a._creationTime - b._creationTime);
    const allMovementIds = recentPlans.flatMap((p) =>
      p.blocks.flatMap((b) => b.exercises.map((ex) => ex.movementId)),
    );
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

// Assumes the caller has already claimed the plan (status: pushing) — the
// retryPush action does that synchronously so a double-click can't start
// two workflows.
export const retryPushWorkflow = workflow.define({
  args: {
    planId: v.id("workoutPlans"),
    userId: v.id("users"),
    title: v.string(),
    blocks: blockInputValidator,
  },
  handler: async (step, args): Promise<{ workoutId: string }> => {
    const result = await step.runAction(internal.tonal.mutations.pushWorkoutToTonal, {
      userId: args.userId,
      title: args.title,
      blocks: args.blocks,
    });

    await step.runMutation(internal.workoutPlans.updatePushOutcome, {
      planId: args.planId,
      status: "pushed",
      tonalWorkoutId: result.id,
      pushedAt: Date.now(),
    });

    await step.runMutation(internal.tonal.cache.setCacheEntry, {
      userId: args.userId,
      dataType: "customWorkouts",
      data: null,
      fetchedAt: 0,
      expiresAt: 0,
    });

    return { workoutId: result.id };
  },
});

/** onComplete handler: success analytics, failure status + Discord notification. */
export const onRetryPushComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ planId: v.id("workoutPlans"), userId: v.id("users") }),
  },
  handler: async (ctx, { result, context }) => {
    if (result.kind === "success") {
      analytics.capture(context.userId, "workout_pushed", { plan_id: context.planId });
      await analytics.flush();
      return;
    }
    const reason =
      result.kind === "canceled" ? "Push was canceled" : (result.error ?? "Unknown error");
    await ctx.db.patch(context.planId, {
      status: "failed" as const,
      pushErrorReason: reason,
    });
    analytics.capture(context.userId, "workout_push_failed", {
      plan_id: context.planId,
      error: reason,
    });
    await analytics.flush();
  },
});

/** Retry pushing a failed/draft plan to Tonal. Starts a durable workflow. */
export const retryPush = action({
  args: { planId: v.id("workoutPlans") },
  handler: async (ctx, { planId }): Promise<RetryPushResult> => {
    const plan = (await ctx.runQuery(api.workoutPlans.getPlanForCurrentUser, {
      planId,
    })) as Doc<"workoutPlans"> | null;
    if (!plan) return { success: false, error: "Plan not found or access denied" };
    const userId = plan.userId;

    // Atomic claim up front: a double-click loses the second claim here and
    // can't start a second workflow (which would otherwise overwrite the
    // first workflow's success via onRetryPushComplete's fail branch).
    const claimed = await ctx.runMutation(internal.workoutPlans.transitionToPushing, { planId });
    if (!claimed) {
      // Re-read since the failure means status changed between our initial
      // read and the claim — typically because a parallel retry just won.
      const current = await ctx.runQuery(internal.workoutPlans.getByIdInternal, { planId });
      const currentStatus = current?.status ?? plan.status;
      return {
        success: false,
        error:
          currentStatus === "pushing" || currentStatus === "pushed"
            ? "Push already in progress"
            : `Plan cannot be retried (status: ${currentStatus})`,
      };
    }

    try {
      await workflow.start(
        ctx,
        internal.workoutPlans.retryPushWorkflow,
        { planId, userId, title: plan.title, blocks: plan.blocks },
        {
          onComplete: internal.workoutPlans.onRetryPushComplete,
          context: { planId, userId },
        },
      );
    } catch (err) {
      // Release the claim so the plan isn't stuck in "pushing" forever.
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.workoutPlans.updatePushOutcome, {
        planId,
        status: "failed",
        pushErrorReason: `Failed to start retry workflow: ${message}`,
      });
      return { success: false, error: "Failed to start retry workflow" };
    }

    return { success: true, started: true };
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
