import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type {
  StrengthScore,
  MuscleReadiness,
  Activity,
} from "../tonal/types";

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

  lines.push(`=== END SNAPSHOT ===`);
  return lines.join("\n");
}
