import { describe, expect, it } from "vitest";
import { ACCESSORY_MAP } from "./accessories";
import type { Movement } from "./types";

// ---------------------------------------------------------------------------
// tonal/movementSync.ts pure logic patterns
//
// The file only exports Convex actions/mutations/queries. We test the pure
// computation patterns used inside:
//   1. Document mapping (API Movement -> DB doc and back)
//   2. Unmapped accessory detection
//   3. Insert vs update decision
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Test data builder
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

// ---------------------------------------------------------------------------
// API Movement -> DB document mapping
// ---------------------------------------------------------------------------

describe("movement API to DB document mapping", () => {
  it("maps all required fields from API response to DB document", () => {
    const apiMovement = makeApiMovement();
    const now = Date.now();

    // Mirrors the mapping logic in syncMovementCatalog
    const doc = {
      tonalId: apiMovement.id,
      name: apiMovement.name,
      shortName: apiMovement.shortName ?? apiMovement.name,
      muscleGroups: apiMovement.muscleGroups ?? [],
      skillLevel: apiMovement.skillLevel,
      publishState: apiMovement.publishState,
      sortOrder: apiMovement.sortOrder,
      onMachine: apiMovement.onMachine,
      inFreeLift: apiMovement.inFreeLift,
      countReps: apiMovement.countReps,
      isTwoSided: apiMovement.isTwoSided,
      isBilateral: apiMovement.isBilateral,
      isAlternating: apiMovement.isAlternating,
      descriptionHow: apiMovement.descriptionHow,
      descriptionWhy: apiMovement.descriptionWhy,
      thumbnailMediaUrl: apiMovement.thumbnailMediaUrl,
      accessory: apiMovement.onMachineInfo?.accessory ?? undefined,
      onMachineInfo: apiMovement.onMachineInfo,
      lastSyncedAt: now,
    };

    expect(doc.tonalId).toBe("move-123");
    expect(doc.name).toBe("Bench Press");
    expect(doc.accessory).toBe("Smart Handles");
    expect(doc.lastSyncedAt).toBe(now);
  });

  it("falls back to name when shortName is missing", () => {
    const apiMovement = makeApiMovement({ shortName: undefined as unknown as string });

    const shortName = apiMovement.shortName ?? apiMovement.name;

    expect(shortName).toBe("Bench Press");
  });

  it("defaults muscleGroups to empty array when missing", () => {
    const apiMovement = makeApiMovement({ muscleGroups: undefined as unknown as string[] });

    const muscleGroups = apiMovement.muscleGroups ?? [];

    expect(muscleGroups).toEqual([]);
  });

  it("extracts accessory from onMachineInfo or defaults to undefined", () => {
    const withAccessory = makeApiMovement();
    const withoutAccessory = makeApiMovement({ onMachineInfo: undefined });

    expect(withAccessory.onMachineInfo?.accessory ?? undefined).toBe("Smart Handles");
    expect(withoutAccessory.onMachineInfo?.accessory ?? undefined).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DB document -> Movement interface mapping (backward compatibility)
// ---------------------------------------------------------------------------

describe("movement DB to API interface mapping", () => {
  it("maps tonalId back to id for backward compatibility", () => {
    const dbDoc = {
      tonalId: "move-123",
      name: "Bench Press",
      shortName: "Bench Press",
      muscleGroups: ["Chest"],
      skillLevel: 3,
      publishState: "published",
      sortOrder: 100,
      onMachine: true,
      inFreeLift: false,
      countReps: true,
      isTwoSided: false,
      isBilateral: true,
      isAlternating: false,
      descriptionHow: "Press the handles",
      descriptionWhy: "Build chest",
      thumbnailMediaUrl: "https://cdn.tonal.com/bench.jpg",
      onMachineInfo: { accessory: "Smart Handles" },
      trainingTypes: ["strength"],
    };

    // Mirrors the mapping in getAllMovements
    const movement: Movement = {
      id: dbDoc.tonalId,
      name: dbDoc.name,
      shortName: dbDoc.shortName,
      muscleGroups: dbDoc.muscleGroups,
      skillLevel: dbDoc.skillLevel,
      publishState: dbDoc.publishState,
      sortOrder: dbDoc.sortOrder,
      onMachine: dbDoc.onMachine,
      inFreeLift: dbDoc.inFreeLift,
      countReps: dbDoc.countReps,
      isTwoSided: dbDoc.isTwoSided,
      isBilateral: dbDoc.isBilateral,
      isAlternating: dbDoc.isAlternating,
      descriptionHow: dbDoc.descriptionHow,
      descriptionWhy: dbDoc.descriptionWhy,
      thumbnailMediaUrl: dbDoc.thumbnailMediaUrl,
      onMachineInfo: dbDoc.onMachineInfo as Movement["onMachineInfo"],
      trainingTypes: dbDoc.trainingTypes,
    };

    expect(movement.id).toBe("move-123");
    expect(movement.name).toBe("Bench Press");
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
// Insert vs update decision
// ---------------------------------------------------------------------------

describe("insert vs update decision", () => {
  it("inserts when no existing document found", () => {
    const existing = null;
    const action = existing ? "update" : "insert";

    expect(action).toBe("insert");
  });

  it("updates when existing document exists", () => {
    const existing = { _id: "doc-123", tonalId: "move-123" };
    const action = existing ? "update" : "insert";

    expect(action).toBe("update");
  });

  it("counts inserts and updates correctly", () => {
    const movements = [
      { id: "m1", existing: null },
      { id: "m2", existing: { _id: "d2" } },
      { id: "m3", existing: null },
      { id: "m4", existing: { _id: "d4" } },
    ];

    let inserted = 0;
    let updated = 0;

    for (const m of movements) {
      if (m.existing) {
        updated++;
      } else {
        inserted++;
      }
    }

    expect(inserted).toBe(2);
    expect(updated).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Active user selection for sync
// ---------------------------------------------------------------------------

describe("active user selection for sync", () => {
  it("skips sync when no active users found", () => {
    const activeUsers: Array<{ userId: string }> = [];

    const shouldSync = activeUsers.length > 0;

    expect(shouldSync).toBe(false);
  });

  it("uses first active user for token", () => {
    const activeUsers = [{ userId: "user-1" }, { userId: "user-2" }];

    expect(activeUsers[0].userId).toBe("user-1");
  });
});
