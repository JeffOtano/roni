"use client";

// The 50-user beta cap was removed with the BYOK open-source release, so
// there is no capacity to count. BetaCounter and useBetaFull are retained as
// no-op exports so existing landing-page and AuthCta call sites continue to
// compile without a broader refactor.

export const DISCORD_URL = "https://discord.gg/Sa5ewWP5M";

/** Hook to check if beta is full. Always false post-BYOK. */
export function useBetaFull(): boolean {
  return false;
}

/**
 * Live counter showing remaining free beta spots. Renders nothing now that
 * capacity is unlimited; kept as an export so landing-page call sites don't
 * need to change.
 */
export function BetaCounter() {
  return null;
}
