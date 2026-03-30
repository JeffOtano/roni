/**
 * Progressive overload: per-exercise history from Tonal, "last time" and "suggested next" display.
 * No AI — deterministic from workout-activities (and optional formatted summary for weight).
 * See docs/progressive-overload-data.md for data source and set-level notes.
 */

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type {
  FormattedWorkoutSummary,
  Movement,
  SetActivity,
  WorkoutActivityDetail,
} from "./tonal/types";
import { generatePerformanceSummary } from "./coach/prDetection";

const WEIGHT_STEP_LBS = 2.5;
const PLATEAU_THRESHOLD_LBS = 2;
const PLATEAU_OPTIONS = "Options: add a set, increase weight, or switch exercise.";

/** One session of a movement: sets, reps, optional avg weight (lbs). */
export interface MovementSessionSnapshot {
  sessionDate: string;
  sets: number;
  totalReps: number;
  repsPerSet: number;
  avgWeightLbs?: number;
}

/** Reps to prescribe when suggesting a weight increase (Tonal blocks have no weight field). */
const DEFAULT_REPS_WHEN_ADDING_WEIGHT = 8;

/** Last-time display + suggested next + optional plateau. */
export interface LastTimeAndSuggested {
  movementId: string;
  lastTimeText: string;
  suggestedText: string;
  plateauOptions?: string;
  /** For week programming: reps to prescribe (8 when adding weight, last+1 when adding rep). */
  suggestedReps?: number;
  lastWeightLbs?: number;
  targetWeightLbs?: number;
}

/** Aggregate workoutSetActivity by movementId into per-movement session snapshot. */
export function aggregateDetailToSessions(
  detail: WorkoutActivityDetail,
  volumeByMovement?: Map<string, number>,
): Map<string, MovementSessionSnapshot> {
  const sessionDate = detail.beginTime.slice(0, 10);
  const byMovement = new Map<string, SetActivity[]>();
  for (const set of detail.workoutSetActivity ?? []) {
    const list = byMovement.get(set.movementId) ?? [];
    list.push(set);
    byMovement.set(set.movementId, list);
  }
  const out = new Map<string, MovementSessionSnapshot>();
  for (const [movementId, sets] of byMovement) {
    const totalReps = sets.reduce((sum, s) => sum + (s.repetition ?? 0), 0);
    const count = sets.length;
    const repsPerSet = count > 0 ? Math.round(totalReps / count) : 0;
    const totalVolume = volumeByMovement?.get(movementId);
    const avgWeightLbs =
      totalVolume != null && totalReps > 0 ? Math.round(totalVolume / totalReps) : undefined;
    out.set(movementId, {
      sessionDate,
      sets: count,
      totalReps,
      repsPerSet,
      avgWeightLbs,
    });
  }
  return out;
}

/** Extract per-movement totalVolume from FormattedWorkoutSummary. */
function volumeByMovementFromSummary(summary: FormattedWorkoutSummary): Map<string, number> {
  const out = new Map<string, number>();
  for (const ms of summary.movementSets ?? []) {
    out.set(ms.movementId, ms.totalVolume);
  }
  return out;
}

/** Format "last time" for display. */
function formatLastTime(sets: number, repsPerSet: number, avgWeightLbs?: number): string {
  const base = `${sets}×${repsPerSet}`;
  if (avgWeightLbs != null && avgWeightLbs > 0) return `${base} @ ${avgWeightLbs} avg`;
  return base;
}

/** Suggested next: +2.5 lbs or +1 rep; range for display "72–75 lbs". */
function suggestedText(lastWeightLbs: number): string {
  if (lastWeightLbs > 0) {
    const target = lastWeightLbs + WEIGHT_STEP_LBS;
    return `${Math.round(target - 1)}–${Math.round(target + 2)} lbs`;
  }
  return "+2.5 lbs";
}

