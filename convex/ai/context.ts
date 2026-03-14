import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { Activity, MuscleReadiness, StrengthScore } from "../tonal/types";
import { detectMissedSessions, formatMissedSessionContext } from "../coach/missedSessionDetection";
import { getWeekStartDateString } from "../weekPlanHelpers";

export async function buildTrainingSnapshot(
  ctx: Pick<ActionCtx, "runQuery" | "runAction">,
  userId: string,
): Promise<string> {
  const convexUserId = userId as Id<"users">;

  const profile = await ctx.runQuery(internal.tonal.cache.getUserProfile, {
    userId: convexUserId,
  });

  if (!profile?.profileData) {
    return "No Tonal profile linked yet. Ask the user to connect their Tonal account.";
  }

  // Parallel fetch from cache via proxy actions
  const [scores, readiness, activities] = await Promise.all([
    ctx
      .runAction(internal.tonal.proxy.fetchStrengthScores, {
        userId: convexUserId,
      })
      .catch(() => [] as StrengthScore[]),
    ctx
      .runAction(internal.tonal.proxy.fetchMuscleReadiness, {
        userId: convexUserId,
      })
      .catch(() => null as MuscleReadiness | null),
    ctx
      .runAction(internal.tonal.proxy.fetchWorkoutHistory, {
        userId: convexUserId,
        limit: 10,
      })
      .catch(() => [] as Activity[]),
  ]);

  const pd = profile.profileData;
  const lines: string[] = [
    `=== TRAINING SNAPSHOT ===`,
    `User: ${pd.firstName} ${pd.lastName} | ${pd.heightInches}"/${pd.weightPounds}lbs | Level: ${pd.level} | ${pd.workoutsPerWeek}x/week`,
  ];

  // Onboarding data (goal, injuries, preferences)
  const onboardingData = profile?.onboardingData;
  const trainingPrefs = profile?.trainingPreferences;

  if (onboardingData?.goal) {
    lines.push(`Goal: ${onboardingData.goal}`);
  }
  if (onboardingData?.injuries) {
    lines.push(`Injuries/Constraints: ${onboardingData.injuries}`);
  }
  if (trainingPrefs) {
    const splitNames: Record<string, string> = {
      ppl: "Push/Pull/Legs",
      upper_lower: "Upper/Lower",
      full_body: "Full Body",
    };
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const days = trainingPrefs.trainingDays.map((d: number) => dayNames[d]).join(", ");
    lines.push(
      `Preferences: ${splitNames[trainingPrefs.preferredSplit] ?? trainingPrefs.preferredSplit} | ${trainingPrefs.sessionDurationMinutes}min | ${days}`,
    );
  }

  // Strength scores
  if ((scores as StrengthScore[]).length > 0) {
    const scoreLines = (scores as StrengthScore[])
      .map((s) => `${s.bodyRegionDisplay}: ${s.score}`)
      .join(", ");
    lines.push(`Strength: ${scoreLines}`);
  }

  // Muscle readiness
  if (readiness) {
    const mr = readiness as MuscleReadiness;
    const readyParts = Object.entries(mr)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    lines.push(`Muscle Readiness (0-100): ${readyParts}`);
  }

  // Recent workouts
  if ((activities as Activity[]).length > 0) {
    lines.push(`Recent Workouts:`);
    for (const a of activities as Activity[]) {
      const wp = a.workoutPreview;
      lines.push(
        `  ${a.activityTime.split("T")[0]} | ${wp.workoutTitle} | ${wp.targetArea} | ${wp.totalVolume}lbs vol | ${Math.round(wp.totalDuration / 60)}min`,
      );
    }
  }

  // Performance note (from activities we already fetched)
  if ((activities as Activity[]).length >= 2) {
    const latest = (activities as Activity[])[0];
    const previous = (activities as Activity[])[1];
    if (latest.workoutPreview.totalVolume > previous.workoutPreview.totalVolume * 1.1) {
      lines.push(
        `Performance: Last session volume was ${Math.round((latest.workoutPreview.totalVolume / previous.workoutPreview.totalVolume - 1) * 100)}% higher than previous.`,
      );
    }
    lines.push(`Tip: Use get_workout_performance for detailed per-exercise PR/plateau analysis.`);
  }

  // Missed session detection
  const weekStartDate = getWeekStartDateString(new Date());
  const weekPlan = (await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
    userId: convexUserId,
    weekStartDate,
  })) as Doc<"weekPlans"> | null;

  if (weekPlan) {
    const workoutPlanIds = weekPlan.days
      .map((d) => d.workoutPlanId)
      .filter((id): id is Id<"workoutPlans"> => id !== undefined);

    const uniquePlanIds = [...new Set(workoutPlanIds)];
    const workoutPlanResults = await Promise.all(
      uniquePlanIds.map((planId) =>
        ctx.runQuery(internal.workoutPlans.getById, { planId, userId: convexUserId }),
      ),
    );

    const tonalWorkoutIdByPlanId = new Map<string, string>();
    for (let i = 0; i < uniquePlanIds.length; i++) {
      const wp = workoutPlanResults[i] as Doc<"workoutPlans"> | null;
      if (wp?.tonalWorkoutId) {
        tonalWorkoutIdByPlanId.set(uniquePlanIds[i], wp.tonalWorkoutId);
      }
    }

    const completedTonalIds = new Set(
      (activities as Activity[]).map((a) => a.workoutPreview.workoutId),
    );

    const now = new Date();
    const todayDayIndex = (now.getDay() + 6) % 7; // Mon=0..Sun=6
    const todayDate = now.toISOString().slice(0, 10);

    const missedSummary = detectMissedSessions({
      days: weekPlan.days,
      todayDayIndex,
      completedTonalIds,
      tonalWorkoutIdByPlanId,
      activityDates: (activities as Activity[]).map((a) => a.activityTime.slice(0, 10)),
      todayDate,
    });

    const missedContext = formatMissedSessionContext(missedSummary);
    if (missedContext) {
      lines.push(missedContext);
    }
  }

  lines.push(`=== END SNAPSHOT ===`);
  return lines.join("\n");
}
