import { describe, expect, it } from "vitest";
import { ACCESSORY_MAP } from "./accessories";
import { mapApiToDoc, mapDocToMovement } from "./movementMapping";
import type { Movement } from "./types";

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

function makeApiMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "move-123",
    name: "Bench Press",
    shortName: "Bench Press",
    muscleGroups: ["Chest", "Triceps"],
    inFreeLift: false,
    onMachine: true,
    countReps: true,
    isTwoSided: false,
    isBilateral: true,
    isAlternating: false,
    descriptionHow: "Lie on bench, press handles up",
    descriptionWhy: "Build chest and tricep strength",
    skillLevel: 3,
    publishState: "published",
    sortOrder: 100,
    thumbnailMediaUrl: "https://cdn.tonal.com/bench.jpg",
    onMachineInfo: {
      accessory: "Smart Handles",
      resistanceType: "cable",
      spotterDisabled: false,
      eccentricDisabled: false,
      chainsDisabled: false,
      burnoutDisabled: false,
    },
    ...overrides,
  };
}

function makeDbDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: "doc-123" as never,
    _creationTime: 1000,
    tonalId: "move-123",
    name: "Bench Press",
    shortName: "Bench Press",
    muscleGroups: ["Chest", "Triceps"],
    skillLevel: 3,
    publishState: "published",
    sortOrder: 100,
    onMachine: true,
    inFreeLift: false,
    countReps: true,
    isTwoSided: false,
    isBilateral: true,
    isAlternating: false,
    descriptionHow: "Lie on bench, press handles up",
    descriptionWhy: "Build chest and tricep strength",
    thumbnailMediaUrl: "https://cdn.tonal.com/bench.jpg",
    accessory: "Smart Handles",
    onMachineInfo: { accessory: "Smart Handles" },
    lastSyncedAt: 1000,
    trainingTypes: ["strength"],
    bodyRegion: "Upper",
    bodyRegionDisplay: "Upper Body",
    pushPull: "Push",
    family: "Press",
    familyDisplay: "Pressing",
    imageAssetId: "abc-123",
    tonalCreatedAt: "2025-01-01T00:00:00Z",
    tonalUpdatedAt: "2025-06-01T00:00:00Z",
    ...overrides,
  } as never;
}

// ---------------------------------------------------------------------------
// mapApiToDoc
// ---------------------------------------------------------------------------