function suggestedTextNoWeight(repsPerSet: number): string {
  return repsPerSet > 0 ? "same weight, +1 rep" : "add 1 set";
}

/** Plateau: same weight within threshold for 3+ sessions. */
function detectPlateau(sessions: readonly MovementSessionSnapshot[]): boolean {
  const withWeight = sessions.filter((s) => s.avgWeightLbs != null && s.avgWeightLbs > 0);
  if (withWeight.length < 3) return false;
  const recent = withWeight.slice(0, 3);
  const avg = recent.reduce((s, x) => s + (x.avgWeightLbs ?? 0), 0) / recent.length;
  return recent.every((s) => Math.abs((s.avgWeightLbs ?? 0) - avg) <= PLATEAU_THRESHOLD_LBS);
}

/** Serializable result of per-movement history (Convex cannot return Map). */
export type PerMovementHistoryEntry = {
  movementId: string;
  sessions: MovementSessionSnapshot[];
};

// ---------------------------------------------------------------------------
// Internal: build per-movement session history from Tonal
// ---------------------------------------------------------------------------

export const getPerMovementHistory = internalAction({
  args: {
    userId: v.id("users"),
    maxActivities: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<PerMovementHistoryEntry[]> => {
    const { userId } = args;
    const maxActivities = args.maxActivities ?? 20;
    const activities = await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
      userId,
      limit: maxActivities,
    });

    const perMovement = new Map<string, MovementSessionSnapshot[]>();

    for (const activity of activities) {
      const activityId = activity.activityId;
      let detail: WorkoutActivityDetail | null;
      try {
        detail = (await ctx.runAction(internal.tonal.proxy.fetchWorkoutDetail, {
          userId,
          activityId,
        })) as WorkoutActivityDetail | null;
      } catch (error) {
        console.error(
          `[progressiveOverload] Failed to fetch detail for activity ${activityId}`,
          error,
        );
        continue;
      }
      if (!detail) continue;

      let volumeByMovement: Map<string, number> | undefined;
      try {
        const summary = await ctx.runAction(internal.tonal.proxy.fetchFormattedSummary, {
          userId,
          summaryId: activityId,
        });
        volumeByMovement = volumeByMovementFromSummary(summary);
      } catch {
        // Formatted summary may use different ID; we still have sets/reps
      }

      const sessionMap = aggregateDetailToSessions(detail, volumeByMovement);
      for (const [movementId, snapshot] of sessionMap) {
        const list = perMovement.get(movementId) ?? [];
        list.push(snapshot);
        perMovement.set(movementId, list);
      }
    }

    return [...perMovement.entries()].map(([movementId, sessions]) => ({
      movementId,
      sessions,
    }));
  },
});

// ---------------------------------------------------------------------------
// Internal: full performance summary (PRs, plateaus, regressions)
// ---------------------------------------------------------------------------

export const getWorkoutPerformanceSummary = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // 1. Get per-movement history
    const historyEntries = await ctx.runAction(internal.progressiveOverload.getPerMovementHistory, {
      userId,
      maxActivities: 20,
    });

    // 2. Get movement names from movements table
    const movements: Movement[] = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);
    const nameMap = new Map(movements.map((m) => [m.id, m.name]));

    // 3. Generate summary
    const summary = generatePerformanceSummary(historyEntries, nameMap);
    return summary;
  },
});

// ---------------------------------------------------------------------------
// Public: get "last time" and "suggested next" for display
// ---------------------------------------------------------------------------

