import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { toUserProfileData } from "./profileData";
import type { TonalUser } from "./types";

export const WORKOUT_HISTORY_LIMIT = 50;
export const EXTERNAL_ACTIVITIES_LIMIT = 10;

export const TONAL_REFRESH_CACHE_KEYS = [
  "profile",
  "strengthScores",
  "strengthDistribution",
  "strengthHistory",
  "muscleReadiness",
  "workoutHistory:1",
  "workoutHistory:20",
  "workoutHistory:50",
  "workoutHistory:100",
  "workoutHistoryEligibility",
  "externalActivities:10",
  "externalActivities:20",
] as const;

export interface ForceRefreshResult {
  refreshedAt: number;
  newWorkouts: number;
  totalActivities: number;
}

interface BackfillResult {
  newWorkouts: number;
  totalActivities: number;
}

interface ForceRefreshDeps {
  deleteUserCacheEntries: (args: { userId: Id<"users">; dataTypes: string[] }) => Promise<unknown>;
  backfillUserHistory: (args: { userId: Id<"users"> }) => Promise<BackfillResult>;
  fetchUserProfile: (args: { userId: Id<"users"> }) => Promise<TonalUser>;
  fetchStrengthDistribution: (args: { userId: Id<"users"> }) => Promise<unknown>;
  fetchWorkoutHistory: (args: { userId: Id<"users">; limit: number }) => Promise<unknown>;
  fetchExternalActivities: (args: { userId: Id<"users">; limit: number }) => Promise<unknown>;
  updateProfileData: (args: {
    userId: Id<"users">;
    profileData: ReturnType<typeof toUserProfileData>;
  }) => Promise<unknown>;
  logError?: (message: string, reason: unknown) => void;
  now?: () => number;
}

export async function forceRefreshUserDataWithDeps(
  userId: Id<"users">,
  deps: ForceRefreshDeps,
): Promise<ForceRefreshResult> {
  const logError = deps.logError ?? ((message, reason) => console.error(message, reason));
  const now = deps.now ?? (() => Date.now());

  await deps.deleteUserCacheEntries({
    userId,
    dataTypes: [...TONAL_REFRESH_CACHE_KEYS],
  });

  const result = await deps.backfillUserHistory({ userId });

  const [profileResult, distributionResult, workoutHistoryResult, externalActivitiesResult] =
    await Promise.allSettled([
      deps.fetchUserProfile({ userId }),
      deps.fetchStrengthDistribution({ userId }),
      deps.fetchWorkoutHistory({ userId, limit: WORKOUT_HISTORY_LIMIT }),
      deps.fetchExternalActivities({ userId, limit: EXTERNAL_ACTIVITIES_LIMIT }),
    ]);

  if (profileResult.status === "fulfilled") {
    try {
      await deps.updateProfileData({
        userId,
        profileData: toUserProfileData(profileResult.value),
      });
    } catch (error) {
      logError(
        `[tonalRefresh] Failed to update profile data during refresh warm-up for user ${userId}`,
        error,
      );
    }
  } else {
    logError("[tonalRefresh] Profile refresh failed", profileResult.reason);
  }

  if (distributionResult.status === "rejected") {
    logError("[tonalRefresh] Failed to warm strength distribution", distributionResult.reason);
  }

  if (workoutHistoryResult.status === "rejected") {
    logError(
      `[tonalRefresh] Failed to warm ${WORKOUT_HISTORY_LIMIT}-workout history`,
      workoutHistoryResult.reason,
    );
  }

  if (externalActivitiesResult.status === "rejected") {
    logError(
      `[tonalRefresh] Failed to warm ${EXTERNAL_ACTIVITIES_LIMIT} external activities`,
      externalActivitiesResult.reason,
    );
  }

  return {
    refreshedAt: now(),
    newWorkouts: result.newWorkouts,
    totalActivities: result.totalActivities,
  };
}

export const forceRefreshUserData = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<ForceRefreshResult> =>
    forceRefreshUserDataWithDeps(userId, {
      deleteUserCacheEntries: (args) =>
        ctx.runMutation(internal.tonal.cache.deleteUserCacheEntries, args),
      backfillUserHistory: (args) =>
        ctx.runAction(internal.tonal.historySync.backfillUserHistory, args),
      fetchUserProfile: (args) => ctx.runAction(internal.tonal.proxy.fetchUserProfile, args),
      fetchStrengthDistribution: (args) =>
        ctx.runAction(internal.tonal.proxy.fetchStrengthDistribution, args),
      fetchWorkoutHistory: (args) => ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, args),
      fetchExternalActivities: (args) =>
        ctx.runAction(internal.tonal.proxy.fetchExternalActivities, args),
      updateProfileData: (args) => ctx.runMutation(internal.userProfiles.updateProfileData, args),
    }),
});
