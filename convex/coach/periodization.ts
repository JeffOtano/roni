/**
 * Periodization engine: mesocycle management, deload detection, and volume tracking.
 *
 * Default pattern: 3 weeks building → 1 week deload → repeat.
 * Deload triggers: scheduled (every 4th week), RPE-based (avg RPE >= 8.5 over 3 sessions),
 * or coach-initiated.
 *
 * During deload weeks, volume and intensity are reduced:
 * - Sets reduced by ~30% (3 sets → 2 sets)
 * - Weight targets held flat (no progressive overload)
 * - RPE target: 5-6 (should feel easy)
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default mesocycle length: 3 building + 1 deload = 4 weeks. */
export const DEFAULT_BUILDING_WEEKS = 3;
export const DEFAULT_DELOAD_WEEKS = 1;
export const MESOCYCLE_LENGTH = DEFAULT_BUILDING_WEEKS + DEFAULT_DELOAD_WEEKS;

/** If average RPE over last 3 sessions exceeds this, suggest early deload. */
export const RPE_DELOAD_THRESHOLD = 8.5;

/** Deload modifiers. */
export const DELOAD_SET_MULTIPLIER = 0.67; // 3 sets → 2 sets
export const DELOAD_REPS = 8; // lighter reps during deload

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get the user's current active training block. */
export const getActiveBlock = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const blocks = await ctx.db
      .query("trainingBlocks")
      .withIndex("by_userId_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .collect();
    return blocks[0] ?? null;
  },
});

