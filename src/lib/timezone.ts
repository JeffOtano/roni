/** Returns the browser's IANA timezone, or undefined on the server. */
export function getBrowserTimezone(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || undefined;
  } catch {
    return undefined;
  }
}
