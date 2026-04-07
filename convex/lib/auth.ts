import { getAuthUserId } from "@convex-dev/auth/server";
import { internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function getEffectiveUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  return await getAuthUserId(ctx);
}

export const resolveEffectiveUserId = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"users"> | null> => {
    return getEffectiveUserId(ctx);
  },
});
