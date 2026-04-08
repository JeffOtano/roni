import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type {
  Activity,
  ExternalActivity,
  Movement,
  MuscleReadiness,
  StrengthScore,
} from "../tonal/types";
import { detectMissedSessions, formatMissedSessionContext } from "../coach/missedSessionDetection";
import { getWeekStartDateString } from "../weekPlanHelpers";
import type { OwnedAccessories } from "../tonal/accessories";
export { getRecencyLabel } from "./timeDecay";
import { getRecencyLabel } from "./timeDecay";
import {
  buildExerciseCatalogSection,
  computeAge,
  formatExternalActivityLine,
  getHrIntensityLabel,
  SNAPSHOT_MAX_CHARS,
  type SnapshotSection,
  trimSnapshot,
} from "./snapshotHelpers";

// Re-export for backward compatibility (tests, other consumers)
export {
  type SnapshotSection,
  trimSnapshot,
  getHrIntensityLabel,
  formatExternalActivityLine,
  buildExerciseCatalogSection,
};

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

  // Parallel fetch: Tonal data + coaching data + movement catalog
  const [
    scores,
    readiness,
    activities,
    activeBlock,
    recentFeedback,
    activeGoals,
    activeInjuries,
    externalActivities,
    movementCatalog,
  ] = await Promise.all([
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
    ctx
      .runQuery(internal.coach.periodization.getActiveBlock, { userId: convexUserId })
      .catch(() => null),
    ctx
      .runQuery(internal.workoutFeedback.getRecentInternal, { userId: convexUserId, limit: 5 })
      .catch(() => []),
    ctx.runQuery(internal.goals.getActiveInternal, { userId: convexUserId }).catch(() => []),
    ctx.runQuery(internal.injuries.getActiveInternal, { userId: convexUserId }).catch(() => []),
    ctx
      .runAction(internal.tonal.proxy.fetchExternalActivities, {
        userId: convexUserId,
        limit: 20,
      })
      .catch(() => [] as ExternalActivity[]),
    ctx.runQuery(internal.tonal.movementSync.getAllMovements).catch(() => [] as Movement[]),
  ]);

  const pd = profile.profileData;
  const sections: SnapshotSection[] = [];

  // Priority 1: User profile + onboarding + preferences
  const profileLines: string[] = [];
  const age = computeAge(pd.dateOfBirth, new Date());
  const ageSuffix = age !== null ? ` | Age: ${age}` : "";
  profileLines.push(
    `User: ${pd.firstName} ${pd.lastName} | ${pd.heightInches}"/${pd.weightPounds}lbs${ageSuffix} | Level: ${pd.level} | ${pd.workoutsPerWeek}x/week`,
  );
  const onboardingData = profile?.onboardingData;
  const trainingPrefs = profile?.trainingPreferences;
  if (onboardingData?.goal) {
    profileLines.push(`Goal: ${onboardingData.goal}`);
  }
  if (onboardingData?.injuries) {
    profileLines.push(`Injuries/Constraints: ${onboardingData.injuries}`);
  }
  if (trainingPrefs) {
    const splitNames: Record<string, string> = {
      ppl: "Push/Pull/Legs",
      upper_lower: "Upper/Lower",
      full_body: "Full Body",
    };
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const days = trainingPrefs.trainingDays.map((d: number) => dayNames[d]).join(", ");
    profileLines.push(
      `Preferences: ${splitNames[trainingPrefs.preferredSplit] ?? trainingPrefs.preferredSplit} | ${trainingPrefs.sessionDurationMinutes}min | ${days}`,
    );
  }
  sections.push({ priority: 1, lines: profileLines });

  // Priority 2: Equipment
  const owned = profile.ownedAccessories as OwnedAccessories | undefined;
  const equipmentLines: string[] = [];
  if (owned) {
    const displayNames: Record<keyof OwnedAccessories, string> = {
      smartHandles: "Smart Handles",
      smartBar: "Smart Bar",
      rope: "Rope",
      roller: "Roller",
      weightBar: "Weight Bar",
      pilatesLoops: "Pilates Loops",
      ankleStraps: "Ankle Straps",
    };
    const ownedNames = Object.entries(displayNames)
      .filter(([key]) => owned[key as keyof OwnedAccessories])
      .map(([, name]) => name);
    const missingNames = Object.entries(displayNames)
      .filter(([key]) => !owned[key as keyof OwnedAccessories])
      .map(([, name]) => name);
    equipmentLines.push(`Equipment:`);
    equipmentLines.push(`  Owned: ${ownedNames.length > 0 ? ownedNames.join(", ") : "None"}`);
    if (missingNames.length > 0) {
      equipmentLines.push(`  Missing: ${missingNames.join(", ")}`);
      equipmentLines.push(
        `  (Exercises requiring missing equipment are automatically excluded from programming.)`,
      );
    }
  } else {
    equipmentLines.push(`Equipment: All accessories assumed available (no equipment profile set).`);
  }
  sections.push({ priority: 2, lines: equipmentLines });

  // Priority 6.5: Exercise catalog grouped by accessory
  const catalogSection = buildExerciseCatalogSection(movementCatalog, owned);
  if (catalogSection) sections.push(catalogSection);

  // Priority 3: Active injuries
  const injuries = activeInjuries as Doc<"injuries">[];
  if (injuries.length > 0) {
    const injuryLines: string[] = [`Active Injuries/Limitations:`];
    for (const inj of injuries) {
      injuryLines.push(
        `  ${inj.area} (${inj.severity}) — avoid: ${inj.avoidance}${inj.notes ? ` — ${inj.notes}` : ""}`,
      );
    }
    injuryLines.push(`  → Exercise selection MUST respect these avoidances.`);
    sections.push({ priority: 3, lines: injuryLines });
  }

  // Priority 4: Active goals
  const goals = activeGoals as Doc<"goals">[];
  if (goals.length > 0) {
    const goalLines: string[] = [`Active Goals:`];
    for (const g of goals) {
      const range = Math.abs(g.targetValue - g.baselineValue);
      const pct =
        range === 0 ? 100 : Math.round((Math.abs(g.currentValue - g.baselineValue) / range) * 100);
      goalLines.push(
        `  ${g.title}: ${g.currentValue} → ${g.targetValue} (${Math.min(100, pct)}% complete, deadline: ${g.deadline})`,
      );
    }
    sections.push({ priority: 4, lines: goalLines });
  }

  // Priority 5: Training block
  const block = activeBlock as Doc<"trainingBlocks"> | null;
  const blockLines: string[] = [];
  if (block) {
    blockLines.push(
      `Training Block: ${block.label} | ${block.blockType} | Week ${block.weekNumber}/${block.totalWeeks}`,
    );
    if (block.blockType === "deload") {
      blockLines.push(
        `  → DELOAD WEEK: Reduce volume and intensity. 2 sets instead of 3, RPE target 5-6.`,
      );
    }
  } else {
    blockLines.push(`Training Block: None active. Start one when programming the first week.`);
  }
  sections.push({ priority: 5, lines: blockLines });

  // Priority 6: Recent feedback
  const feedback = recentFeedback as Doc<"workoutFeedback">[];
  if (feedback.length > 0) {
    const feedbackLines: string[] = [];
    const avgRpe = feedback.reduce((sum, f) => sum + f.rpe, 0) / feedback.length;
    const avgRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
    feedbackLines.push(
      `Recent Feedback (last ${feedback.length}): Avg RPE ${avgRpe.toFixed(1)}/10, Avg Rating ${avgRating.toFixed(1)}/5`,
    );
    if (avgRpe >= 8.5) {
      feedbackLines.push(`  → HIGH RPE WARNING: User may need a deload or intensity reduction.`);
    }
    if (avgRating <= 2) {
      feedbackLines.push(`  → LOW SATISFACTION: Check in about what's not working.`);
    }
    sections.push({ priority: 6, lines: feedbackLines });
  }

  // Priority 7: Strength scores
  if ((scores as StrengthScore[]).length > 0) {
    const scoreLines = (scores as StrengthScore[])
      .map((s) => `${s.bodyRegionDisplay}: ${s.score}`)
      .join(", ");
    sections.push({
      priority: 7,
      lines: [
        `Tonal Strength Scores (proprietary fitness metric 0-999 scale, NOT weight in lbs): ${scoreLines}`,
      ],
    });
  }

  // Priority 8: Muscle readiness
  if (readiness) {
    const mr = readiness as MuscleReadiness;
    const readyParts = Object.entries(mr)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    sections.push({ priority: 8, lines: [`Muscle Readiness (0-100): ${readyParts}`] });
  }

  // Priority 9: Recent workouts (time-decay: recent = more detail)
  if ((activities as Activity[]).length > 0) {
    const now = new Date();
    const wl = [`Recent Workouts:`];
    for (const a of activities as Activity[]) {
      const wp = a.workoutPreview;
      const r = getRecencyLabel(a.activityTime, now);
      const date = a.activityTime.split("T")[0];
      const recent = r === "today" || r === "yesterday";
      const tag = recent ? `[${r.toUpperCase()}] ` : "";
      const vol = r !== "last week" && r !== "older" ? ` | ${wp.totalVolume}lbs vol` : "";
      const dur = recent ? ` | ${Math.round(wp.totalDuration / 60)}min` : "";
      wl.push(`  ${tag}${date} | ${wp.workoutTitle} | ${wp.targetArea}${vol}${dur}`);
    }
    sections.push({ priority: 9, lines: wl });
  }

  // Priority 10: External activities (time-decay: highlight recent high-intensity)
  const extActs = externalActivities as ExternalActivity[];
  if (extActs.length > 0) {
    const now = new Date();
    const el: string[] = [`External Activities (non-Tonal):`];
    let vigorousThisWeek = 0;
    for (const ext of extActs) {
      const r = getRecencyLabel(ext.beginTime, now);
      const tag = r === "today" || r === "yesterday" ? `  [${r.toUpperCase()}] ` : "  ";
      el.push(tag + formatExternalActivityLine(ext).trimStart());
      if (
        r !== "last week" &&
        r !== "older" &&
        getHrIntensityLabel(ext.averageHeartRate) === "vigorous"
      ) {
        vigorousThisWeek++;
      }
    }
    if (vigorousThisWeek > 0) {
      el.push(
        `  → ${vigorousThisWeek} vigorous session(s) this week. Factor into recovery and volume decisions.`,
      );
    }
    sections.push({ priority: 6, lines: el });
  }

  // Priority 11: Performance notes
  if ((activities as Activity[]).length >= 2) {
    const perfLines: string[] = [];
    const latest = (activities as Activity[])[0];
    const previous = (activities as Activity[])[1];
    if (latest.workoutPreview.totalVolume > previous.workoutPreview.totalVolume * 1.1) {
      perfLines.push(
        `Performance: Last session volume was ${Math.round((latest.workoutPreview.totalVolume / previous.workoutPreview.totalVolume - 1) * 100)}% higher than previous.`,
      );
    }
    perfLines.push(
      `Tip: Use get_workout_performance for detailed per-exercise PR/plateau analysis.`,
    );
    sections.push({ priority: 11, lines: perfLines });
  }

  // Priority 12: Missed session detection — non-critical, skip on error
  try {
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
        sections.push({ priority: 12, lines: [missedContext] });
      }
    }
  } catch {
    // Missed session detection is non-critical; continue without it
  }

  return trimSnapshot(sections, SNAPSHOT_MAX_CHARS);
}