export const getLastTimeAndSuggested = action({
  args: {
    movementIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { movementIds }): Promise<LastTimeAndSuggested[]> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const historyEntries: PerMovementHistoryEntry[] = await ctx.runAction(
      internal.progressiveOverload.getPerMovementHistory,
      { userId, maxActivities: 20 },
    );
    const perMovement = new Map<string, MovementSessionSnapshot[]>(
      historyEntries.map((e: PerMovementHistoryEntry) => [e.movementId, e.sessions]),
    );

    const ids = movementIds?.length
      ? movementIds.filter((id) => perMovement.has(id))
      : [...perMovement.keys()];

    const out: LastTimeAndSuggested[] = [];
    for (const movementId of ids) {
      const sessions = perMovement.get(movementId) ?? [];
      if (sessions.length === 0) continue;
      const last = sessions[0];
      const lastTimeText = formatLastTime(last.sets, last.repsPerSet, last.avgWeightLbs);
      const suggestedTextVal =
        last.avgWeightLbs != null && last.avgWeightLbs > 0
          ? suggestedText(last.avgWeightLbs)
          : suggestedTextNoWeight(last.repsPerSet);
      const plateauOptions = detectPlateau(sessions) ? PLATEAU_OPTIONS : undefined;
      const suggestedReps = computeSuggestedReps(last, suggestedTextVal);
      out.push({
        movementId,
        lastTimeText,
        suggestedText: suggestedTextVal,
        plateauOptions,
        suggestedReps,
        lastWeightLbs: last.avgWeightLbs,
        targetWeightLbs:
          last.avgWeightLbs != null && last.avgWeightLbs > 0
            ? Math.round(last.avgWeightLbs + WEIGHT_STEP_LBS)
            : undefined,
      });
    }
    return out;
  },
});

/** Derive reps for programming: 8 when adding weight, last+1 when adding rep, else 10. */
function computeSuggestedReps(last: MovementSessionSnapshot, suggestedTextVal: string): number {
  if (last.avgWeightLbs != null && last.avgWeightLbs > 0) {
    return DEFAULT_REPS_WHEN_ADDING_WEIGHT;
  }
  if (suggestedTextVal.includes("+1 rep") && last.repsPerSet > 0) {
    return last.repsPerSet + 1;
  }
  if (suggestedTextVal.includes("add 1 set") && last.repsPerSet > 0) {
    return last.repsPerSet;
  }
  return 10;
}

// ---------------------------------------------------------------------------
// Internal: last time + suggested for week programming (no auth; takes userId)
// ---------------------------------------------------------------------------

export const getLastTimeAndSuggestedInternal = internalAction({
  args: {
    userId: v.id("users"),
    movementIds: v.array(v.string()),
  },
  handler: async (ctx, { userId, movementIds }): Promise<LastTimeAndSuggested[]> => {
    const historyEntries = await ctx.runAction(internal.progressiveOverload.getPerMovementHistory, {
      userId,
      maxActivities: 20,
    });
    const perMovement = new Map<string, MovementSessionSnapshot[]>(
      historyEntries.map((e: PerMovementHistoryEntry) => [e.movementId, e.sessions]),
    );

    const out: LastTimeAndSuggested[] = [];
    for (const movementId of movementIds) {
      const sessions = perMovement.get(movementId) ?? [];
      if (sessions.length === 0) continue;
      const last = sessions[0];
      const lastTimeText = formatLastTime(last.sets, last.repsPerSet, last.avgWeightLbs);
      const suggestedTextVal =
        last.avgWeightLbs != null && last.avgWeightLbs > 0
          ? suggestedText(last.avgWeightLbs)
          : suggestedTextNoWeight(last.repsPerSet);
      const plateauOptions = detectPlateau(sessions) ? PLATEAU_OPTIONS : undefined;
      const suggestedReps = computeSuggestedReps(last, suggestedTextVal);
      out.push({
        movementId,
        lastTimeText,
        suggestedText: suggestedTextVal,
        plateauOptions,
        suggestedReps,
        lastWeightLbs: last.avgWeightLbs,
        targetWeightLbs:
          last.avgWeightLbs != null && last.avgWeightLbs > 0
            ? Math.round(last.avgWeightLbs + WEIGHT_STEP_LBS)
            : undefined,
      });
    }
    return out;
  },
});
