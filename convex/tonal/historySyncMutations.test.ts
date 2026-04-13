import { describe, expect, it } from "vitest";
import {
  externalActivityValidator,
  muscleReadinessValidator,
  strengthScoreValidator,
} from "./historySyncMutations";

// ---------------------------------------------------------------------------
// strengthScoreValidator
// ---------------------------------------------------------------------------

describe("strengthScoreValidator", () => {
  it("has bodyRegion and score fields", () => {
    const fields = strengthScoreValidator.fields;

    expect(fields).toHaveProperty("bodyRegion");
    expect(fields).toHaveProperty("score");
  });

  it("has exactly two fields", () => {
    expect(Object.keys(strengthScoreValidator.fields)).toHaveLength(2);
  });

  it("bodyRegion is a string validator", () => {
    expect(strengthScoreValidator.fields.bodyRegion.kind).toBe("string");
  });

  it("score is a number validator", () => {
    expect(strengthScoreValidator.fields.score.kind).toBe("float64");
  });
});

// ---------------------------------------------------------------------------
// muscleReadinessValidator
// ---------------------------------------------------------------------------

describe("muscleReadinessValidator", () => {
  const expectedMuscles = [
    "chest",
    "shoulders",
    "back",
    "triceps",
    "biceps",
    "abs",
    "obliques",
    "quads",
    "glutes",
    "hamstrings",
    "calves",
  ];

  it("has all eleven muscle group fields", () => {
    for (const muscle of expectedMuscles) {
      expect(muscleReadinessValidator.fields, `missing field: ${muscle}`).toHaveProperty(muscle);
    }
  });

  it("has exactly eleven fields", () => {
    expect(Object.keys(muscleReadinessValidator.fields)).toHaveLength(11);
  });

  it("all muscle fields are number validators", () => {
    for (const muscle of expectedMuscles) {
      expect(
        muscleReadinessValidator.fields[muscle as keyof typeof muscleReadinessValidator.fields]
          .kind,
        `${muscle} should be float64`,
      ).toBe("float64");
    }
  });
});

// ---------------------------------------------------------------------------
// externalActivityValidator
// ---------------------------------------------------------------------------

describe("externalActivityValidator", () => {
  const expectedFields = [
    "externalId",
    "workoutType",
    "beginTime",
    "totalDuration",
    "activeCalories",
    "totalCalories",
    "averageHeartRate",
    "source",
    "distance",
  ];

  it("has all nine expected fields", () => {
    for (const field of expectedFields) {
      expect(externalActivityValidator.fields, `missing field: ${field}`).toHaveProperty(field);
    }
  });

  it("has exactly nine fields", () => {
    expect(Object.keys(externalActivityValidator.fields)).toHaveLength(9);
  });

  it("string fields are string validators", () => {
    const stringFields = ["externalId", "workoutType", "beginTime", "source"] as const;

    for (const field of stringFields) {
      expect(externalActivityValidator.fields[field].kind, `${field} should be string`).toBe(
        "string",
      );
    }
  });

  it("numeric fields are number validators", () => {
    const numericFields = [
      "totalDuration",
      "activeCalories",
      "totalCalories",
      "averageHeartRate",
      "distance",
    ] as const;

    for (const field of numericFields) {
      expect(externalActivityValidator.fields[field].kind, `${field} should be float64`).toBe(
        "float64",
      );
    }
  });
});
