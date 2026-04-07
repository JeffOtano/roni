// BYOK (bring-your-own-key) grandfathering gate.
//
// Users whose _creationTime is before BYOK_REQUIRED_AFTER are grandfathered
// on the shared Gemini key (set via GOOGLE_GENERATIVE_AI_API_KEY env var).
//
// Users whose _creationTime is at or after BYOK_REQUIRED_AFTER must provide
// their own Gemini API key via the onboarding flow before they can use chat.
//
// IMPORTANT: BYOK_REQUIRED_AFTER below is a placeholder value (year 2286)
// so that all current users and test fixtures are grandfathered during
// development. On launch day, the cutover sequence replaces this with
// Date.now() immediately before deploying to prod. See Phase 8 of
// docs/superpowers/plans/2026-04-07-open-source-release.md.
export const BYOK_REQUIRED_AFTER = 9999999999999;

/**
 * Returns true if a user with the given creation time must provide
 * their own Gemini API key, false if they are grandfathered on the
 * shared house key.
 */
export function isBYOKRequired(creationTime: number): boolean {
  return creationTime >= BYOK_REQUIRED_AFTER;
}
