/**
 * Check-in trigger evaluation: missed session, 3-day gap, weekly recap.
 * Extracted so checkIns.ts stays under file line limit; handler kept under 60 lines.
 */

import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { CheckInTrigger } from "./content";
import type { Activity } from "../tonal/types";
import { getWeekStartDateString } from "../weekPlans";

const EIGHTEEN_HOURS_MS = 18 * 60 * 60 * 1000;
const MISSED_SESSION_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const GAP_3_DAYS_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000;
const WEEKLY_RECAP_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

type TriggerResult = { trigger: CheckInTrigger; triggerContext?: string };

async function evaluateMissedSession(opts: {
  ctx: ActionCtx;
  userId: Id<"users">;
  now: number;
  weekStart: string;
  yesterdayIndex: number;
}): Promise<TriggerResult | null> {
  const { ctx, userId, now, weekStart, yesterdayIndex } = opts;
  const weekPlan = await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
    userId,
    weekStartDate: weekStart,
  });
  if (!weekPlan?.days) return null;
  const yesterdaySlot = weekPlan.days[yesterdayIndex];
  const wasProgrammed =
    yesterdaySlot &&
    yesterdaySlot.sessionType !== "rest" &&
    (yesterdaySlot.status === "programmed" || yesterdaySlot.status === "missed");
  if (!wasProgrammed) return null;
  const triggerContext = `${weekStart}:${yesterdayIndex}`;
  const hasRecent = await ctx.runQuery(internal.checkIns.hasRecentCheckIn, {
    userId,
    trigger: "missed_session",
    since: now - MISSED_SESSION_COOLDOWN_MS,
    triggerContext,
  });
  if (hasRecent) return null;
  return { trigger: "missed_session", triggerContext };
}

async function evaluateGap3Days(
  ctx: ActionCtx,
  userId: Id<"users">,
  now: number,
): Promise<TriggerResult | null> {
  const activities = (await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
    userId,
    limit: 5,
  })) as Activity[];
  const lastActivityTime =
    activities.length > 0 ? new Date(activities[0].activityTime ?? 0).getTime() : 0;
  if (lastActivityTime === 0 || now - lastActivityTime < THREE_DAYS_MS) return null;
  const hasRecent = await ctx.runQuery(internal.checkIns.hasRecentCheckIn, {
    userId,
    trigger: "gap_3_days",
    since: now - GAP_3_DAYS_COOLDOWN_MS,
  });
  if (hasRecent) return null;
  return { trigger: "gap_3_days" };
}

async function evaluateWeeklyRecap(
  ctx: ActionCtx,
  userId: Id<"users">,
  now: number,
  weekStart: string,
): Promise<TriggerResult | null> {
  const hasRecent = await ctx.runQuery(internal.checkIns.hasRecentCheckIn, {
    userId,
    trigger: "weekly_recap",
    since: now - WEEKLY_RECAP_COOLDOWN_MS,
    triggerContext: weekStart,
  });
  if (hasRecent) return null;
  return { trigger: "weekly_recap", triggerContext: weekStart };
}

/** Evaluate triggers for one user; returns triggers to send (with optional context). */
export const evaluateTriggersForUser = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<TriggerResult[]> => {
    const now = Date.now();
    const today = new Date(now);
    const weekStart = getWeekStartDateString(today);
    const dayOfWeek = today.getUTCDay();
    const yesterdayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const triggers: TriggerResult[] = [];

    const yesterdayStart = new Date(today);
    yesterdayStart.setUTCDate(today.getUTCDate() - 1);
    yesterdayStart.setUTCHours(0, 0, 0, 0);
    const eighteenHoursAfterYesterday = yesterdayStart.getTime() + EIGHTEEN_HOURS_MS;
    if (now >= eighteenHoursAfterYesterday) {
      const t = await evaluateMissedSession({ ctx, userId, now, weekStart, yesterdayIndex });
      if (t) triggers.push(t);
    }

    const gap = await evaluateGap3Days(ctx, userId, now);
    if (gap) triggers.push(gap);

    const isSunday = dayOfWeek === 0;
    const hourUtc = today.getUTCHours();
    if (isSunday && hourUtc >= 18) {
      const recap = await evaluateWeeklyRecap(ctx, userId, now, weekStart);
      if (recap) triggers.push(recap);
    }

    return triggers;
  },
});
