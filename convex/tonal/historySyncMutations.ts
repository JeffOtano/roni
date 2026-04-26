/**
 * Persistence mutations for training history sync.
 *
 * Idempotent inserts into completedWorkouts, exercisePerformance, and
 * strengthScoreSnapshots. Each mutation skips duplicates by checking
 * the relevant index before inserting.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { isDeletionInProgress } from "../lib/auth";
import { afterInsert as afterPerformanceInsert } from "../personalRecords";
import { requestCoachStateRefresh } from "../coachState";
import {
  EXTERNAL_ACTIVITY_SOURCES,
  normalizeExternalActivitySource,
} from "./externalActivitySources";
import { DEFAULT_TARGET_AREA, DEFAULT_WORKOUT_TITLE } from "./workoutMeta";

// ---------------------------------------------------------------------------
// Shared validators (exported for action payload typing)
// ---------------------------------------------------------------------------

export const workoutValidator = v.object({
  activityId: v.string(),
  date: v.string(),
  title: v.string(),
  targetArea: v.string(),
  totalVolume: v.number(),
  totalDuration: v.number(),
  totalWork: v.number(),
  workoutType: v.string(),
  tonalWorkoutId: v.optional(v.string()),
});

type WorkoutPayload = typeof workoutValidator.type;

export const performanceValidator = v.object({
  activityId: v.string(),
  movementId: v.string(),
  date: v.string(),
  sets: v.number(),
  totalReps: v.number(),
  avgWeightLbs: v.optional(v.number()),
  totalVolume: v.optional(v.number()),
});

export const snapshotValidator = v.object({
  date: v.string(),
  overall: v.number(),
  upper: v.number(),
  lower: v.number(),
  core: v.number(),
  workoutActivityId: v.optional(v.string()),
});

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/** Return the set of activityIds that already exist in completedWorkouts. */
export const getExistingActivityIds = internalQuery({
  args: { userId: v.id("users"), activityIds: v.array(v.string()) },
  handler: async (ctx, { userId, activityIds }) => {
    const existing: string[] = [];
    for (const activityId of activityIds) {
      const doc = await ctx.db
        .query("completedWorkouts")
        .withIndex("by_userId_activityId", (q) =>
          q.eq("userId", userId).eq("activityId", activityId),
        )
        .first();
      if (doc) existing.push(activityId);
    }
    return existing;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function isUsefulTitle(title: string): boolean {
  return title.trim() !== "" && title !== DEFAULT_WORKOUT_TITLE;
}

function buildMetadataPatch(existing: Doc<"completedWorkouts">, next: WorkoutPayload) {
  const patch: {
    title?: string;
    targetArea?: string;
    workoutType?: string;
    tonalWorkoutId?: string;
  } = {};

  if (isUsefulTitle(next.title) && existing.title !== next.title) {
    patch.title = next.title;
  }
  if (next.targetArea.trim() !== "" && next.targetArea !== DEFAULT_TARGET_AREA) {
    if (existing.targetArea !== next.targetArea) patch.targetArea = next.targetArea;
  }
  if (next.workoutType.trim() !== "" && existing.workoutType !== next.workoutType) {
    patch.workoutType = next.workoutType;
  }
  if (next.tonalWorkoutId && existing.tonalWorkoutId !== next.tonalWorkoutId) {
    patch.tonalWorkoutId = next.tonalWorkoutId;
  }

  return patch;
}

/** Refresh display metadata for already-synced workouts without reprocessing sets. */
export const refreshCompletedWorkoutMetadata = internalMutation({
  args: { userId: v.id("users"), workouts: v.array(workoutValidator) },
  handler: async (ctx, { userId, workouts }) => {
    if (await isDeletionInProgress(ctx, userId)) return 0;
    let updated = 0;
    const now = Date.now();
    for (const w of workouts) {
      const existing = await ctx.db
        .query("completedWorkouts")
        .withIndex("by_userId_activityId", (q) =>
          q.eq("userId", userId).eq("activityId", w.activityId),
        )
        .first();
      if (!existing) continue;

      const patch = buildMetadataPatch(existing, w);
      if (Object.keys(patch).length === 0) continue;
      await ctx.db.patch(existing._id, { ...patch, syncedAt: now });
      updated++;
    }
    if (updated > 0) await requestCoachStateRefresh(ctx, userId);
    return updated;
  },
});

/** Insert new completed workouts (skips duplicates by activityId). */
export const persistCompletedWorkouts = internalMutation({
  args: { userId: v.id("users"), workouts: v.array(workoutValidator) },
  handler: async (ctx, { userId, workouts }) => {
    if (await isDeletionInProgress(ctx, userId)) return 0;
    let inserted = 0;
    for (const w of workouts) {
      const exists = await ctx.db
        .query("completedWorkouts")
        .withIndex("by_userId_activityId", (q) =>
          q.eq("userId", userId).eq("activityId", w.activityId),
        )
        .first();
      if (exists) continue;
      await ctx.db.insert("completedWorkouts", { userId, ...w, syncedAt: Date.now() });
      inserted++;
    }
    if (inserted > 0) await requestCoachStateRefresh(ctx, userId);
    return inserted;
  },
});

/** Insert per-exercise performance rows (skips duplicates by activityId + movementId). */
export const persistExercisePerformance = internalMutation({
  args: { userId: v.id("users"), performances: v.array(performanceValidator) },
  handler: async (ctx, { userId, performances }) => {
    if (await isDeletionInProgress(ctx, userId)) return;
    for (const p of performances) {
      const existing = await ctx.db
        .query("exercisePerformance")
        .withIndex("by_userId_activityId_movementId", (q) =>
          q.eq("userId", userId).eq("activityId", p.activityId).eq("movementId", p.movementId),
        )
        .first();
      if (existing) continue;
      const id = await ctx.db.insert("exercisePerformance", {
        userId,
        ...p,
        syncedAt: Date.now(),
      });
      const inserted = await ctx.db.get(id);
      if (inserted) await afterPerformanceInsert(ctx, inserted);
    }
  },
});

/** Insert strength score snapshots (skips duplicates by userId + date). */
export const persistStrengthSnapshots = internalMutation({
  args: { userId: v.id("users"), snapshots: v.array(snapshotValidator) },
  handler: async (ctx, { userId, snapshots }) => {
    if (await isDeletionInProgress(ctx, userId)) return;
    for (const s of snapshots) {
      const exists = await ctx.db
        .query("strengthScoreSnapshots")
        .withIndex("by_userId_date", (q) => q.eq("userId", userId).eq("date", s.date))
        .first();
      if (exists) continue;
      await ctx.db.insert("strengthScoreSnapshots", { userId, ...s, syncedAt: Date.now() });
    }
  },
});

// ---------------------------------------------------------------------------
// Validators for new tables
// ---------------------------------------------------------------------------

export const strengthScoreValidator = v.object({
  bodyRegion: v.string(),
  score: v.number(),
});

type StrengthScorePayload = typeof strengthScoreValidator.type;

export const muscleReadinessValidator = v.object({
  chest: v.number(),
  shoulders: v.number(),
  back: v.number(),
  triceps: v.number(),
  biceps: v.number(),
  abs: v.number(),
  obliques: v.number(),
  quads: v.number(),
  glutes: v.number(),
  hamstrings: v.number(),
  calves: v.number(),
});

type MuscleReadinessPayload = typeof muscleReadinessValidator.type;

export const externalActivityValidator = v.object({
  externalId: v.string(),
  workoutType: v.string(),
  beginTime: v.string(),
  totalDuration: v.number(),
  activeCalories: v.optional(v.number()),
  totalCalories: v.optional(v.number()),
  averageHeartRate: v.optional(v.number()),
  maxHeartRate: v.optional(v.number()),
  source: v.union(
    v.literal(EXTERNAL_ACTIVITY_SOURCES.APPLE_HEALTH),
    v.literal(EXTERNAL_ACTIVITY_SOURCES.GARMIN),
    v.literal(EXTERNAL_ACTIVITY_SOURCES.OTHER),
  ),
  distance: v.optional(v.number()),
  elevationGainMeters: v.optional(v.number()),
  avgPaceSecondsPerKm: v.optional(v.number()),
});

type ExternalActivityPayload = typeof externalActivityValidator.type;

function strengthScoresMatch(
  existing: readonly Doc<"currentStrengthScores">[],
  scores: readonly StrengthScorePayload[],
): boolean {
  if (existing.length !== scores.length) return false;
  const existingScores = new Map(existing.map((row) => [row.bodyRegion, row.score]));
  if (existingScores.size !== existing.length) return false;

  const nextRegions = new Set<string>();
  for (const score of scores) {
    if (nextRegions.has(score.bodyRegion)) return false;
    nextRegions.add(score.bodyRegion);
    if (existingScores.get(score.bodyRegion) !== score.score) return false;
  }
  return true;
}

function muscleReadinessMatches(
  existing: Doc<"muscleReadiness">,
  readiness: MuscleReadinessPayload,
): boolean {
  return (
    existing.chest === readiness.chest &&
    existing.shoulders === readiness.shoulders &&
    existing.back === readiness.back &&
    existing.triceps === readiness.triceps &&
    existing.biceps === readiness.biceps &&
    existing.abs === readiness.abs &&
    existing.obliques === readiness.obliques &&
    existing.quads === readiness.quads &&
    existing.glutes === readiness.glutes &&
    existing.hamstrings === readiness.hamstrings &&
    existing.calves === readiness.calves
  );
}

function externalActivityMatches(
  existing: Doc<"externalActivities">,
  activity: ExternalActivityPayload,
): boolean {
  return (
    existing.workoutType === activity.workoutType &&
    existing.beginTime === activity.beginTime &&
    existing.totalDuration === activity.totalDuration &&
    existing.activeCalories === activity.activeCalories &&
    existing.totalCalories === activity.totalCalories &&
    existing.averageHeartRate === activity.averageHeartRate &&
    existing.maxHeartRate === activity.maxHeartRate &&
    existing.source === activity.source &&
    existing.distance === activity.distance &&
    existing.elevationGainMeters === activity.elevationGainMeters &&
    existing.avgPaceSecondsPerKm === activity.avgPaceSecondsPerKm
  );
}

/** Replace all current strength scores for a user (delete old, insert fresh). */
export const persistCurrentStrengthScores = internalMutation({
  args: { userId: v.id("users"), scores: v.array(strengthScoreValidator) },
  handler: async (ctx, { userId, scores }) => {
    if (await isDeletionInProgress(ctx, userId)) return;
    const existing = await ctx.db
      .query("currentStrengthScores")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    if (strengthScoresMatch(existing, scores)) return;

    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    const now = Date.now();
    for (const s of scores) {
      await ctx.db.insert("currentStrengthScores", { userId, ...s, fetchedAt: now });
    }
    await requestCoachStateRefresh(ctx, userId);
  },
});

/** Replace the muscle readiness snapshot for a user (single row). */
export const persistMuscleReadiness = internalMutation({
  args: { userId: v.id("users"), readiness: muscleReadinessValidator },
  handler: async (ctx, { userId, readiness }) => {
    if (await isDeletionInProgress(ctx, userId)) return;
    const existing = await ctx.db
      .query("muscleReadiness")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      if (muscleReadinessMatches(existing, readiness)) return;
      await ctx.db.patch(existing._id, { ...readiness, fetchedAt: Date.now() });
    } else {
      await ctx.db.insert("muscleReadiness", { userId, ...readiness, fetchedAt: Date.now() });
    }
    await requestCoachStateRefresh(ctx, userId);
  },
});

/** Clear muscle readiness data for a user (when API returns null). */
export const clearMuscleReadiness = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (await isDeletionInProgress(ctx, userId)) return;
    const existing = await ctx.db
      .query("muscleReadiness")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      await requestCoachStateRefresh(ctx, userId);
    }
  },
});

