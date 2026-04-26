export const EXTERNAL_ACTIVITY_SOURCES = {
  APPLE_HEALTH: "appleHealth",
  GARMIN: "garmin",
  OTHER: "other",
} as const;

export type ExternalActivitySource =
  (typeof EXTERNAL_ACTIVITY_SOURCES)[keyof typeof EXTERNAL_ACTIVITY_SOURCES];

export const EXTERNAL_ACTIVITY_SOURCE_VALUES = [
  EXTERNAL_ACTIVITY_SOURCES.APPLE_HEALTH,
  EXTERNAL_ACTIVITY_SOURCES.GARMIN,
  EXTERNAL_ACTIVITY_SOURCES.OTHER,
] as const;

export function normalizeExternalActivitySource(source: string): ExternalActivitySource {
  const normalized = source
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  switch (normalized) {
    case "apple":
    case "applehealth":
    case "applewatch":
      return EXTERNAL_ACTIVITY_SOURCES.APPLE_HEALTH;
    case "garmin":
      return EXTERNAL_ACTIVITY_SOURCES.GARMIN;
    default:
      return EXTERNAL_ACTIVITY_SOURCES.OTHER;
  }
}
