import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/** Verify the user is an admin or throw. Uses real auth, not effective. */
async function requireAdmin(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user?.isAdmin) throw new Error("Forbidden: admin access required");
  return user;
}

/** List all users for the admin impersonation dropdown. */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireAdmin(ctx, userId);

    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name ?? undefined,
      email: u.email ?? undefined,
    }));
  },
});

/** Start impersonating another user. Sets impersonatingUserId on the admin record. */
export const startImpersonating = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, { targetUserId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireAdmin(ctx, userId);

    // Verify target exists
    const target = await ctx.db.get(targetUserId);
    if (!target) throw new Error("Target user not found");

    // Prevent impersonating yourself
    if (targetUserId === userId) {
      throw new Error("Cannot impersonate yourself");
    }

    await ctx.db.patch(userId, { impersonatingUserId: targetUserId });
  },
});

/** Stop impersonating. Clears impersonatingUserId on the admin record. */
export const stopImpersonating = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireAdmin(ctx, userId);

    await ctx.db.patch(userId, { impersonatingUserId: undefined });
  },
});

/** Check current impersonation status for the authenticated (real) user. */
export const getImpersonationStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user?.isAdmin) return null;

    if (!user.impersonatingUserId) {
      return { isAdmin: true, isImpersonating: false as const, impersonatingUser: null };
    }

    const target = await ctx.db.get(user.impersonatingUserId);
    return {
      isAdmin: true,
      isImpersonating: true as const,
      impersonatingUser: target
        ? { _id: target._id, name: target.name ?? undefined, email: target.email ?? undefined }
        : null,
    };
  },
});