/** Check if user needs a deload based on RPE and schedule. */
export const shouldDeload = internalQuery({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    shouldDeload: boolean;
    reason: "scheduled" | "rpe" | "none";
    activeBlock: Doc<"trainingBlocks"> | null;
  }> => {
    const blocks = await ctx.db
      .query("trainingBlocks")
      .withIndex("by_userId_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .collect();
    const activeBlock = blocks[0] ?? null;

    // If already in deload, no need
    if (activeBlock?.blockType === "deload") {
      return { shouldDeload: false, reason: "none", activeBlock };
    }

    // Scheduled: building block at week 3+ → time for deload
    if (activeBlock?.blockType === "building" && activeBlock.weekNumber >= DEFAULT_BUILDING_WEEKS) {
      return { shouldDeload: true, reason: "scheduled", activeBlock };
    }

    // RPE-based: average RPE over last 3 sessions >= threshold
    const RPE_SESSION_COUNT = 3;
    const feedback = await ctx.db
      .query("workoutFeedback")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(RPE_SESSION_COUNT);

    if (feedback.length >= RPE_SESSION_COUNT) {
      const average = feedback.reduce((acc, f) => acc + f.rpe, 0) / feedback.length;
      if (average >= RPE_DELOAD_THRESHOLD) {
        return { shouldDeload: true, reason: "rpe", activeBlock };
      }
    }

    return { shouldDeload: false, reason: "none", activeBlock };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Start a new training block (building or deload). */
export const startBlock = internalMutation({
  args: {
    userId: v.id("users"),
    blockType: v.union(v.literal("building"), v.literal("deload"), v.literal("testing")),
    totalWeeks: v.number(),
    startDate: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Complete any existing active block
    const existing = await ctx.db
      .query("trainingBlocks")
      .withIndex("by_userId_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .collect();
    for (const block of existing) {
      await ctx.db.patch(block._id, {
        status: "completed",
        endDate: new Date().toISOString().slice(0, 10),
      });
    }

    const label =
      args.label ??
      (args.blockType === "deload" ? "Deload Week" : `Building Phase (${args.totalWeeks} weeks)`);

    return ctx.db.insert("trainingBlocks", {
      userId: args.userId,
      label,
      blockType: args.blockType,
      weekNumber: 1,
      totalWeeks: args.totalWeeks,
      startDate: args.startDate,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

/** Advance the current block to the next week. Auto-transitions building → deload. */
export const advanceWeek = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const blocks = await ctx.db
      .query("trainingBlocks")
      .withIndex("by_userId_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .collect();
    const active = blocks[0];
    if (!active) return { transitioned: false, newBlock: null };

    if (active.weekNumber >= active.totalWeeks) {
      // Block complete
      await ctx.db.patch(active._id, {
        status: "completed",
        endDate: new Date().toISOString().slice(0, 10),
      });

      // Auto-transition: building → deload, deload → building
      if (active.blockType === "building") {
        const deloadId = await ctx.db.insert("trainingBlocks", {
          userId: args.userId,
          label: "Deload Week",
          blockType: "deload",
          weekNumber: 1,
          totalWeeks: DEFAULT_DELOAD_WEEKS,
          startDate: new Date().toISOString().slice(0, 10),
          status: "active",
          createdAt: Date.now(),
        });
        return { transitioned: true, newBlock: await ctx.db.get(deloadId) };
      }
      if (active.blockType === "deload") {
        const buildingId = await ctx.db.insert("trainingBlocks", {
          userId: args.userId,
          label: `Building Phase (${DEFAULT_BUILDING_WEEKS} weeks)`,
          blockType: "building",
          weekNumber: 1,
          totalWeeks: DEFAULT_BUILDING_WEEKS,
          startDate: new Date().toISOString().slice(0, 10),
          status: "active",
          createdAt: Date.now(),
        });
        return { transitioned: true, newBlock: await ctx.db.get(buildingId) };
      }
      return { transitioned: true, newBlock: null };
    }

    // Just increment the week
    await ctx.db.patch(active._id, { weekNumber: active.weekNumber + 1 });
    return { transitioned: false, newBlock: null };
  },
});

// ---------------------------------------------------------------------------
// Volume tracking (pure computation, no table needed)
// ---------------------------------------------------------------------------

export interface MuscleVolumeEntry {
  muscleGroup: string;
  weeklySets: number;
  /** Evidence-based hypertrophy range from Schoenfeld et al. */
  recommendedMin: number;
  recommendedMax: number;
  status: "under" | "optimal" | "over";
}

/** Recommended weekly sets per muscle group for hypertrophy. */
const VOLUME_LANDMARKS: Record<string, { min: number; max: number }> = {
  Chest: { min: 10, max: 20 },
  Back: { min: 10, max: 20 },
  Shoulders: { min: 8, max: 16 },
  Biceps: { min: 8, max: 14 },
  Triceps: { min: 8, max: 14 },
  Quads: { min: 10, max: 20 },
  Glutes: { min: 8, max: 16 },
  Hamstrings: { min: 8, max: 16 },
  Calves: { min: 8, max: 16 },
};

/**
 * Compute weekly volume per muscle group from a week's workout plans.
 * Pure function — caller provides the blocks and movement catalog.
 */
export function computeWeeklyVolume(
  weekBlocks: { exercises: { movementId: string; sets: number }[] }[][],
  catalog: { id: string; muscleGroups: string[] }[],
): MuscleVolumeEntry[] {
  const catalogMap = new Map(catalog.map((m) => [m.id, m.muscleGroups]));
  const setsPerGroup = new Map<string, number>();

  for (const blocks of weekBlocks) {
    for (const block of blocks) {
      for (const ex of block.exercises) {
        const groups = catalogMap.get(ex.movementId) ?? [];
        for (const g of groups) {
          setsPerGroup.set(g, (setsPerGroup.get(g) ?? 0) + ex.sets);
        }
      }
    }
  }

  return Object.entries(VOLUME_LANDMARKS).map(([group, { min, max }]) => {
    const sets = setsPerGroup.get(group) ?? 0;
    let status: "under" | "optimal" | "over" = "optimal";
    if (sets < min) status = "under";
    else if (sets > max) status = "over";
    return {
      muscleGroup: group,
      weeklySets: sets,
      recommendedMin: min,
      recommendedMax: max,
      status,
    };
  });
}
