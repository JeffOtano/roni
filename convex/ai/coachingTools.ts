/**
 * AI coach tools for the 7 new coaching features:
 * 1. Post-workout feedback (RPE/rating)
 * 2. Periodization / deload management
 * 3. Measurable goal tracking
 * 4. Dynamic injury management
 * 5. Warm-up guidance (prompt-only, no tool needed)
 * 6. Volume tracking per muscle group
 * 7. Exercise rotation (built into selection engine, no tool needed)
 */

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { requireUserId, withToolTracking } from "./helpers";
import { computeWeeklyVolume } from "../coach/periodization";

// ---------------------------------------------------------------------------
// 1. Post-workout feedback
// ---------------------------------------------------------------------------

export const recordFeedbackTool = createTool({
  description:
    "Record post-workout feedback from the user. Call this when the user rates a session or reports RPE. Always ask for feedback after discussing a completed workout.",
  inputSchema: z.object({
    activityId: z.string().describe("Tonal activity ID for the workout"),
    rpe: z
      .number()
      .min(1)
      .max(10)
      .describe("Rate of Perceived Exertion: 1 (very easy) to 10 (max effort)"),
    rating: z.number().min(1).max(5).describe("Session rating: 1 (terrible) to 5 (great)"),
    notes: z.string().optional().describe("Optional notes from the user"),
  }),
  execute: withToolTracking("record_feedback", async (ctx, input, _options) => {
    const userId = requireUserId(ctx);
    await ctx.runMutation(internal.workoutFeedback.submitInternal, {
      userId: userId as Id<"users">,
      activityId: input.activityId,
      rpe: input.rpe,
      rating: input.rating,
      notes: input.notes,
    });
    return { recorded: true, rpe: input.rpe, rating: input.rating };
  }),
});

export const getRecentFeedbackTool = createTool({
  description:
    "Get recent workout feedback (RPE and ratings) to understand training load and adjust intensity.",
  inputSchema: z.object({
    limit: z.number().optional().default(5).describe("Number of recent entries"),
  }),
  execute: withToolTracking("get_recent_feedback", async (ctx, input, _options) => {
    const userId = requireUserId(ctx);
    const feedback = (await ctx.runQuery(internal.workoutFeedback.getRecentInternal, {
      userId: userId as Id<"users">,
      limit: input.limit,
    })) as Doc<"workoutFeedback">[];
    return feedback.map((f) => ({
      activityId: f.activityId,
      rpe: f.rpe,
      rating: f.rating,
      notes: f.notes,
      date: new Date(f.createdAt).toISOString().slice(0, 10),
    }));
  }),
});

// ---------------------------------------------------------------------------
// 2. Periodization / deload
// ---------------------------------------------------------------------------

export const checkDeloadTool = createTool({
  description:
    "Check if the user should take a deload week based on their training block schedule and recent RPE. Call this before programming a new week.",
  inputSchema: z.object({}),
  execute: withToolTracking("check_deload", async (ctx, _input, _options) => {
    const userId = requireUserId(ctx);
    const result = (await ctx.runQuery(internal.coach.periodization.shouldDeload, {
      userId: userId as Id<"users">,
    })) as {
      shouldDeload: boolean;
      reason: string;
      activeBlock: Doc<"trainingBlocks"> | null;
    };
    return {
      shouldDeload: result.shouldDeload,
      reason: result.reason,
      currentBlock: result.activeBlock
        ? {
            type: result.activeBlock.blockType,
            week: result.activeBlock.weekNumber,
            totalWeeks: result.activeBlock.totalWeeks,
            label: result.activeBlock.label,
          }
        : null,
    };
  }),
});

