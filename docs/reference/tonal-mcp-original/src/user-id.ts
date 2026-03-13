import { tonal } from "./api-client.js";

let cachedUserId: string | null = null;

/**
 * Returns the authenticated user's Tonal UUID.
 * Calls /v6/users/userinfo once and caches the result.
 */
export async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const info = await tonal.get<{ id: string }>("/v6/users/userinfo");
  cachedUserId = info.id;
  return cachedUserId;
}

/**
 * Resolves a userId parameter: uses the provided value, or falls back to the authenticated user.
 */
export async function resolveUserId(userId: string | undefined): Promise<string> {
  if (userId) return userId;
  return getUserId();
}
