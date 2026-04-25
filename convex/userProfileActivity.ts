import type { WithoutSystemFields } from "convex/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

type ActivityRow = WithoutSystemFields<Doc<"userProfileActivity">>;

export type UserActivityPatch = {
  [K in keyof Omit<ActivityRow, "userId">]?: ActivityRow[K] | undefined;
};

/**
 * Upserts the `userProfileActivity` row for `userId`. On an existing row,
 * `undefined` clears a field (Convex `db.patch` semantics — used by
 * `releaseTokenRefreshLock`). On insert, undefined keys are dropped so a new
 * row contains only the fields the caller explicitly set.
 */
export async function patchUserActivity(
  ctx: MutationCtx,
  userId: Id<"users">,
  patch: UserActivityPatch,
): Promise<void> {
  const existing = await ctx.db
    .query("userProfileActivity")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return;
  }
  const insertPayload: ActivityRow = {
    userId,
    ...(patch.lastActiveAt !== undefined && { lastActiveAt: patch.lastActiveAt }),
    ...(patch.appLastActiveAt !== undefined && { appLastActiveAt: patch.appLastActiveAt }),
    ...(patch.syncStatus !== undefined && { syncStatus: patch.syncStatus }),
    ...(patch.lastSyncedActivityDate !== undefined && {
      lastSyncedActivityDate: patch.lastSyncedActivityDate,
    }),
    ...(patch.tokenRefreshInProgress !== undefined && {
      tokenRefreshInProgress: patch.tokenRefreshInProgress,
    }),
  };
  await ctx.db.insert("userProfileActivity", insertPayload);
}
