import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { decrypt, encrypt } from "./encryption";
import { TonalApiError } from "./client";
import { refreshTonalToken } from "./auth";
import { withTonalToken } from "./proxy";

const SESSION_EXPIRED_MSG = "Tonal session expired — please reconnect at /connect-tonal";

function isTonal401(error: unknown): error is TonalApiError {
  return error instanceof TonalApiError && error.status === 401;
}

async function markExpiredAndThrow(ctx: ActionCtx, userId: Id<"users">): Promise<never> {
  await ctx.runMutation(internal.userProfiles.markTokenExpired, { userId });
  throw new Error(SESSION_EXPIRED_MSG);
}

/** Decrypt the refresh token, call Auth0, and persist the new credentials. */
async function refreshAndPersist(
  ctx: ActionCtx,
  userId: Id<"users">,
  encryptedRefreshToken: string,
): Promise<string> {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error("TOKEN_ENCRYPTION_KEY env var is not set");
  }

  const decryptedRefresh = await decrypt(encryptedRefreshToken, keyHex);
  const refreshed = await refreshTonalToken(decryptedRefresh);

  const encryptedToken = await encrypt(refreshed.idToken, keyHex);
  const encryptedNewRefresh = refreshed.refreshToken
    ? await encrypt(refreshed.refreshToken, keyHex)
    : undefined;

  await ctx.runMutation(internal.userProfiles.updateTonalToken, {
    userId,
    tonalToken: encryptedToken,
    tonalRefreshToken: encryptedNewRefresh,
    tonalTokenExpiresAt: refreshed.expiresAt,
  });

  return refreshed.idToken;
}

/**
 * Wraps a Tonal API call with automatic token refresh on 401.
 * On auth failure: refreshes the token, persists new credentials, retries once.
 * If refresh itself fails or the retry also 401s, marks the token as expired
 * so the frontend can prompt the user to reconnect.
 */
export async function withTokenRetry<T>(
  ctx: ActionCtx,
  userId: Id<"users">,
  fn: (token: string, tonalUserId: string) => Promise<T>,
): Promise<T> {
  const { token, tonalUserId } = await withTonalToken(ctx, userId);

  try {
    return await fn(token, tonalUserId);
  } catch (error) {
    if (!isTonal401(error)) {
      throw error;
    }

    const profile = await ctx.runQuery(internal.tonal.cache.getUserProfile, { userId });
    if (!profile?.tonalRefreshToken) {
      return markExpiredAndThrow(ctx, userId);
    }

    // Try to acquire refresh lock to prevent concurrent refreshes
    const lockAcquired = await ctx.runMutation(internal.userProfiles.acquireTokenRefreshLock, {
      userId,
    });
    if (!lockAcquired) {
      // Another caller is refreshing. Wait briefly and retry with potentially fresh token.
      await new Promise((r) => setTimeout(r, 2000));
      const { token: retryToken, tonalUserId: retryTonalUserId } = await withTonalToken(
        ctx,
        userId,
      );
      return fn(retryToken, retryTonalUserId);
    }

    let freshToken: string;
    try {
      freshToken = await refreshAndPersist(ctx, userId, profile.tonalRefreshToken);
    } catch {
      void ctx.runMutation(internal.userProfiles.releaseTokenRefreshLock, { userId });
      return markExpiredAndThrow(ctx, userId);
    }
    await ctx.runMutation(internal.userProfiles.releaseTokenRefreshLock, { userId });

    try {
      return await fn(freshToken, tonalUserId);
    } catch (retryError) {
      if (isTonal401(retryError)) {
        return markExpiredAndThrow(ctx, userId);
      }
      throw retryError;
    }
  }
}
