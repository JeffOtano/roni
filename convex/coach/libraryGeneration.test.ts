import { describe, expect, it } from "vitest";
import { enumerateValidCombos, isValidCombo } from "./libraryGeneration";

describe("isValidCombo", () => {
  it("rejects bodyweight_only with chest session", () => {
    expect(
      isValidCombo({
        sessionType: "chest",
        goal: "build_muscle",
        durationMinutes: 30,
        level: "intermediate",
        equipmentConfig: "bodyweight_only",
      }),
    ).toBe(false);
  });

  it("allows bodyweight_only with full_body", () => {
    expect(
      isValidCombo({
        sessionType: "full_body",
        goal: "general_fitness",
        durationMinutes: 30,
        level: "beginner",
        equipmentConfig: "bodyweight_only",
      }),
    ).toBe(true);
  });

  it("rejects endurance goal with 60min duration", () => {
    expect(
      isValidCombo({
        sessionType: "push",
        goal: "endurance",
        durationMinutes: 60,
        level: "intermediate",
        equipmentConfig: "handles_only",
      }),
    ).toBe(false);
  });

  it("rejects strength goal for beginner", () => {
    expect(
      isValidCombo({
        sessionType: "upper",
        goal: "strength",
        durationMinutes: 45,
        level: "beginner",
        equipmentConfig: "handles_bar",
      }),
    ).toBe(false);
  });

  it("rejects power goal for beginner", () => {
    expect(
      isValidCombo({
        sessionType: "push",
        goal: "power",
        durationMinutes: 45,
        level: "beginner",
        equipmentConfig: "full_accessories",
      }),
    ).toBe(false);
  });

  it("rejects power goal for 20min", () => {
    expect(
      isValidCombo({
        sessionType: "upper",
        goal: "power",
        durationMinutes: 20,
        level: "advanced",
        equipmentConfig: "handles_bar",
      }),
    ).toBe(false);
  });

  it("rejects mobility session with build_muscle goal", () => {
    expect(
      isValidCombo({
        sessionType: "mobility",
        goal: "build_muscle",
        durationMinutes: 30,
        level: "beginner",
        equipmentConfig: "bodyweight_only",
      }),
    ).toBe(false);
  });

  it("allows mobility session with mobility_flexibility goal", () => {
    expect(
      isValidCombo({
        sessionType: "mobility",
        goal: "mobility_flexibility",
        durationMinutes: 30,
        level: "beginner",
        equipmentConfig: "bodyweight_only",
      }),
    ).toBe(true);
  });

  it("rejects sport_complement with push session", () => {
    expect(
      isValidCombo({
        sessionType: "push",
        goal: "sport_complement",
        durationMinutes: 30,
        level: "intermediate",
        equipmentConfig: "handles_only",
      }),
    ).toBe(false);
  });

  it("allows sport_complement with full_body session", () => {
    expect(
      isValidCombo({
        sessionType: "full_body",
        goal: "sport_complement",
        durationMinutes: 30,
        level: "intermediate",
        equipmentConfig: "handles_only",
      }),
    ).toBe(true);
  });

  it("rejects mobility_flexibility with push session", () => {
    expect(
      isValidCombo({
        sessionType: "push",
        goal: "mobility_flexibility",
        durationMinutes: 30,
        level: "beginner",
        equipmentConfig: "handles_only",
      }),
    ).toBe(false);
  });

  it("rejects 20min full_body strength", () => {
    expect(
      isValidCombo({
        sessionType: "full_body",
        goal: "strength",
        durationMinutes: 20,
        level: "advanced",
        equipmentConfig: "full_accessories",
      }),
    ).toBe(false);
  });
});

describe("enumerateValidCombos", () => {
  it("produces combos within expected range", () => {
    const combos = enumerateValidCombos();
    // 8 pruning rules reduce 7200 raw combos; further reduction happens
    // at generation time when combos with <3 exercises are skipped
    expect(combos.length).toBeGreaterThan(3000);
    expect(combos.length).toBeLessThan(5000);
  });

  it("produces no invalid combos", () => {
    const combos = enumerateValidCombos();
    for (const combo of combos) {
      expect(isValidCombo(combo)).toBe(true);
    }
  });

  it("produces unique slugs", () => {
    const combos = enumerateValidCombos();
    const slugs = combos.map(
      (c) => `${c.sessionType}-${c.goal}-${c.durationMinutes}-${c.level}-${c.equipmentConfig}`,
    );
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
