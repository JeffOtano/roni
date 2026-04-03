/**
 * Enriched week plan: reads the local week plan then verifies workout statuses
 * against Tonal activity history. Tonal is the source of truth for completion;
 * the local `status` field is a cache/hint kept approximately correct.
 */

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getWeekStartDateString } from "./weekPlanHelpers";
import type { Activity } from "./tonal/types";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

type DerivedStatus = "rest" | "programmed" | "completed" | "failed";

export interface EnrichedDay {
  sessionType: string;
  /** Stored status (cache/hint -- may be stale). */
  status: string;
  /** Tonal-verified status -- use this for display. */
  derivedStatus: DerivedStatus;
  workoutPlanId?: string;
  estimatedDuration?: number;
  /** Tonal workout ID for linking to workout detail. */
  tonalWorkoutId?: string;
}

export interface EnrichedWeekPlan {
  _id: string;
  weekStartDate: string;
  preferredSplit: string;
  targetDays: number;
  days: EnrichedDay[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type StoredDay = Doc<"weekPlans">["days"][number];

function deriveRestDay(day: StoredDay): EnrichedDay {
  return {
    sessionType: day.sessionType,
    status: day.status,
    derivedStatus: "rest",
    workoutPlanId: day.workoutPlanId,
    estimatedDuration: day.estimatedDuration,
  };
}

function deriveDayStatus(
  day: StoredDay,
  workoutPlan: Doc<"workoutPlans"> | null,
  completedTonalIds: ReadonlySet<string>,
): EnrichedDay {
  // No workout plan record found -- treat as programmed (may have been deleted)
  if (!workoutPlan) {
    return {
      sessionType: day.sessionType,
      status: day.status,
      derivedStatus: "programmed",
      workoutPlanId: day.workoutPlanId,
      estimatedDuration: day.estimatedDuration,
    };
  }

  // Push to Tonal never succeeded
  if (workoutPlan.status === "failed") {
    return {
      sessionType: day.sessionType,
      status: day.status,
      derivedStatus: "failed",
      workoutPlanId: day.workoutPlanId,
      estimatedDuration: day.estimatedDuration,
      tonalWorkoutId: workoutPlan.tonalWorkoutId,
    };
  }

  // Check Tonal activity history for completion
  if (workoutPlan.tonalWorkoutId && completedTonalIds.has(workoutPlan.tonalWorkoutId)) {
    return {
      sessionType: day.sessionType,
      status: day.status,
      derivedStatus: "completed",
      workoutPlanId: day.workoutPlanId,
      estimatedDuration: day.estimatedDuration,
      tonalWorkoutId: workoutPlan.tonalWorkoutId,
    };
  }

  return {
    sessionType: day.sessionType,
    status: day.status,
    derivedStatus: "programmed",
    workoutPlanId: day.workoutPlanId,
    estimatedDuration: day.estimatedDuration,
    tonalWorkoutId: workoutPlan.tonalWorkoutId,
  };
}

/**
 * Map derived statuses back to the stored DAY_STATUSES union so we can cache
 * them in the weekPlan. "failed" maps to "programmed" since the schema doesn't
 * have a "failed" variant for day status.
 */
function toStoredStatus(
  derived: DerivedStatus,
): "programmed" | "completed" | "missed" | "rescheduled" {
  if (derived === "completed") return "completed";
  // "rest", "programmed", "failed" all map to "programmed" in the stored schema
  return "programmed";
}

/**
 * Wraps an activity fetcher so that Tonal API failures degrade gracefully.
 * Returns an empty array instead of propagating the error, allowing the
 * schedule page to render without completion-status updates when Tonal is down.
 */
export async function safeActivities(fetcher: () => Promise<Activity[]>): Promise<Activity[]> {
  try {
    return await fetcher();
  } catch (err) {
    console.error("Failed to fetch Tonal activity history; defaulting to empty list", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public action
// ---------------------------------------------------------------------------

export const getWeekPlanEnriched = action({
  args: {},
  handler: async (ctx): Promise<EnrichedWeekPlan | null> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    // 1. Get local week plan
    const weekStartDate = getWeekStartDateString(new Date());
    const plan = (await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
      userId,
      weekStartDate,
    })) as Doc<"weekPlans"> | null;
    if (!plan) return null;

    // 2. Collect unique workoutPlanIds referenced by this week's days
    const workoutPlanIds = plan.days
      .map((d) => d.workoutPlanId)
      .filter((id): id is Id<"workoutPlans"> => id !== undefined);

    const uniqueIds = [...new Set(workoutPlanIds)];

    // 3. Look up each workoutPlan to get tonalWorkoutId and push status
    const workoutPlans = new Map<string, Doc<"workoutPlans">>();
    // Fetch in parallel -- each is a lightweight DB get by ID
    const planResults = await Promise.all(
      uniqueIds.map((planId) => ctx.runQuery(internal.workoutPlans.getById, { planId, userId })),
    );
    for (let i = 0; i < uniqueIds.length; i++) {
      const wp = planResults[i] as Doc<"workoutPlans"> | null;
      if (wp) workoutPlans.set(uniqueIds[i], wp);
    }

    // 4. Fetch recent activities from Tonal to check completion.
    // Wrapped in safeActivities so a Tonal API failure degrades gracefully
    // (schedule still renders, just without live completion-status updates).
    const activities = await safeActivities(
      () =>
        ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
          userId,
          limit: 20,
        }) as Promise<Activity[]>,
    );

    // 5. Build a set of completed Tonal workout IDs from activity history
    const completedTonalIds = new Set<string>(activities.map((a) => a.workoutPreview.workoutId));

    // 6. Derive status for each day
    const enrichedDays: EnrichedDay[] = plan.days.map((day) => {
      if (day.sessionType === "rest") return deriveRestDay(day);
      if (!day.workoutPlanId) return deriveRestDay(day);

      const wp = workoutPlans.get(day.workoutPlanId) ?? null;
      return deriveDayStatus(day, wp, completedTonalIds);
    });

    // 7. Update local status cache if any statuses changed
    const statusUpdates: {
      dayIndex: number;
      status: "programmed" | "completed" | "missed" | "rescheduled";
    }[] = [];
    for (let i = 0; i < enrichedDays.length; i++) {
      const stored = toStoredStatus(enrichedDays[i].derivedStatus);
      if (stored !== plan.days[i].status) {
        statusUpdates.push({ dayIndex: i, status: stored });
      }
    }

    if (statusUpdates.length > 0) {
      await ctx.runMutation(internal.weekPlans.batchUpdateDayStatusesInternal, {
        weekPlanId: plan._id,
        updates: statusUpdates,
      });
    }

    return {
      _id: plan._id,
      weekStartDate: plan.weekStartDate,
      preferredSplit: plan.preferredSplit,
      targetDays: plan.targetDays,
      days: enrichedDays,
    };
  },
});