describe("mapApiToDoc", () => {
  it("maps all required fields from API response to DB document", () => {
    const m = makeApiMovement();
    const now = Date.now();
    const doc = mapApiToDoc(m, now);

    expect(doc.tonalId).toBe("move-123");
    expect(doc.name).toBe("Bench Press");
    expect(doc.accessory).toBe("Smart Handles");
    expect(doc.lastSyncedAt).toBe(now);
    expect(doc.onMachine).toBe(true);
    expect(doc.muscleGroups).toEqual(["Chest", "Triceps"]);
  });

  it("falls back to name when shortName is missing", () => {
    const m = makeApiMovement({ shortName: undefined as unknown as string });
    const doc = mapApiToDoc(m, Date.now());

    expect(doc.shortName).toBe("Bench Press");
  });

  it("defaults muscleGroups to empty array when missing", () => {
    const m = makeApiMovement({ muscleGroups: undefined as unknown as string[] });
    const doc = mapApiToDoc(m, Date.now());

    expect(doc.muscleGroups).toEqual([]);
  });

  it("extracts accessory from onMachineInfo", () => {
    const m = makeApiMovement();
    const doc = mapApiToDoc(m, Date.now());

    expect(doc.accessory).toBe("Smart Handles");
  });

  it("returns undefined accessory when onMachineInfo is absent", () => {
    const m = makeApiMovement({ onMachineInfo: undefined });
    const doc = mapApiToDoc(m, Date.now());

    expect(doc.accessory).toBeUndefined();
  });

  it("renames createdAt/updatedAt to tonalCreatedAt/tonalUpdatedAt", () => {
    const m = makeApiMovement({
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-06-01T00:00:00Z",
    });
    const doc = mapApiToDoc(m, Date.now());

    expect(doc.tonalCreatedAt).toBe("2025-01-01T00:00:00Z");
    expect(doc.tonalUpdatedAt).toBe("2025-06-01T00:00:00Z");
    expect("createdAt" in doc).toBe(false);
    expect("updatedAt" in doc).toBe(false);
  });

  it("coerces null optional string fields to undefined", () => {
    const m = makeApiMovement({
      baseOfSupport: null as unknown as string,
      bodyRegion: null as unknown as string,
      family: null as unknown as string,
      pushPull: null as unknown as string,
      imageAssetId: null as unknown as string,
      thumbnailMediaUrl: null as unknown as string,
    });
    const doc = mapApiToDoc(m, Date.now());

    expect(doc.baseOfSupport).toBeUndefined();
    expect(doc.bodyRegion).toBeUndefined();
    expect(doc.family).toBeUndefined();
    expect(doc.pushPull).toBeUndefined();
    expect(doc.imageAssetId).toBeUndefined();
    expect(doc.thumbnailMediaUrl).toBeUndefined();
  });

  it("coerces null array and object fields to undefined", () => {
    const m = makeApiMovement({
      featureGroupIds: null,
      compatibilityStatus: null as unknown as Movement["compatibilityStatus"],
      relatedGenericMovementIDs: null as unknown as string[],
      offMachineAccessories: null,
    });
    const doc = mapApiToDoc(m, Date.now());

    expect(doc.featureGroupIds).toBeUndefined();
    expect(doc.compatibilityStatus).toBeUndefined();
    expect(doc.relatedGenericMovementIDs).toBeUndefined();
    expect(doc.offMachineAccessories).toBeUndefined();
  });

  it("coerces null boolean and number fields to undefined", () => {
    const m = makeApiMovement({
      hiddenInMovePicker: null as unknown as boolean,
      hideReps: null as unknown as boolean,
      isGeneric: null as unknown as boolean,
      secondsPerRep: null as unknown as number,
    });
    const doc = mapApiToDoc(m, Date.now());

    expect(doc.hiddenInMovePicker).toBeUndefined();
    expect(doc.hideReps).toBeUndefined();
    expect(doc.isGeneric).toBeUndefined();
    expect(doc.secondsPerRep).toBeUndefined();
  });

  it("preserves defined optional values", () => {
    const m = makeApiMovement({
      baseOfSupport: "Bilateral",
      bodyRegion: "Upper",
      family: "Press",
      pushPull: "Push",
      imageAssetId: "abc-123",
      secondsPerRep: 3,
      hiddenInMovePicker: false,
      isGeneric: true,
    });
    const doc = mapApiToDoc(m, Date.now());

    expect(doc.baseOfSupport).toBe("Bilateral");
    expect(doc.bodyRegion).toBe("Upper");
    expect(doc.family).toBe("Press");
    expect(doc.pushPull).toBe("Push");
    expect(doc.imageAssetId).toBe("abc-123");
    expect(doc.secondsPerRep).toBe(3);
    expect(doc.hiddenInMovePicker).toBe(false);
    expect(doc.isGeneric).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mapDocToMovement
// ---------------------------------------------------------------------------

describe("mapDocToMovement", () => {
  it("maps tonalId back to id", () => {
    const movement = mapDocToMovement(makeDbDoc());

    expect(movement.id).toBe("move-123");
    expect("tonalId" in movement).toBe(false);
  });

  it("maps tonalCreatedAt/tonalUpdatedAt back to createdAt/updatedAt", () => {
    const movement = mapDocToMovement(makeDbDoc());

    expect(movement.createdAt).toBe("2025-01-01T00:00:00Z");
    expect(movement.updatedAt).toBe("2025-06-01T00:00:00Z");
  });

  it("includes trainingTypes from doc", () => {
    const movement = mapDocToMovement(makeDbDoc({ trainingTypes: ["strength", "hypertrophy"] }));

    expect(movement.trainingTypes).toEqual(["strength", "hypertrophy"]);
  });

  it("maps all extended fields", () => {
    const movement = mapDocToMovement(makeDbDoc());

    expect(movement.bodyRegion).toBe("Upper");
    expect(movement.bodyRegionDisplay).toBe("Upper Body");
    expect(movement.pushPull).toBe("Push");
    expect(movement.family).toBe("Press");
    expect(movement.familyDisplay).toBe("Pressing");
    expect(movement.imageAssetId).toBe("abc-123");
  });

  it("handles undefined optional fields gracefully", () => {
    const movement = mapDocToMovement(
      makeDbDoc({
        baseOfSupport: undefined,
        bodyRegion: undefined,
        pushPull: undefined,
        secondsPerRep: undefined,
      }),
    );

    expect(movement.baseOfSupport).toBeUndefined();
    expect(movement.bodyRegion).toBeUndefined();
    expect(movement.pushPull).toBeUndefined();
    expect(movement.secondsPerRep).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Unmapped accessory detection
// ---------------------------------------------------------------------------

describe("unmapped accessory detection", () => {
  it("identifies known accessories", () => {
    const knownAccessories = [
      "Smart Handles",
      "Handle",
      "Handles",
      "Smart Bar",
      "StraightBar",
      "Bar",
      "Rope",
      "Roller",
      "Weight Bar",
      "Barbell",
      "Pilates Loops",
      "PilatesLoops",
      "AnkleStraps",
    ];

    for (const acc of knownAccessories) {
      expect(acc in ACCESSORY_MAP, `${acc} should be in ACCESSORY_MAP`).toBe(true);
    }
  });

  it("detects unmapped accessory values", () => {
    const unmappedAccessories = new Set<string>();
    const testAccessories = ["Smart Handles", "Unknown Gadget", "Future Device"];

    for (const acc of testAccessories) {
      if (!(acc in ACCESSORY_MAP)) {
        unmappedAccessories.add(acc);
      }
    }

    expect(unmappedAccessories.size).toBe(2);
    expect(unmappedAccessories.has("Unknown Gadget")).toBe(true);
    expect(unmappedAccessories.has("Future Device")).toBe(true);
    expect(unmappedAccessories.has("Smart Handles")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Token-based user selection for sync
// ---------------------------------------------------------------------------

describe("token user selection for sync", () => {
  interface TokenUser {
    userId: string;
    tonalTokenExpiresAt: number | undefined;
  }

  /** Mirrors the selection logic in getUserWithValidToken. */
  function pickTokenUser(profiles: TokenUser[], now: number): TokenUser | null {
    const valid = profiles.find((p) => p.tonalTokenExpiresAt && p.tonalTokenExpiresAt > now);
    if (valid) return valid;
    return profiles[0] ?? null;
  }

  it("skips sync when no connected users exist", () => {
    const result = pickTokenUser([], Date.now());

    expect(result).toBeNull();
  });

  it("prefers user with non-expired token", () => {
    const now = Date.now();
    const profiles: TokenUser[] = [
      { userId: "expired-user", tonalTokenExpiresAt: now - 1000 },
      { userId: "valid-user", tonalTokenExpiresAt: now + 3600_000 },
    ];

    const result = pickTokenUser(profiles, now);

    expect(result?.userId).toBe("valid-user");
  });

  it("falls back to any user when all tokens are expired", () => {
    const now = Date.now();
    const profiles: TokenUser[] = [
      { userId: "expired-1", tonalTokenExpiresAt: now - 5000 },
      { userId: "expired-2", tonalTokenExpiresAt: now - 1000 },
    ];

    const result = pickTokenUser(profiles, now);

    expect(result?.userId).toBe("expired-1");
  });

  it("falls back to user with no expiry set", () => {
    const now = Date.now();
    const profiles: TokenUser[] = [{ userId: "no-expiry", tonalTokenExpiresAt: undefined }];

    const result = pickTokenUser(profiles, now);

    expect(result?.userId).toBe("no-expiry");
  });
});
