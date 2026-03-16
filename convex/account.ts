import { v } from "convex/values";
import { getAuthUserId, modifyAccountCredentials, retrieveAccount } from "@convex-dev/auth/server";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const getFullProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
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
      progressPhotoAnalysisEnabled: profile?.progressPhotoAnalysisEnabled !== false,
      hasTonalProfile: !!profile,
      tonalTokenExpired,
      checkInPreferences: profile?.checkInPreferences ?? null,
      ownedAccessories: profile?.ownedAccessories ?? null,
    };
  },
});

export const updateProfileSettings = mutation({
  args: {
    progressPhotoAnalysisEnabled: v.optional(v.boolean()),
    ownedAccessories: v.optional(
      v.object({
        smartHandles: v.boolean(),
        smartBar: v.boolean(),
        rope: v.boolean(),
        roller: v.boolean(),
        weightBar: v.boolean(),
        pilatesLoops: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("User profile not found");

    const patch: Record<string, unknown> = {};
    if (args.progressPhotoAnalysisEnabled !== undefined) {
      patch.progressPhotoAnalysisEnabled = args.progressPhotoAnalysisEnabled;
    }
    if (args.ownedAccessories !== undefined) {
      patch.ownedAccessories = args.ownedAccessories;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(profile._id, patch);
    }
  },
});

interface ExportedData {
  exportedAt: string;
  user: { email: string | null; name: string | null };
  profile: {
    profileData: Record<string, unknown> | null;
    tonalConnectedAt: number | null;
    progressPhotoAnalysisEnabled: boolean | null;
    checkInPreferences: Record<string, unknown> | null;
    lastActiveAt: number;
  } | null;
  workoutPlans: Record<string, unknown>[];
  weekPlans: Record<string, unknown>[];
  checkIns: Record<string, unknown>[];
  progressPhotos: { createdAt: number }[];
  mcpKeys: { label: string | null; createdAt: number; lastUsedAt: number | null }[];
}

export const exportData = action({
  args: {},
  handler: async (ctx): Promise<ExportedData> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return (await ctx.runQuery(internal.account.collectUserData, {
      userId,
    })) as ExportedData;
  },
});

export const collectUserData = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const workoutPlans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const weekPlans = await ctx.db
      .query("weekPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const checkIns = await ctx.db
      .query("checkIns")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const progressPhotos = await ctx.db
      .query("progressPhotos")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const mcpKeys = await ctx.db
      .query("mcpApiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return {
      exportedAt: new Date().toISOString(),
      user: {
        email: user?.email ?? null,
        name: user?.name ?? null,
      },
      profile: profile
        ? {
            profileData: profile.profileData ?? null,
            tonalConnectedAt: profile.tonalConnectedAt ?? null,
            progressPhotoAnalysisEnabled: profile.progressPhotoAnalysisEnabled ?? null,
            checkInPreferences: profile.checkInPreferences ?? null,
            lastActiveAt: profile.lastActiveAt,
          }
        : null,
      workoutPlans: workoutPlans.map((wp) => ({
        title: wp.title,
        status: wp.status,
        blocks: wp.blocks,
        estimatedDuration: wp.estimatedDuration ?? null,
        createdAt: wp.createdAt,
        pushedAt: wp.pushedAt ?? null,
      })),
      weekPlans: weekPlans.map((wp) => ({
        weekStartDate: wp.weekStartDate,
        preferredSplit: wp.preferredSplit,
        targetDays: wp.targetDays,
        days: wp.days,
        createdAt: wp.createdAt,
        updatedAt: wp.updatedAt,
      })),
      checkIns: checkIns.map((ci) => ({
        trigger: ci.trigger,
        message: ci.message,
        readAt: ci.readAt ?? null,
        createdAt: ci.createdAt,
        triggerContext: ci.triggerContext ?? null,
      })),
      progressPhotos: progressPhotos.map((pp) => ({
        createdAt: pp.createdAt,
      })),
      mcpKeys: mcpKeys.map((k) => ({
        label: k.label ?? null,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt ?? null,
      })),
    };
  },
});

export const changePassword = action({
  args: {
    oldPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { oldPassword, newPassword }): Promise<void> => {
    const userId = await getAuthUserId(ctx);
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

    await ctx.runMutation(internal.accountDeletion.deleteAllUserData, { userId });
  },
});
