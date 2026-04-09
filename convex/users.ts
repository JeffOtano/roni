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
      tonalName: profile?.profileData
        ? `${profile.profileData.firstName} ${profile.profileData.lastName}`
        : undefined,
      tonalEmail: profile?.tonalEmail,
      tonalTokenExpired,
    };
  },
});
