import { v } from "convex/values";
import { getAuthUserId, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { getEffectiveUserId } from "./lib/auth";
import { USER_TABLE_BATCH_TABLES } from "./userData";

export const getFullProfile = query({
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
      email: user?.email,
      tonalName: profile?.profileData
        ? `${profile.profileData.firstName} ${profile.profileData.lastName}`
        : undefined,
      profileData: profile?.profileData ?? null,
      tonalConnectedAt: profile?.tonalConnectedAt ?? null,
      tonalEmail: profile?.tonalEmail,
      hasTonalProfile: !!profile,
      tonalTokenExpired,
      checkInPreferences: profile?.checkInPreferences ?? null,
      ownedAccessories: profile?.ownedAccessories ?? null,
    };
  },
});

export const updateProfileSettings = mutation({
  args: {
    ownedAccessories: v.optional(
      v.object({
        smartHandles: v.boolean(),
        smartBar: v.boolean(),
        rope: v.boolean(),
        roller: v.boolean(),
        weightBar: v.boolean(),
        pilatesLoops: v.boolean(),
        ankleStraps: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("User profile not found");

    const patch: Record<string, unknown> = {};
    if (args.ownedAccessories !== undefined) {
      patch.ownedAccessories = args.ownedAccessories;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(profile._id, patch);
    }
  },
});

export const changePassword = action({
  args: {
    oldPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { oldPassword, newPassword }): Promise<void> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.account.getUserEmail, { userId });
    if (!user?.email) throw new Error("No email found for account");

    // Verify old password
    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: user.email, secret: oldPassword },
      });
    } catch {
      throw new Error("Current password is incorrect");
    }

    // Set new password
    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: user.email, secret: newPassword },
    });
  },
});

export const getUserEmail = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    return user ? { email: user.email } : null;
  },
});

export const deleteAccount = action({
  args: {},
  handler: async (ctx): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.runMutation(internal.accountDeletion.markDeletionInProgress, { userId });

    try {
      await ctx.runAction(components.agent.users.deleteAllForUserId, { userId });

      // Drain each table in batches of 500 to stay under the 4096 read limit
      for (const table of USER_TABLE_BATCH_TABLES) {
        let hasMore = true;
        while (hasMore) {
          hasMore = await ctx.runMutation(internal.accountDeletion.deleteUserTableBatch, {
            userId,
            table,
          });
        }
      }

      for (const mutation of [
        // personalRecords is drained first so its aggregate entries are cleared
        // before the exercisePerformance rows it mirrors are deleted.
        internal.accountDeletion.deletePersonalRecordsBatch,
        internal.accountDeletion.deleteExercisePerformanceBatch,
        internal.accountDeletion.deleteTonalCacheBatch,
        internal.accountDeletion.deleteExternalActivitiesBatch,
      ] as const) {
        let hasMore = true;
        while (hasMore) {
          hasMore = await ctx.runMutation(mutation, { userId });
        }
      }

      let hasMoreAuthData = true;
      while (hasMoreAuthData) {
        hasMoreAuthData = await ctx.runMutation(internal.accountDeletion.deleteAuthData, {
          userId,
        });
      }
      await ctx.runMutation(internal.accountDeletion.deleteUserRecord, { userId });
    } catch (error) {
      await ctx.runMutation(internal.accountDeletion.clearDeletionInProgress, { userId });
      throw error;
    }
  },
});
