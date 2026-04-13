import { describe, expect, it } from "vitest";
import {
  getCurrentStrengthScores,
  getMuscleReadiness,
  getRecentCompletedWorkouts,
  getRecentExternalActivities,
  userIdArgsValidator,
  userIdWithLimitArgsValidator,
} from "./syncQueries";

// ---------------------------------------------------------------------------
// userIdArgsValidator
// ---------------------------------------------------------------------------

describe("userIdArgsValidator", () => {
  it("has userId field", () => {
    expect(userIdArgsValidator).toHaveProperty("userId");
  });

  it("has exactly one field", () => {
    expect(Object.keys(userIdArgsValidator)).toHaveLength(1);
  });

  it("userId is an id validator", () => {
    expect(userIdArgsValidator.userId.kind).toBe("id");
  });
});

// ---------------------------------------------------------------------------
// userIdWithLimitArgsValidator
// ---------------------------------------------------------------------------

describe("userIdWithLimitArgsValidator", () => {
  it("has userId field", () => {
    expect(userIdWithLimitArgsValidator).toHaveProperty("userId");
  });

  it("has limit field", () => {
    expect(userIdWithLimitArgsValidator).toHaveProperty("limit");
  });

  it("has exactly two fields", () => {
    expect(Object.keys(userIdWithLimitArgsValidator)).toHaveLength(2);
  });

  it("userId is an id validator", () => {
    expect(userIdWithLimitArgsValidator.userId.kind).toBe("id");
  });

  it("limit is a number validator", () => {
    expect(userIdWithLimitArgsValidator.limit.kind).toBe("float64");
  });
});

// ---------------------------------------------------------------------------
// query function exports
// ---------------------------------------------------------------------------

describe("getCurrentStrengthScores", () => {
  it("is defined", () => {
    expect(getCurrentStrengthScores).toBeDefined();
  });
});

describe("getMuscleReadiness", () => {
  it("is defined", () => {
    expect(getMuscleReadiness).toBeDefined();
  });
});

describe("getRecentCompletedWorkouts", () => {
  it("is defined", () => {
    expect(getRecentCompletedWorkouts).toBeDefined();
  });
});

describe("getRecentExternalActivities", () => {
  it("is defined", () => {
    expect(getRecentExternalActivities).toBeDefined();
  });
});
