import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { rateLimiter } from "../rateLimits";
import type { ForceRefreshResult } from "./refresh";

interface RefreshPublicDeps {
  resolveEffectiveUserId: () => Promise<Id<"users"> | null>;
  getProfile: (args: { userId: Id<"users"> }) => Promise<unknown>;
  limitRefresh: (userId: Id<"users">) => Promise<unknown>;
  forceRefreshUserData: (args: { userId: Id<"users"> }) => Promise<ForceRefreshResult>;
}

export async function refreshTonalDataWithDeps(
  deps: RefreshPublicDeps,
): Promise<ForceRefreshResult> {
  const userId = await deps.resolveEffectiveUserId();
  if (!userId) throw new Error("Not authenticated");

  const profile = await deps.getProfile({ userId });
  if (!profile) throw new Error("No Tonal profile found — connect Tonal first");

  await deps.limitRefresh(userId);

  return await deps.forceRefreshUserData({ userId });
}

export const refreshTonalData = action({
  args: {},
  handler: async (ctx): Promise<ForceRefreshResult> =>
    refreshTonalDataWithDeps({
      resolveEffectiveUserId: () => ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {}),
      getProfile: (args) => ctx.runQuery(internal.userProfiles.getByUserId, args),
      limitRefresh: (userId) =>
        rateLimiter.limit(ctx, "refreshTonalData", { key: userId, throws: true }),
      forceRefreshUserData: (args) =>
        ctx.runAction(internal.tonal.refresh.forceRefreshUserData, args),
    }),
});
