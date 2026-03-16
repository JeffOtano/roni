/**
 * Tonal accessory mapping and equipment filtering utilities.
 *
 * Maps Tonal API accessory strings (from Movement.onMachineInfo.accessory)
 * to user equipment profile fields, and provides a helper to compute
 * which accessories to exclude during exercise selection.
 */

/** User's owned accessories profile shape. */
export interface OwnedAccessories {
  smartHandles: boolean;
  smartBar: boolean;
  rope: boolean;
  roller: boolean;
  weightBar: boolean;
  pilatesLoops: boolean;
  ankleStraps: boolean;
}

/** Maps Tonal API accessory string values to OwnedAccessories keys. */
export const ACCESSORY_MAP: Record<string, keyof OwnedAccessories> = {
  "Smart Handles": "smartHandles",
  Handle: "smartHandles",
  Handles: "smartHandles",
  "Smart Bar": "smartBar",
  StraightBar: "smartBar",
  Bar: "smartBar",
  Rope: "rope",
  Roller: "roller",
  "Weight Bar": "weightBar",
  Barbell: "weightBar",
  "Pilates Loops": "pilatesLoops",
  PilatesLoops: "pilatesLoops",
  AnkleStraps: "ankleStraps",
};

/**
 * Given a user's owned accessories, returns the list of Tonal API accessory
 * strings that should be excluded from exercise selection.
 *
 * If no profile is provided (undefined), returns empty array (all equipment assumed available).
 */
export function computeExcludedAccessories(owned: OwnedAccessories | undefined): string[] {
  if (!owned) return [];

  const excluded: string[] = [];

  for (const [apiName, profileKey] of Object.entries(ACCESSORY_MAP)) {
    if (!owned[profileKey]) {
      excluded.push(apiName);
    }
  }

  return excluded;
}
