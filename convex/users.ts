import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getEffectiveUserId } from "./lib/auth";

type SyncStatus = NonNullable<Doc<"userProfileActivity">["syncStatus"]>;

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

/** Sync status for the authenticated user, served from `userProfileActivity`. */
export const getSyncStatus = query({
  args: {},
  handler: async (ctx): Promise<SyncStatus | null> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;

    const activity = await ctx.db
      .query("userProfileActivity")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (activity?.syncStatus !== undefined) return activity.syncStatus;

    // Fall back to the legacy column for users whose activity row exists but
    // pre-dates the syncStatus dual-write, or who have no activity row yet.
    // TODO(post-backfill): drop once the backfill migration has run in prod.
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return profile?.syncStatus ?? null;
  },
});
