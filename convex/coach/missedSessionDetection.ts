/**
 * Missed session detection for weekly training plans.
 *
 * Pure functions — no Convex runtime dependencies. Compares the week plan
 * against completed Tonal activities to identify missed sessions, non-programmed
 * workouts, and calculate adherence metrics.
 *
 * @module convex/coach/missedSessionDetection
 */

import { DAY_NAMES } from "./weekProgrammingHelpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXTENDED_ABSENCE_THRESHOLD_DAYS = 7;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DaySlot {
  sessionType: "push" | "pull" | "legs" | "upper" | "lower" | "full_body" | "recovery" | "rest";
  status: "programmed" | "completed" | "missed" | "rescheduled";
  workoutPlanId?: string;
  estimatedDuration?: number;
}

export interface MissedSession {
  dayIndex: number;
  dayName: string;
  sessionType: string;
}

export interface NonProgrammedWorkout {
  dayIndex: number;
  dayName: string;
  /** What was programmed */
  programmedSessionType: string;
  /** What they actually did (from Tonal activity) */
  actualWorkoutTitle: string;
}

export interface MissedSessionSummary {
  missedSessions: MissedSession[];
  /** Days where user trained but did a different workout than programmed */
  nonProgrammedWorkouts: NonProgrammedWorkout[];
  /** Total training days that have passed this week */
  pastTrainingDays: number;
  /** Training days completed (either programmed or non-programmed) */
  completedDays: number;
  /** Days since last any workout (from activity dates), 0 if trained today */
  daysSinceLastWorkout: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTrainingDay(slot: DaySlot): boolean {
  return slot.sessionType !== "rest";
}

function formatSessionType(sessionType: string): string {
  return sessionType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function calculateDaysSinceLastWorkout(activityDates: readonly string[], todayStr: string): number {
  if (activityDates.length === 0) return -1;

  const today = new Date(todayStr);
  today.setUTCHours(0, 0, 0, 0);

  let mostRecentMs = -Infinity;
  for (const dateStr of activityDates) {
    const d = new Date(dateStr);
    d.setUTCHours(0, 0, 0, 0);
    if (d.getTime() > mostRecentMs) {
      mostRecentMs = d.getTime();
    }
  }

  const diffMs = today.getTime() - mostRecentMs;
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export function detectMissedSessions(args: {
  days: DaySlot[];
  todayDayIndex: number;
  completedTonalIds: ReadonlySet<string>;
  tonalWorkoutIdByPlanId: ReadonlyMap<string, string>;
  activityDates: string[];
  todayDate?: string;
  activityByTonalId?: ReadonlyMap<string, { title: string; date: string }>;
}): MissedSessionSummary {
  const {
    days,
    todayDayIndex,
    completedTonalIds,
    tonalWorkoutIdByPlanId,
    activityDates,
    todayDate,
    activityByTonalId,
  } = args;

  const missedSessions: MissedSession[] = [];
  const nonProgrammedWorkouts: NonProgrammedWorkout[] = [];
  let pastTrainingDays = 0;
  let completedDays = 0;

  // Phase: classify each past day
  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const slot = days[dayIndex];
    if (!isTrainingDay(slot)) continue;
    if (dayIndex >= todayDayIndex) continue;

    pastTrainingDays++;

    if (!slot.workoutPlanId) {
      missedSessions.push({
        dayIndex,
        dayName: DAY_NAMES[dayIndex],
        sessionType: formatSessionType(slot.sessionType),
      });
      continue;
    }

    const tonalWorkoutId = tonalWorkoutIdByPlanId.get(slot.workoutPlanId);
    const isCompleted = tonalWorkoutId != null && completedTonalIds.has(tonalWorkoutId);

    if (isCompleted) {
      completedDays++;
      continue;
    }

    // Check for non-programmed workout on this day
    if (activityByTonalId) {
      const nonProgrammed = findNonProgrammedWorkout(
        dayIndex,
        slot,
        tonalWorkoutId,
        completedTonalIds,
        activityByTonalId,
      );
      if (nonProgrammed) {
        nonProgrammedWorkouts.push(nonProgrammed);
        completedDays++;
        continue;
      }
    }

    missedSessions.push({
      dayIndex,
      dayName: DAY_NAMES[dayIndex],
      sessionType: formatSessionType(slot.sessionType),
    });
  }

  const daysSinceLastWorkout =
    todayDate != null ? calculateDaysSinceLastWorkout(activityDates, todayDate) : -1;

  return {
    missedSessions,
    nonProgrammedWorkouts,
    pastTrainingDays,
    completedDays,
    daysSinceLastWorkout,
  };
}

function findNonProgrammedWorkout(
  dayIndex: number,
  slot: DaySlot,
  programmedTonalId: string | undefined,
  completedTonalIds: ReadonlySet<string>,
  activityByTonalId: ReadonlyMap<string, { title: string; date: string }>,
): NonProgrammedWorkout | null {
  for (const [tonalId, activity] of activityByTonalId) {
    if (tonalId === programmedTonalId) continue;
    if (!completedTonalIds.has(tonalId)) continue;

    return {
      dayIndex,
      dayName: DAY_NAMES[dayIndex],
      programmedSessionType: formatSessionType(slot.sessionType),
      actualWorkoutTitle: activity.title,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a concise text summary for the training snapshot context.
 *
 * Output is for system context — kept factual and forward-looking.
 */
export function formatMissedSessionContext(summary: MissedSessionSummary): string {
  const parts: string[] = [];

  // Extended absence takes priority
  if (summary.daysSinceLastWorkout >= EXTENDED_ABSENCE_THRESHOLD_DAYS) {
    parts.push(
      `No workouts in ${summary.daysSinceLastWorkout} days. Welcome-back ramp-up recommended.`,
    );
  }

  if (summary.nonProgrammedWorkouts.length > 0) {
    for (const np of summary.nonProgrammedWorkouts) {
      parts.push(
        `${np.dayName}: did '${np.actualWorkoutTitle}' instead of programmed ${np.programmedSessionType} Day.`,
      );
    }
  }

  if (summary.missedSessions.length > 0) {
    const sessionList = summary.missedSessions
      .map((s) => `${s.sessionType} Day (${s.dayName})`)
      .join(", ");

    const advice =
      summary.missedSessions.length >= 2
        ? "Consider a fresh week plan."
        : "Ready to replan the week.";

    parts.push(`Missed: ${sessionList}. ${advice}`);
  }

  return parts.join(" ");
}
