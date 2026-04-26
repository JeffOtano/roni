/**
 * Pure helpers for building and formatting training snapshots.
 * Extracted from context.ts for file-size hygiene.
 */

import type { ExternalActivity } from "../tonal/types";

export interface SnapshotSection {
  priority: number; // 1 = highest (dropped last), 12 = lowest (dropped first)
  lines: string[];
}

const SNAPSHOT_MAX_CHARS = 9000;
const WORKOUT_TYPE_ACRONYMS = new Set(["GPS", "HIIT", "HRV"]);
export { SNAPSHOT_MAX_CHARS };

export function trimSnapshot(sections: SnapshotSection[], maxChars: number): string {
  const header = "=== TRAINING SNAPSHOT ===";
  const footer = "=== END SNAPSHOT ===";
  const fixedLen = header.length + footer.length + 2; // 2 newlines

  // Sort by priority ascending (highest priority = lowest number = kept first)
  const sorted = [...sections].sort((a, b) => a.priority - b.priority);

  const included: SnapshotSection[] = [];
  let currentLen = fixedLen;

  for (const section of sorted) {
    const sectionLen = section.lines.join("\n").length + 1; // +1 for joining newline
    if (currentLen + sectionLen <= maxChars) {
      included.push(section);
      currentLen += sectionLen;
    }
  }

  // Re-sort included by priority to maintain logical order
  included.sort((a, b) => a.priority - b.priority);

  const body = included.flatMap((s) => s.lines).join("\n");
  return [header, body, footer].filter(Boolean).join("\n");
}

// External activity helpers

export function getHrIntensityLabel(hr: number): string | null {
  if (hr === 0) return null;
  if (hr < 100) return "light";
  if (hr <= 130) return "moderate";
  return "vigorous";
}

export function capitalizeWorkoutType(workoutType: string): string {
  return workoutType
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])|([A-Z])([A-Z])(?=[a-z])/g, "$1$3 $2$4")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      WORKOUT_TYPE_ACRONYMS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

export function formatExternalActivityLine(a: ExternalActivity): string {
  const type = capitalizeWorkoutType(a.workoutType);
  const mins = Math.round(a.totalDuration / 60);
  const date = a.beginTime.split("T")[0];

  let line = `  ${date} — ${type} (${a.source}) | ${mins}min`;
  if (a.totalCalories !== undefined && a.totalCalories > 0) {
    line += ` | ${Math.round(a.totalCalories)} cal`;
  }
  if (a.distance !== undefined && a.distance > 0) {
    const miles = (a.distance / 1609.34).toFixed(1);
    line += ` | ${miles} mi`;
  }
  if (a.averageHeartRate !== undefined && a.averageHeartRate > 0) {
    const hrLabel = getHrIntensityLabel(a.averageHeartRate);
    if (hrLabel) {
      line += ` | Avg HR ${Math.round(a.averageHeartRate)} (${hrLabel})`;
    }
  }
  return line;
}

/**
 * Compute age from a YYYY-MM-DD DOB string. Parses components directly
 * to avoid UTC-midnight timezone drift from `new Date(dob)`.
 */
export function computeAge(dateOfBirth: string | undefined, now: Date): number | null {
  if (!dateOfBirth) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;
  const dobYear = Number(match[1]);
  const dobMonth = Number(match[2]);
  const dobDay = Number(match[3]);

  // Validate the date is real (rejects Feb 30, etc.)
  const check = new Date(dobYear, dobMonth - 1, dobDay);
  if (
    check.getFullYear() !== dobYear ||
    check.getMonth() !== dobMonth - 1 ||
    check.getDate() !== dobDay
  ) {
    return null;
  }

  let age = now.getFullYear() - dobYear;
  const monthDiff = now.getMonth() + 1 - dobMonth;
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dobDay)) {
    age--;
  }
  return age;
}
