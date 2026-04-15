import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function isDeletionInProgress(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  return !user || user.deletionInProgress === true;
}

export async function getEffectiveUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  if (await isDeletionInProgress(ctx, userId)) return null;
  return userId;
}

export const resolveEffectiveUserId = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"users"> | null> => {
    return getEffectiveUserId(ctx);
  },
});

export const getDeletionInProgress = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await isDeletionInProgress(ctx, userId);
  },
});