export const startTrainingBlockTool = createTool({
  description:
    "Start a new training block (mesocycle). Use 'building' for normal training, 'deload' for recovery weeks. The system auto-transitions: 3 weeks building → 1 week deload.",
  inputSchema: z.object({
    blockType: z.enum(["building", "deload", "testing"]),
    totalWeeks: z.number().min(1).max(8).describe("How many weeks for this block"),
    label: z.string().optional().describe("Custom label like 'Hypertrophy Phase'"),
  }),
  execute: withToolTracking(
    "start_training_block",
    async (
      ctx,
      input,
      _options,
    ): Promise<{ started: boolean; blockType: string; totalWeeks: number }> => {
      const userId = requireUserId(ctx);
      const startDate = new Date().toISOString().slice(0, 10);
      await ctx.runMutation(internal.coach.periodization.startBlock, {
        userId: userId as Id<"users">,
        blockType: input.blockType,
        totalWeeks: input.totalWeeks,
        startDate,
        label: input.label,
      });
      return { started: true, blockType: input.blockType, totalWeeks: input.totalWeeks };
    },
  ),
});

export const advanceTrainingBlockTool = createTool({
  description:
    "Advance the current training block to the next week. Call this after programming a new week. Auto-transitions building → deload and deload → building.",
  inputSchema: z.object({}),
  execute: withToolTracking("advance_training_block", async (ctx, _input, _options) => {
    const userId = requireUserId(ctx);
    const result = (await ctx.runMutation(internal.coach.periodization.advanceWeek, {
      userId: userId as Id<"users">,
    })) as { transitioned: boolean; newBlock: Doc<"trainingBlocks"> | null };
    return {
      advanced: true,
      transitioned: result.transitioned,
      newBlock: result.newBlock
        ? { type: result.newBlock.blockType, label: result.newBlock.label }
        : null,
    };
  }),
});

// ---------------------------------------------------------------------------
// 3. Goal tracking
// ---------------------------------------------------------------------------

export const setGoalTool = createTool({
  description:
    "Create a measurable training goal with a deadline. E.g., 'Increase bench press avg weight from 65 to 85 lbs by June 1'.",
  inputSchema: z.object({
    title: z.string().describe("Goal description"),
    category: z.enum(["strength", "volume", "consistency", "body_composition"]),
    metric: z.string().describe("What's being measured, e.g. 'bench_press_avg_weight'"),
    baselineValue: z.number().describe("Starting value"),
    targetValue: z.number().describe("Target value"),
    deadline: z.string().describe("ISO date string deadline, e.g. 2026-06-01"),
  }),
  execute: withToolTracking(
    "set_goal",
    async (ctx, input, _options): Promise<{ created: boolean; progress: string }> => {
      const userId = requireUserId(ctx);
      await ctx.runMutation(internal.goals.createInternal, {
        userId: userId as Id<"users">,
        ...input,
      });
      return { created: true, progress: "0%" };
    },
  ),
});

export const updateGoalProgressTool = createTool({
  description:
    "Update a goal's current value after analyzing workout data. Call this when you notice progress toward a user's goal.",
  inputSchema: z.object({
    goalId: z.string().describe("Goal ID"),
    currentValue: z.number().describe("Updated current value"),
  }),
  execute: withToolTracking("update_goal_progress", async (ctx, input, _options) => {
    const userId = requireUserId(ctx);
    const result = (await ctx.runMutation(internal.goals.updateProgressInternal, {
      goalId: input.goalId as Id<"goals">,
      userId: userId as Id<"users">,
      currentValue: input.currentValue,
    })) as { reached: boolean };
    return { updated: true, reached: result.reached, currentValue: input.currentValue };
  }),
});

export const getGoalsTool = createTool({
  description: "Get the user's active training goals with progress.",
  inputSchema: z.object({}),
  execute: withToolTracking("get_goals", async (ctx, _input, _options) => {
    const userId = requireUserId(ctx);
    const goals = (await ctx.runQuery(internal.goals.getActiveInternal, {
      userId: userId as Id<"users">,
    })) as Doc<"goals">[];
    return goals.map((g) => {
      const range = Math.abs(g.targetValue - g.baselineValue);
      const progress =
        range === 0 ? 100 : (Math.abs(g.currentValue - g.baselineValue) / range) * 100;
      return {
        goalId: g._id,
        title: g.title,
        category: g.category,
        baseline: g.baselineValue,
        current: g.currentValue,
        target: g.targetValue,
        progress: `${Math.min(100, Math.round(progress))}%`,
        deadline: g.deadline,
      };
    });
  }),
});

// ---------------------------------------------------------------------------
// 4. Injury management
// ---------------------------------------------------------------------------

