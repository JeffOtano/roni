/** Maximum number of beta users allowed. Used in auth.ts and userProfiles.ts. */
export const BETA_SPOT_LIMIT = 50;

/**
 * Pure function: compute whether signups are allowed and how many spots remain.
 * Extracted for testability - both canSignUp query and createOrUpdateUser use this.
 */
export function computeBetaCapacity(profileCount: number): {
  allowed: boolean;
  spotsLeft: number;
} {
  const spotsLeft = BETA_SPOT_LIMIT - profileCount;
  return {
    allowed: spotsLeft > 0,
    spotsLeft: Math.max(0, spotsLeft),
  };
}

/**
 * Pure function: decide whether a new user creation should be blocked.
 * Returns null if allowed, or an error message string if blocked.
 */
export function shouldBlockSignup(
  existingUserId: string | undefined | null,
  profileCount: number,
): string | null {
  // Existing users can always sign in
  if (existingUserId) return null;

  const { allowed } = computeBetaCapacity(profileCount);
  if (!allowed) {
    return `Beta is full! All ${BETA_SPOT_LIMIT} free spots have been claimed. Sign up for the waitlist at our Discord.`;
  }

  return null;
}
