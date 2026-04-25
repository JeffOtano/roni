import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

export type UserActivityPatch = Partial<{
  lastActiveAt: number;
  appLastActiveAt: number;
  syncStatus: "syncing" | "complete" | "failed";
  lastSyncedActivityDate: string;
  tokenRefreshInProgress: number | undefined;
}>;

type ActivityRow = Omit<Doc<"userProfileActivity">, "_id" | "_creationTime">;

/**
 * Idempotently ensure the `userProfileActivity` row exists for `userId` and
 * patch it with the supplied fields. Used by every dual-writer that updates
 * a high-churn field still living on `userProfiles`. Passing `undefined` for
 * a key on an existing row clears that field; on insert, undefined keys are
 * dropped so the new doc only contains explicitly-provided fields.
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
