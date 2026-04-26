interface BackfillResult {
  accepted: readonly string[];
  rateLimited?: readonly { summaryType: string; retryAfterSeconds?: number }[];
  rejected: readonly { summaryType: string; status: number }[];
}

const SUMMARY_LABELS: Record<string, string> = {
  activities: "activities",
  dailies: "daily wellness",
  sleeps: "sleep",
  stressDetails: "stress",
  hrv: "HRV",
  userMetrics: "fitness metrics",
  pulseOx: "SpO2",
  respiration: "respiration",
  skinTemp: "skin temperature",
};

function labelSummary(summaryType: string): string {
  return SUMMARY_LABELS[summaryType] ?? summaryType;
}

function joinLabels(values: readonly string[]): string {
  return values.map(labelSummary).join(", ");
}

function formatRetryWindow(rateLimited: NonNullable<BackfillResult["rateLimited"]>): string {
  const retryAfterSeconds = Math.max(
    0,
    ...rateLimited.map((entry) => entry.retryAfterSeconds ?? 0),
  );
  if (retryAfterSeconds <= 0) return "later";
  if (retryAfterSeconds < 60) return `in about ${retryAfterSeconds}s`;
  return `in about ${Math.ceil(retryAfterSeconds / 60)}m`;
}

type GarminBackfillNotice =
  | { kind: "success"; message: string }
  | { kind: "warning"; message: string }
  | { kind: "error"; message: string };

export function formatGarminBackfillNotice(
  days: number,
  result: BackfillResult,
): GarminBackfillNotice {
  const parts: string[] = [];
  const rateLimited = result.rateLimited ?? [];

  if (result.accepted.length > 0) {
    parts.push(
      `Queued ${days}d Garmin sync for ${joinLabels(result.accepted)}. Data will arrive over the next few minutes.`,
    );
  }

  if (rateLimited.length > 0) {
    parts.push(
      `Garmin rate-limited ${joinLabels(
        rateLimited.map((entry) => entry.summaryType),
      )}; try those details again ${formatRetryWindow(rateLimited)}.`,
    );
  }

  if (result.rejected.length > 0) {
    parts.push(
      `Could not queue ${result.rejected
        .map((entry) => `${labelSummary(entry.summaryType)} (${entry.status})`)
        .join(", ")}.`,
    );
  }

  if (parts.length === 0) {
    return {
      kind: "warning",
      message: "Garmin accepted the request, but no summary types reported a queued status.",
    };
  }

  if (result.accepted.length > 0 && (rateLimited.length > 0 || result.rejected.length > 0)) {
    return { kind: "warning", message: parts.join(" ") };
  }

  if (result.accepted.length > 0) {
    return { kind: "success", message: parts.join(" ") };
  }

  return { kind: "error", message: parts.join(" ") };
}
