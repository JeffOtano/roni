/**
 * Returns the browser's IANA timezone (e.g. "America/Los_Angeles"), or
 * undefined if unavailable. Safe to call on the server — returns undefined
 * there. Pass the result to Convex actions that format recency-sensitive
 * coach context so "today"/"yesterday" match the user's local wall clock.
 */
export function getBrowserTimezone(): string | undefined {
  if (typeof Intl === "undefined") return undefined;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || undefined;
  } catch {
    return undefined;
  }
}
