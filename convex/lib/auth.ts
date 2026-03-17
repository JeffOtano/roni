import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Returns the effective user ID, respecting admin impersonation.
 * If the authenticated user is an admin with impersonatingUserId set,
 * returns the impersonated user's ID instead.
 *
 * Use in queries and mutations (which have ctx.db).
 */
export async function getEffectiveUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  const authUserId = await getAuthUserId(ctx);
  if (!authUserId) return null;

  const user = await ctx.db.get(authUserId);
  if (!user) return null;

  if (user.isAdmin && user.impersonatingUserId) {
    return user.impersonatingUserId;
  }

  return authUserId;
}

/**
 * Internal query for actions to resolve the effective user ID.
 * Actions can't access ctx.db, so they call this via ctx.runQuery.
 */
export const resolveEffectiveUserId = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"users"> | null> => {
    return getEffectiveUserId(ctx);
  },
});
