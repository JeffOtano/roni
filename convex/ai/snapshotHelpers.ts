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

// ---------------------------------------------------------------------------
// Exercise catalog helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Health snapshot helpers
// ---------------------------------------------------------------------------

/** Minimal shape of a health snapshot document for the summary builder. */
export interface HealthSnapshotData {
  date: string;
  syncedAt: number;
  steps?: number;
  activeEnergyBurned?: number;
  exerciseMinutes?: number;
  sleepDurationMinutes?: number;
  sleepDeepMinutes?: number;
  sleepRemMinutes?: number;
  sleepCoreMinutes?: number;
  sleepStartTime?: string;
  sleepEndTime?: string;
  restingHeartRate?: number;
  hrvSDNN?: number;
  vo2Max?: number;
  bodyMass?: number;
  dietaryCalories?: number;
  dietaryProteinGrams?: number;
}

const TREND_THRESHOLD = 0.05; // 5% change to classify as up/down

function trendLabel(current: number, avg: number): string {
  if (avg === 0) return "stable";
  const ratio = (current - avg) / Math.abs(avg);
  if (ratio > TREND_THRESHOLD) return "trending up";
  if (ratio < -TREND_THRESHOLD) return "trending down";
  return "stable";
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function formatMinutesAsHm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function formatTimeShort(isoTime: string): string {
  // Extract HH:MM from ISO or HH:MM:SS string
  const match = isoTime.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : isoTime;
}

/**
 * Builds the "Health & Recovery" snapshot section from Apple Health data.
 * Returns null if no meaningful data exists. Pure function.
 */
export function buildHealthSection(
  snapshots: HealthSnapshotData[],
  now: Date,
): SnapshotSection | null {
  if (snapshots.length === 0) return null;

  // Snapshots arrive newest-first from the query
  const today = snapshots[0];
  const lines: string[] = [];

  // Activity line (today)
  const activityParts: string[] = [];
  if (today.steps != null) activityParts.push(`${today.steps.toLocaleString()} steps`);
  if (today.activeEnergyBurned != null)
    activityParts.push(`${Math.round(today.activeEnergyBurned)} kcal active`);
  if (today.exerciseMinutes != null)
    activityParts.push(`${Math.round(today.exerciseMinutes)} min exercise`);
  if (activityParts.length > 0) {
    lines.push(`  Today: ${activityParts.join(" | ")}`);
  }

  // Sleep line (last night = today's snapshot typically holds last night's sleep)
  const sleepParts: string[] = [];
  if (today.sleepDurationMinutes != null) {
    sleepParts.push(formatMinutesAsHm(today.sleepDurationMinutes) + " sleep");
    const breakdownParts: string[] = [];
    if (today.sleepDeepMinutes != null)
      breakdownParts.push(`${Math.round(today.sleepDeepMinutes)}m deep`);
    if (today.sleepRemMinutes != null)
      breakdownParts.push(`${Math.round(today.sleepRemMinutes)}m REM`);
    if (today.sleepCoreMinutes != null)
      breakdownParts.push(`${Math.round(today.sleepCoreMinutes)}m core`);
    if (breakdownParts.length > 0) {
      sleepParts.push(`(${breakdownParts.join(", ")})`);
    }
  }
  if (today.sleepStartTime && today.sleepEndTime) {
    sleepParts.push(
      `Bed ${formatTimeShort(today.sleepStartTime)} -> ${formatTimeShort(today.sleepEndTime)}`,
    );
  }
  if (sleepParts.length > 0) {
    lines.push(`  Last night: ${sleepParts.join(" | ")}`);
  }

  // Heart line
  const heartParts: string[] = [];
  if (today.restingHeartRate != null)
    heartParts.push(`RHR ${Math.round(today.restingHeartRate)} bpm`);
  if (today.hrvSDNN != null) {
    const hrvValues = snapshots.map((s) => s.hrvSDNN).filter((v): v is number => v != null);
    const hrvAvg = avg(hrvValues);
    const trend = hrvValues.length >= 3 ? trendLabel(today.hrvSDNN, hrvAvg) : "";
    let hrvStr = `HRV ${Math.round(today.hrvSDNN)}ms`;
    if (hrvValues.length >= 3) {
      hrvStr += ` (7-day avg: ${Math.round(hrvAvg)}ms, ${trend})`;
    }
    heartParts.push(hrvStr);
  }
  if (today.vo2Max != null) heartParts.push(`VO2 Max ${today.vo2Max.toFixed(1)}`);
  if (heartParts.length > 0) {
    lines.push(`  Heart: ${heartParts.join(" | ")}`);
  }

  // Body line
  const bodyParts: string[] = [];
  if (today.bodyMass != null) {
    const weightValues = snapshots.map((s) => s.bodyMass).filter((v): v is number => v != null);
    const weightAvg = avg(weightValues);
    const diff = weightValues.length >= 2 ? today.bodyMass - weightAvg : 0;
    let weightStr = `${today.bodyMass.toFixed(1)} kg`;
    if (weightValues.length >= 2 && Math.abs(diff) >= 0.1) {
      const sign = diff > 0 ? "+" : "";
      weightStr += ` (7-day trend: ${sign}${diff.toFixed(1)} kg)`;
    }
    bodyParts.push(weightStr);
  }
  if (bodyParts.length > 0) {
    lines.push(`  Body: ${bodyParts.join(" | ")}`);
  }

  // Nutrition line
  const nutritionParts: string[] = [];
  if (today.dietaryCalories != null)
    nutritionParts.push(`${Math.round(today.dietaryCalories)} kcal`);
  if (today.dietaryProteinGrams != null)
    nutritionParts.push(`${Math.round(today.dietaryProteinGrams)}g protein`);
  if (nutritionParts.length > 0) {
    lines.push(`  Nutrition: ${nutritionParts.join(" | ")}`);
  }

  // Recovery signals
  const signals: string[] = [];

  // HRV declining 3+ consecutive days
  const hrvSequence = snapshots
    .slice(0, 4)
    .map((s) => s.hrvSDNN)
    .filter((v): v is number => v != null);
  if (hrvSequence.length >= 3) {
    let declining = true;
    for (let i = 0; i < hrvSequence.length - 1; i++) {
      // snapshots are newest-first, so declining means each older value is higher
      if (hrvSequence[i] >= hrvSequence[i + 1]) {
        declining = false;
        break;
      }
    }
    if (declining) signals.push("HRV declining " + hrvSequence.length + " days");
  }

  // Sleep <7h for 2+ of last 3 nights
  const recentSleep = snapshots
    .slice(0, 3)
    .map((s) => s.sleepDurationMinutes)
    .filter((v): v is number => v != null);
  const shortNights = recentSleep.filter((m) => m < 7 * 60).length;
  if (shortNights >= 2) {
    signals.push(`sleep below 7h ${shortNights} of last ${recentSleep.length} nights`);
  }

  // RHR elevated 5+ BPM above average
  if (today.restingHeartRate != null) {
    const rhrValues = snapshots
      .map((s) => s.restingHeartRate)
      .filter((v): v is number => v != null);
    const rhrAvg = avg(rhrValues);
    if (rhrValues.length >= 3 && today.restingHeartRate >= rhrAvg + 5) {
      signals.push(`RHR elevated ${Math.round(today.restingHeartRate - rhrAvg)} bpm above avg`);
    }
  }

  // Weight drop >1kg/week
  if (today.bodyMass != null) {
    const weightValues = snapshots.map((s) => s.bodyMass).filter((v): v is number => v != null);
    if (weightValues.length >= 3) {
      const oldest = weightValues[weightValues.length - 1];
      if (oldest - today.bodyMass > 1) {
        signals.push(`weight drop >${(oldest - today.bodyMass).toFixed(1)} kg this week`);
      }
    }
  }

  if (signals.length > 0) {
    lines.push(`  Recovery signals: ${signals.join(", ")}`);
  }

  // If no data lines were generated, omit entirely
  if (lines.length === 0) return null;

  // Stale data warning
  const latestSyncedAt = Math.max(...snapshots.map((s) => s.syncedAt));
  const hoursSinceSync = (now.getTime() - latestSyncedAt) / (1000 * 60 * 60);
  let header = "HEALTH & RECOVERY (from Apple Health):";
  if (hoursSinceSync > 24) {
    const daysSinceSync = Math.round(hoursSinceSync / 24);
    header += ` (last synced ${daysSinceSync} day${daysSinceSync === 1 ? "" : "s"} ago)`;
  }

  return { priority: 8.5, lines: [header, ...lines] };
}
