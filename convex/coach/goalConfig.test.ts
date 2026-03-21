import { describe, expect, it } from "vitest";
import {
  generateDescription,
  generateMetaDescription,
  generateSlug,
  generateTitle,
  getExcludedAccessoriesForConfig,
  getGoalLabel,
  getMaxExercises,
  getRepSetScheme,
} from "./goalConfig";

describe("getRepSetScheme", () => {
  it("returns hypertrophy scheme for build_muscle", () => {
    const scheme = getRepSetScheme("build_muscle");
    expect(scheme).toEqual({ sets: 3, reps: 10 });
  });

  it("returns duration-based scheme for mobility_flexibility", () => {
    const scheme = getRepSetScheme("mobility_flexibility");
    expect(scheme).toEqual({ sets: 2, duration: 35 });
  });

  it("returns power scheme with low reps", () => {
    const scheme = getRepSetScheme("power");
    expect(scheme).toEqual({ sets: 4, reps: 3 });
  });
});

describe("getExcludedAccessoriesForConfig", () => {
  it("excludes bar, rope, roller for handles_only", () => {
    const excluded = getExcludedAccessoriesForConfig("handles_only");
    expect(excluded).toContain("Smart Bar");
    expect(excluded).toContain("StraightBar");
    expect(excluded).toContain("Bar");
    expect(excluded).toContain("Rope");
    expect(excluded).toContain("Roller");
    expect(excluded).toContain("Weight Bar");
    expect(excluded).toContain("Barbell");
  });

  it("returns empty array for full_accessories", () => {
    expect(getExcludedAccessoriesForConfig("full_accessories")).toEqual([]);
  });

  it("returns empty array for bodyweight_only", () => {
    expect(getExcludedAccessoriesForConfig("bodyweight_only")).toEqual([]);
  });
});

describe("getMaxExercises", () => {
  it("returns 4 for 20min", () => {
    expect(getMaxExercises(20)).toBe(4);
  });

  it("returns 10 for 60min", () => {
    expect(getMaxExercises(60)).toBe(10);
  });
});

describe("getGoalLabel", () => {
  it("maps build_muscle to Hypertrophy", () => {
    expect(getGoalLabel("build_muscle")).toBe("Hypertrophy");
  });

  it("maps mobility_flexibility to Mobility", () => {
    expect(getGoalLabel("mobility_flexibility")).toBe("Mobility");
  });
});

describe("generateSlug", () => {
  it("produces correct slug format", () => {
    const slug = generateSlug({
      sessionType: "push",
      goal: "build_muscle",
      durationMinutes: 45,
      level: "intermediate",
      equipmentConfig: "handles_bar",
    });
    expect(slug).toBe("push-build-muscle-45min-intermediate-handles-bar");
  });
});

describe("generateTitle", () => {
  it("produces human-readable title", () => {
    const title = generateTitle({
      sessionType: "push",
      goal: "build_muscle",
      durationMinutes: 45,
      level: "intermediate",
    });
    expect(title).toBe("Push Hypertrophy Workout - 45min Intermediate");
  });

  it("handles multi-word session types", () => {
    const title = generateTitle({
      sessionType: "glutes_hamstrings",
      goal: "sport_complement",
      durationMinutes: 30,
      level: "beginner",
    });
    expect(title).toBe("Glutes & Hamstrings Sport Complement Workout - 30min Beginner");
  });
});

describe("generateDescription", () => {
  it("produces a description with duration, muscles, and goal context", () => {
    const desc = generateDescription(
      { sessionType: "push", goal: "build_muscle", durationMinutes: 45, level: "intermediate" },
      8,
      ["Chest", "Triceps", "Shoulders"],
    );
    expect(desc).toContain("45-minute");
    expect(desc).toContain("chest, triceps, shoulders");
    expect(desc).toContain("8 exercises");
    expect(desc).toContain("intermediate");
  });
});

describe("generateMetaDescription", () => {
  it("produces a meta description under 160 chars", () => {
    const meta = generateMetaDescription(
      { sessionType: "push", goal: "build_muscle", durationMinutes: 45, level: "intermediate" },
      8,
    );
    expect(meta.length).toBeLessThan(160);
    expect(meta).toContain("Tonal");
    expect(meta).toContain("45min");
  });
});
