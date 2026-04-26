const SECONDS_PER_HOUR = 60 * 60;
export const GARMIN_WELLNESS_SNAPSHOT_ROW_LIMIT = 7;

export interface GarminWellnessSnapshotRow {
  calendarDate: string;
  sleepDurationSeconds?: number;
  sleepScore?: number;
  hrvLastNightAvg?: number;
  avgStress?: number;
  bodyBatteryHighestValue?: number;
  bodyBatteryLowestValue?: number;
  restingHeartRate?: number;
  avgSpo2?: number;
  avgRespirationRate?: number;
  skinTempDeviationCelsius?: number;
}

function formatHours(seconds: number): string {
  return `${Math.round((seconds / SECONDS_PER_HOUR) * 10) / 10}h`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatGarminWellnessLines(rows: readonly GarminWellnessSnapshotRow[]): string[] {
  const lines = ["Garmin Recovery Signals:"];

  for (const row of rows.slice(0, GARMIN_WELLNESS_SNAPSHOT_ROW_LIMIT)) {
    const parts: string[] = [];
    if (row.sleepDurationSeconds !== undefined) {
      parts.push(`sleep ${formatHours(row.sleepDurationSeconds)}`);
    }
    if (row.sleepScore !== undefined) {
      parts.push(`sleep score ${Math.round(row.sleepScore)}`);
    }
    if (row.hrvLastNightAvg !== undefined) {
      parts.push(`HRV ${Math.round(row.hrvLastNightAvg)}ms`);
    }
    if (row.avgStress !== undefined) {
      parts.push(`stress ${Math.round(row.avgStress)}`);
    }
    if (row.bodyBatteryLowestValue !== undefined || row.bodyBatteryHighestValue !== undefined) {
      parts.push(
        `body battery ${row.bodyBatteryLowestValue ?? "?"}-${row.bodyBatteryHighestValue ?? "?"}`,
      );
    }
    if (row.restingHeartRate !== undefined) {
      parts.push(`RHR ${Math.round(row.restingHeartRate)}`);
    }
    if (row.avgSpo2 !== undefined) {
      parts.push(`SpO2 ${Math.round(row.avgSpo2)}%`);
    }
    if (row.avgRespirationRate !== undefined) {
      parts.push(`resp ${formatNumber(row.avgRespirationRate)}/min`);
    }
    if (row.skinTempDeviationCelsius !== undefined) {
      const sign = row.skinTempDeviationCelsius > 0 ? "+" : "";
      parts.push(`skin temp ${sign}${formatNumber(row.skinTempDeviationCelsius)}C`);
    }

    if (parts.length > 0) {
      lines.push(`  ${row.calendarDate} | ${parts.join(" | ")}`);
    }
  }

  if (lines.length === 1) {
    return [];
  }

  lines.push(
    "  Use poor sleep, low HRV, high stress, low body battery, elevated resting HR, or higher skin temperature to bias toward recovery or reduced volume.",
  );
  return lines;
}