export const reportInjuryTool = createTool({
  description:
    "Record a new injury or limitation. This automatically affects future exercise selection — exercises matching the avoidance keywords will be excluded.",
  inputSchema: z.object({
    area: z.string().describe("Body area: 'left shoulder', 'lower back', 'right knee', etc."),
    severity: z.enum(["mild", "moderate", "severe"]),
    avoidance: z
      .string()
      .describe(
        "What to avoid in exercise names, comma-separated. E.g. 'overhead, press' or 'deadlift, squat'",
      ),
    notes: z.string().optional(),
  }),
  execute: withToolTracking(
    "report_injury",
    async (
      ctx,
      input,
      _options,
    ): Promise<{ recorded: boolean; area: string; severity: string }> => {
      const userId = requireUserId(ctx);
      await ctx.runMutation(internal.injuries.reportInternal, {
        userId: userId as Id<"users">,
        area: input.area,
        severity: input.severity,
        avoidance: input.avoidance,
        notes: input.notes,
      });
      return { recorded: true, area: input.area, severity: input.severity };
    },
  ),
});

export const resolveInjuryTool = createTool({
  description: "Mark an injury as resolved. The exercise restrictions will be lifted.",
  inputSchema: z.object({
    injuryId: z.string().describe("Injury ID to resolve"),
  }),
  execute: withToolTracking("resolve_injury", async (ctx, input, _options) => {
    const userId = requireUserId(ctx);
    await ctx.runMutation(internal.injuries.resolveInternal, {
      injuryId: input.injuryId as Id<"injuries">,
      userId: userId as Id<"users">,
    });
    return { resolved: true };
  }),
});

export const getInjuriesTool = createTool({
  description: "Get the user's active injuries and limitations.",
  inputSchema: z.object({}),
  execute: withToolTracking("get_injuries", async (ctx, _input, _options) => {
    const userId = requireUserId(ctx);
    const injuries = (await ctx.runQuery(internal.injuries.getActiveInternal, {
      userId: userId as Id<"users">,
    })) as Doc<"injuries">[];
    return injuries.map((i) => ({
      injuryId: i._id,
      area: i.area,
      severity: i.severity,
      avoidance: i.avoidance,
      notes: i.notes,
      reportedAt: new Date(i.reportedAt).toISOString().slice(0, 10),
    }));
  }),
});

// ---------------------------------------------------------------------------
// 6. Volume tracking
// ---------------------------------------------------------------------------

export const getWeeklyVolumeTool = createTool({
  description:
    "Analyze weekly training volume per muscle group. Shows sets per muscle group vs evidence-based recommendations (10-20 sets/week for most groups). Use this to identify under-trained or over-trained muscles.",
  inputSchema: z.object({}),
  execute: withToolTracking("get_weekly_volume", async (ctx, _input, _options) => {
    const userId = requireUserId(ctx);
    const typedUserId = userId as Id<"users">;

    // Get current week's workout plans
    const weekStartDate = getWeekStartDate();
    const weekPlan = (await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
      userId: typedUserId,
      weekStartDate,
    })) as Doc<"weekPlans"> | null;

    if (!weekPlan) return { message: "No week plan found for current week.", volume: [] };

    // Get workout plan blocks for each day
    const planIds = weekPlan.days
      .map((d) => d.workoutPlanId)
      .filter((id): id is Id<"workoutPlans"> => id !== undefined);

    const plans = (await Promise.all(
      [...new Set(planIds)].map((id) =>
        ctx.runQuery(internal.workoutPlans.getById, { planId: id, userId: typedUserId }),
      ),
    )) as (Doc<"workoutPlans"> | null)[];

    const weekBlocks = plans
      .filter((p): p is Doc<"workoutPlans"> => p !== null)
      .map((p) => p.blocks);

    // Get catalog for muscle group mapping
    const catalog = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);

    const volume = computeWeeklyVolume(weekBlocks, catalog);
    return {
      weekStartDate,
      volume: volume.map((v) => ({
        muscleGroup: v.muscleGroup,
        weeklySets: v.weeklySets,
        recommended: `${v.recommendedMin}-${v.recommendedMax}`,
        status: v.status,
      })),
    };
  }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}
