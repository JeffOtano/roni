// Beta user cap was 50 during the shared-Gemini-key phase.
// Removed as part of the BYOK open-source release:
// new users bring their own Gemini key, so there is no cost ceiling.

/**
 * Pure function: capacity is always available in the open-source release.
 * Kept as a function (rather than deleted) so the canSignUp query and any
 * frontend callers continue to compile without ad-hoc stubs.
 */
export function computeBetaCapacity(): {
  allowed: boolean;
  spotsLeft: number;
} {
  return {
    allowed: true,
    spotsLeft: Number.POSITIVE_INFINITY,
  };
}
