import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Find orphaned auth accounts - emails that exist in authAccounts
 * but have no corresponding userProfile (signup failed mid-way).
 */
export const findOrphanedAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const authAccounts = await ctx.db.query("authAccounts").collect();
    const users = await ctx.db.query("users").collect();
    const userProfiles = await ctx.db.query("userProfiles").collect();

    const profileUserIds = new Set(userProfiles.map((p) => p.userId.toString()));

    const orphaned: Array<{
      authAccountId: string;
      userId: string;
      email: string | undefined;
      hasProfile: boolean;
    }> = [];

    for (const account of authAccounts) {
      const user = users.find((u) => u._id === account.userId);
      const hasProfile = profileUserIds.has(account.userId.toString());

      if (!hasProfile) {
        orphaned.push({
          authAccountId: account._id.toString(),
          userId: account.userId.toString(),
          email: user?.email ?? undefined,
          hasProfile,
        });
      }
    }

    return {
      totalAuthAccounts: authAccounts.length,
      totalUsers: users.length,
      totalProfiles: userProfiles.length,
      orphanedCount: orphaned.length,
      orphaned,
    };
  },
});

/**
 * Delete an orphaned auth account and its associated user entry.
 * Use after confirming the account is truly orphaned via findOrphanedAccounts.
 */
export const deleteOrphanedAccount = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Delete auth accounts for this user
    const authAccounts = await ctx.db
      .query("authAccounts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const account of authAccounts) {
      await ctx.db.delete(account._id);
    }

    // Delete auth sessions for this user
    const sessions = await ctx.db
      .query("authSessions")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const session of sessions) {
      // Delete refresh tokens for this session
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .filter((q) => q.eq(q.field("sessionId"), session._id))
        .collect();
      for (const token of tokens) {
        await ctx.db.delete(token._id);
      }
      await ctx.db.delete(session._id);
    }

    // Delete the user entry
    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.delete(userId);
    }

    return {
      deleted: {
        authAccounts: authAccounts.length,
        sessions: sessions.length,
        user: user ? 1 : 0,
      },
    };
  },
});
