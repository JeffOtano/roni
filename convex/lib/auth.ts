import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Returns the authenticated user's id, or null if no user is signed in.
 *
 * Use in queries and mutations (which have ctx.db). Wraps getAuthUserId so
 * call sites can swap to a richer notion of "effective user" later without
 * touching every caller.
 */
export async function getEffectiveUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
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
