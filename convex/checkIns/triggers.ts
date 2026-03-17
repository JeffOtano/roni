/**
 * Check-in trigger evaluation: missed session, 3-day gap, weekly recap,
 * tough session, strength milestone, plateau.
 * Extracted so checkIns.ts stays under file line limit; handler kept under 60 lines.
 */

import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { CheckInTrigger } from "./content";
import type { Activity, ExternalActivity } from "../tonal/types";
import type { WorkoutPerformanceSummary } from "../coach/prDetection";
import { getWeekStartDateString } from "../weekPlans";

const EIGHTEEN_HOURS_MS = 18 * 60 * 60 * 1000;
const MISSED_SESSION_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const GAP_3_DAYS_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000;
const WEEKLY_RECAP_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const TOUGH_SESSION_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const STRENGTH_MILESTONE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const PLATEAU_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const HIGH_EXTERNAL_LOAD_COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000;
const CONSISTENCY_STREAK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const VIGOROUS_HR_THRESHOLD = 130;

type TriggerResult = { trigger: CheckInTrigger; triggerContext?: string; message?: string };

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

async function evaluateToughSession(
  ctx: ActionCtx,
  userId: Id<"users">,
  now: number,
): Promise<TriggerResult | null> {
  const feedback = await ctx.runQuery(internal.workoutFeedback.getRecentInternal, {
    userId,
    limit: 1,
  });
  if (feedback.length === 0) return null;

  const latest = feedback[0];
  const age = now - latest.createdAt;
  if (age > TWENTY_FOUR_HOURS_MS) return null;
  if (latest.rpe < 8 || latest.rating < 4) return null;

  const triggerContext = latest.activityId;
  const hasRecent = await ctx.runQuery(internal.checkIns.hasRecentCheckIn, {
    userId,
    trigger: "tough_session_completed",
    since: now - TOUGH_SESSION_COOLDOWN_MS,
    triggerContext,
  });
  if (hasRecent) return null;

  const message = `Solid work — RPE ${latest.rpe} and you rated it ${latest.rating}/5. Your body's adapting. Rest up and we'll keep building.`;
  return { trigger: "tough_session_completed", triggerContext, message };
}

async function evaluateStrengthMilestone(
  ctx: ActionCtx,
  userId: Id<"users">,
  now: number,
  summary: WorkoutPerformanceSummary,
  latestActivity: Activity | null,
): Promise<TriggerResult | null> {
  if (summary.prs.length === 0 || !latestActivity) return null;

  const activityAge = now - new Date(latestActivity.activityTime).getTime();
  if (activityAge > FORTY_EIGHT_HOURS_MS) return null;

  const triggerContext = latestActivity.activityId;
  const hasRecent = await ctx.runQuery(internal.checkIns.hasRecentCheckIn, {
    userId,
    trigger: "strength_milestone",
    since: now - STRENGTH_MILESTONE_COOLDOWN_MS,
    triggerContext,
  });
  if (hasRecent) return null;

  const bestPR = summary.prs.reduce((best, pr) =>
    pr.improvementPct > best.improvementPct ? pr : best,
  );
  const message = `New PR on ${bestPR.movementName} — ${bestPR.newWeightLbs} lbs, up ${bestPR.improvementPct}% from your previous best of ${bestPR.previousBestLbs} lbs.`;
  return { trigger: "strength_milestone", triggerContext, message };
}

async function evaluatePlateau(
  ctx: ActionCtx,
  userId: Id<"users">,
  now: number,
  summary: WorkoutPerformanceSummary,
): Promise<TriggerResult | null> {
  if (summary.plateaus.length === 0) return null;

  // Fire for first plateau not on cooldown
  for (const plateau of summary.plateaus) {
    const triggerContext = plateau.movementId;
    const hasRecent = await ctx.runQuery(internal.checkIns.hasRecentCheckIn, {
      userId,
      trigger: "plateau",
      since: now - PLATEAU_COOLDOWN_MS,
      triggerContext,
    });
    if (hasRecent) continue;

    const message = `Your ${plateau.movementName} has been at ${plateau.weightLbs} lbs for ${plateau.flatSessionCount} sessions. Options: add a set, bump weight 5%, or swap the exercise for a few weeks.`;
    return { trigger: "plateau", triggerContext, message };
  }

  return null;
}

async function evaluateHighExternalLoad(
  ctx: ActionCtx,
  userId: Id<"users">,
  now: number,
): Promise<TriggerResult | null> {
  const externals = (await ctx.runAction(internal.tonal.proxy.fetchExternalActivities, {
    userId,
    limit: 20,
  })) as ExternalActivity[];

  const seventyTwoHoursAgo = now - 3 * 24 * 60 * 60 * 1000;
  const recentVigorous = externals.filter((e) => {
    const ts = new Date(e.beginTime).getTime();
    return ts > seventyTwoHoursAgo && e.averageHeartRate >= VIGOROUS_HR_THRESHOLD;
  });

  if (recentVigorous.length < 3) return null;

  const hasRecent = await ctx.runQuery(internal.checkIns.hasRecentCheckIn, {
    userId,
    trigger: "high_external_load",
    since: now - HIGH_EXTERNAL_LOAD_COOLDOWN_MS,
  });
  if (hasRecent) return null;

  return {
    trigger: "high_external_load",
    triggerContext: `${recentVigorous.length} vigorous sessions in 72h`,
  };
}

async function evaluateConsistencyStreak(
  ctx: ActionCtx,
  userId: Id<"users">,
  now: number,
): Promise<TriggerResult | null> {
  const threeWeeksAgo = new Date(now - 21 * 24 * 60 * 60 * 1000);

  const activities = (await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
    userId,
    limit: 30,
  })) as Activity[];

  const weekCounts = new Map<string, number>();
  for (const a of activities) {
    const actDate = new Date(a.activityTime);
    if (actDate < threeWeeksAgo) continue;
    const weekKey = getWeekStartDateString(actDate);
    weekCounts.set(weekKey, (weekCounts.get(weekKey) ?? 0) + 1);
  }

  const completeWeeks = [...weekCounts.values()].filter((count) => count >= 3).length;
  if (completeWeeks < 3) return null;

  const hasRecent = await ctx.runQuery(internal.checkIns.hasRecentCheckIn, {
    userId,
    trigger: "consistency_streak",
    since: now - CONSISTENCY_STREAK_COOLDOWN_MS,
  });
  if (hasRecent) return null;

  return {
    trigger: "consistency_streak",
    triggerContext: `${completeWeeks} consecutive weeks with 3+ sessions`,
  };
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

    const tough = await evaluateToughSession(ctx, userId, now);
    if (tough) triggers.push(tough);

    // Performance triggers share one expensive call
    const [summary, activities] = await Promise.all([
      ctx.runAction(internal.progressiveOverload.getWorkoutPerformanceSummary, { userId }),
      ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, { userId, limit: 1 }),
    ]);
    const latestActivity =
      (activities as Activity[]).length > 0 ? (activities as Activity[])[0] : null;

    const milestone = await evaluateStrengthMilestone(ctx, userId, now, summary, latestActivity);
    if (milestone) triggers.push(milestone);

    const plateauResult = await evaluatePlateau(ctx, userId, now, summary);
    if (plateauResult) triggers.push(plateauResult);

    const externalLoad = await evaluateHighExternalLoad(ctx, userId, now);
    if (externalLoad) triggers.push(externalLoad);

    const streak = await evaluateConsistencyStreak(ctx, userId, now);
    if (streak) triggers.push(streak);

    return triggers;
  },
});
