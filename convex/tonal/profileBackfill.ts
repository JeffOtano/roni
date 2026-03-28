import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";

/**
 * One-time backfill: fetch fresh Tonal profile for all users and sync
 * new fields (dateOfBirth, username, tonalCreatedAt) into userProfiles
 * and name fields into the users table.
 *
 * Run manually: npx convex run --prod tonal/profileBackfill:backfillAllProfiles
 */
export const backfillAllProfiles = internalAction({
  args: {},
  handler: async (ctx): Promise<{ success: number; failed: number; total: number }> => {
    const profiles: Doc<"userProfiles">[] = await ctx.runQuery(
      internal.userProfiles.getActiveUsers,
      {
        sinceTimestamp: 0,
      },
    );

    let success = 0;
    let failed = 0;

    for (const profile of profiles) {
      try {
        const u = await ctx.runAction(internal.tonal.proxy.fetchUserProfile, {
          userId: profile.userId,
        });
        await ctx.runMutation(internal.userProfiles.updateProfileData, {
          userId: profile.userId,
          profileData: {
            firstName: u.firstName,
            lastName: u.lastName,
            heightInches: u.heightInches,
            weightPounds: u.weightPounds,
            gender: u.gender,
            level: u.tonalStatus ?? "",
            workoutsPerWeek: u.workoutsPerWeek,
            workoutDurationMin: u.workoutDurationMin ?? 0,
            workoutDurationMax: u.workoutDurationMax ?? 0,
            dateOfBirth: u.dateOfBirth || undefined,
            username: u.username || undefined,
            tonalCreatedAt: u.createdAt || undefined,
          },
        });
        success++;
      } catch (err) {
        failed++;
        console.error(`[profileBackfill] Failed for user ${profile.userId}:`, err);
      }
    }

    console.log(
      `[profileBackfill] Complete: ${success} succeeded, ${failed} failed out of ${profiles.length} total`,
    );
    return { success, failed, total: profiles.length };
  },
});
