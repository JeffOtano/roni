/**
 * Week plan helpers: constants, validators, and date utilities.
 * Pure functions with no Convex DB operations. Imported by all other weekPlan files.
 */

import { v } from "convex/values";

/** Session type for a day in the week plan. */
export const SESSION_TYPES = [
  "push",
  "pull",
  "legs",
  "upper",
  "lower",
  "full_body",
  "recovery",
  "rest",
] as const;

/** Day status for calendar display. */
export const DAY_STATUSES = ["programmed", "completed", "missed", "rescheduled"] as const;

export const sessionTypeValidator = v.union(
  v.literal("push"),
  v.literal("pull"),
  v.literal("legs"),
  v.literal("upper"),
  v.literal("lower"),
  v.literal("full_body"),
  v.literal("recovery"),
  v.literal("rest"),
);

export const dayStatusValidator = v.union(
  v.literal("programmed"),
  v.literal("completed"),
  v.literal("missed"),
  v.literal("rescheduled"),
);

export const daySlotValidator = v.object({
  sessionType: sessionTypeValidator,
  status: dayStatusValidator,
  workoutPlanId: v.optional(v.id("workoutPlans")),
  estimatedDuration: v.optional(v.number()),
});

/** Preferred split (exported for week programming action). */
export const preferredSplitValidator = v.union(
  v.literal("ppl"),
  v.literal("upper_lower"),
  v.literal("full_body"),
);

export const DEFAULT_DAYS = [
  { sessionType: "rest" as const, status: "programmed" as const },
  { sessionType: "rest" as const, status: "programmed" as const },
  { sessionType: "rest" as const, status: "programmed" as const },
  { sessionType: "rest" as const, status: "programmed" as const },
  { sessionType: "rest" as const, status: "programmed" as const },
  { sessionType: "rest" as const, status: "programmed" as const },
  { sessionType: "rest" as const, status: "programmed" as const },
];

const WEEK_START_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Validates YYYY-MM-DD and that the date is parseable. */
export function isValidWeekStartDateString(s: string): boolean {
  if (!WEEK_START_DATE_REGEX.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Returns the Monday of the week containing the given date as YYYY-MM-DD.
 * Used to get "current week" for the calendar and for unique week plan lookup.
 */
export function getWeekStartDateString(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dayOfMonth}`;
}
