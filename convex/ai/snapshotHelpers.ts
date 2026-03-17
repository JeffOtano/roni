/**
 * Pure helpers for building and formatting training snapshots.
 * Extracted from context.ts for file-size hygiene.
 */

import type { ExternalActivity } from "../tonal/types";

export interface SnapshotSection {
  priority: number; // 1 = highest (dropped last), 12 = lowest (dropped first)
  lines: string[];
}

const SNAPSHOT_MAX_CHARS = 4000;
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

// ---------------------------------------------------------------------------
// External activity helpers
// ---------------------------------------------------------------------------

export function getHrIntensityLabel(hr: number): string | null {
  if (hr === 0) return null;
  if (hr < 100) return "light";
  if (hr <= 130) return "moderate";
  return "vigorous";
}

export function capitalizeWorkoutType(workoutType: string): string {
  return workoutType
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatExternalActivityLine(a: ExternalActivity): string {
  const type = capitalizeWorkoutType(a.workoutType);
  const mins = Math.round(a.totalDuration / 60);
  const cal = Math.round(a.totalCalories);
  const date = a.beginTime.split("T")[0];

  let line = `  ${date} — ${type} (${a.source}) | ${mins}min | ${cal} cal`;
  if (a.distance > 0) {
    const miles = (a.distance / 1609.34).toFixed(1);
    line += ` | ${miles} mi`;
  }
  const hrLabel = getHrIntensityLabel(a.averageHeartRate);
  if (hrLabel) {
    line += ` | Avg HR ${Math.round(a.averageHeartRate)} (${hrLabel})`;
  }
  return line;
}
