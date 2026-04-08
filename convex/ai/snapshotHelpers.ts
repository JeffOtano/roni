/**
 * Pure helpers for building and formatting training snapshots.
 * Extracted from context.ts for file-size hygiene.
 */

import type { ExternalActivity, Movement } from "../tonal/types";
import { ACCESSORY_MAP, type OwnedAccessories } from "../tonal/accessories";

export interface SnapshotSection {
  priority: number; // 1 = highest (dropped last), 12 = lowest (dropped first)
  lines: string[];
}

const SNAPSHOT_MAX_CHARS = 9000;
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

// Exercise catalog helpers

/** Placeholder movements that exist in the API but aren't real exercises. */
const PLACEHOLDER_NAMES = new Set([
  "Handle Move",
  "Rope Move",
  "Bar Move",
  "Bodyweight Move",
  "Roller Move",
  "Pilates Loops Move",
  "Ankle Straps Move",
]);

/** Display names for accessory grouping, keyed by OwnedAccessories field. */
const ACCESSORY_DISPLAY: Record<keyof OwnedAccessories, string> = {
  smartHandles: "Handles",
  smartBar: "Bar",
  rope: "Rope",
  roller: "Roller",
  weightBar: "Weight Bar",
  pilatesLoops: "Pilates Loops",
  ankleStraps: "Ankle Straps",
};

/**
 * Builds a compact exercise catalog section grouped by accessory type.
 * Filters out exercises requiring accessories the user doesn't own.
 * Pure function — no side effects.
 */
export function buildExerciseCatalogSection(
  movements: Movement[],
  owned: OwnedAccessories | undefined,
): SnapshotSection | null {
  const excludedAccessories = buildExcludedAccessorySet(owned);
  const grouped = groupMovementsByAccessory(movements, excludedAccessories);

  if (grouped.size === 0) return null;

  const lines: string[] = ["Available Tonal Exercises (use search_exercises for IDs):"];
  const sortedKeys = [...grouped.keys()].sort();
  for (const group of sortedKeys) {
    const names = grouped.get(group)!;
    lines.push(`  ${group}: ${names.join(", ")}`);
  }

  return { priority: 6.5, lines };
}

/** Returns a Set of OwnedAccessories keys that the user does NOT own. */
function buildExcludedAccessorySet(owned: OwnedAccessories | undefined): Set<string> {
  if (!owned) return new Set();
  const excluded = new Set<string>();
  for (const [apiName, profileKey] of Object.entries(ACCESSORY_MAP)) {
    if (!owned[profileKey]) excluded.add(apiName);
  }
  return excluded;
}

/** Groups movement names by accessory display name, filtering excluded accessories. */
function groupMovementsByAccessory(
  movements: Movement[],
  excludedAccessories: Set<string>,
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const m of movements) {
    if (m.publishState !== "published") continue;
    if (PLACEHOLDER_NAMES.has(m.name)) continue;

    const apiAccessory = m.onMachineInfo?.accessory;
    if (apiAccessory && excludedAccessories.has(apiAccessory)) continue;

    const groupName = resolveGroupName(apiAccessory);
    const list = grouped.get(groupName) ?? [];
    list.push(m.name);
    grouped.set(groupName, list);
  }

  // Sort names alphabetically within each group
  for (const [key, names] of grouped) {
    grouped.set(key, [...new Set(names)].sort());
  }

  return grouped;
}

/** Maps an API accessory string to a display group name. */
function resolveGroupName(apiAccessory: string | undefined): string {
  if (!apiAccessory) return "Bodyweight";
  const profileKey = ACCESSORY_MAP[apiAccessory];
  if (!profileKey) return apiAccessory;
  return ACCESSORY_DISPLAY[profileKey];
}

/** Compute age in years from an ISO date-of-birth string. Returns null if invalid. */
export function computeAge(dateOfBirth: string | undefined, now: Date): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
