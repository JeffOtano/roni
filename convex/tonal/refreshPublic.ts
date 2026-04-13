import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { rateLimiter } from "../rateLimits";
import type { ForceRefreshResult } from "./refresh";

export type RefreshResult =
  | ForceRefreshResult
  | { error: "session_expired" | "not_connected" | "rate_limited" };

interface RefreshPublicDeps {
  resolveEffectiveUserId: () => Promise<Id<"users"> | null>;
  getProfile: (args: { userId: Id<"users"> }) => Promise<unknown>;
  limitRefresh: (userId: Id<"users">) => Promise<unknown>;
  forceRefreshUserData: (args: { userId: Id<"users"> }) => Promise<ForceRefreshResult>;
}

export async function refreshTonalDataWithDeps(deps: RefreshPublicDeps): Promise<RefreshResult> {
  const userId = await deps.resolveEffectiveUserId();
  if (!userId) return { error: "session_expired" };

  const profile = await deps.getProfile({ userId });
  if (!profile) return { error: "not_connected" };

  try {
    await deps.limitRefresh(userId);
  } catch {
    return { error: "rate_limited" };
  }

  return await deps.forceRefreshUserData({ userId });
}

export const refreshTonalData = action({
  args: {},
  handler: async (ctx): Promise<RefreshResult> =>
    refreshTonalDataWithDeps({
      resolveEffectiveUserId: () => ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {}),
      getProfile: (args) => ctx.runQuery(internal.userProfiles.getByUserId, args),
      limitRefresh: (userId) =>
        rateLimiter.limit(ctx, "refreshTonalData", { key: userId, throws: true }),
      forceRefreshUserData: (args) =>
        ctx.runAction(internal.tonal.refresh.forceRefreshUserData, args),
    }),
});