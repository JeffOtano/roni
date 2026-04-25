import { query } from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const tonalTokenExpired =
      !!profile &&
      typeof profile.tonalTokenExpiresAt === "number" &&
      profile.tonalTokenExpiresAt < Date.now();

    return {
      userId,
      email: user?.email as string | undefined,
      hasTonalProfile: !!profile,
      onboardingCompleted: !!profile?.onboardingData?.completedAt,
      hasCheckInPreferences: !!profile?.checkInPreferences,
      tonalName: profile?.profileData
        ? `${profile.profileData.firstName} ${profile.profileData.lastName}`
        : undefined,
      tonalEmail: profile?.tonalEmail,
      tonalTokenExpired,
    };
  },
});

/**
 * Sync status for the authenticated user, served from the
 * `userProfileActivity` split table. During the widen rollout we fall back
 * to `userProfiles.syncStatus` for users whose activity row hasn't been
 * backfilled yet so the SyncStatusBanner stays accurate end-to-end.
 */
export const getSyncStatus = query({
  args: {},
  handler: async (ctx): Promise<"syncing" | "complete" | "failed" | null> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;

    const activity = await ctx.db
      .query("userProfileActivity")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (activity) return activity.syncStatus ?? null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return profile?.syncStatus ?? null;
  },
});