/** Upsert external activities by externalId (insert new, update existing). */
export const persistExternalActivities = internalMutation({
  args: { userId: v.id("users"), activities: v.array(externalActivityValidator) },
  handler: async (ctx, { userId, activities }) => {
    if (await isDeletionInProgress(ctx, userId)) return;
    const now = Date.now();
    let changed = false;
    for (const a of activities) {
      const existingByCanonicalSource = await ctx.db
        .query("externalActivities")
        .withIndex("by_userId_source_externalId", (q) =>
          q.eq("userId", userId).eq("source", a.source).eq("externalId", a.externalId),
        )
        .first();
      const existing =
        existingByCanonicalSource ??
        (
          await ctx.db
            .query("externalActivities")
            .withIndex("by_userId_externalId", (q) =>
              q.eq("userId", userId).eq("externalId", a.externalId),
            )
            .take(10)
        ).find((row) => normalizeExternalActivitySource(row.source) === a.source);
      if (existing) {
        if (externalActivityMatches(existing, a)) continue;
        await ctx.db.replace(existing._id, { userId, ...a, syncedAt: now });
        changed = true;
      } else {
        await ctx.db.insert("externalActivities", { userId, ...a, syncedAt: now });
        changed = true;
      }
    }
    if (changed) await requestCoachStateRefresh(ctx, userId);
  },
});
