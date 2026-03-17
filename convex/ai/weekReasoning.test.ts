import { describe, expect, it } from "vitest";
import { buildReasoningPrompt, parseReasoningOutput } from "./weekReasoning";

describe("buildReasoningPrompt", () => {
  it("includes all context sections in the prompt", () => {
    const prompt = buildReasoningPrompt({
      split: "ppl",
      targetDays: 3,
      sessionDuration: 45,
      muscleReadiness: { Chest: 85, Back: 60, Legs: 90 },
      recentWorkouts: ["Push — Chest/Shoulders/Triceps", "Pull — Back/Biceps"],
      activeInjuries: ["left shoulder — avoid overhead pressing"],
      recentFeedback: { avgRpe: 7.5, avgRating: 4.2 },
      isDeload: false,
    });

    expect(prompt).toContain("Push/Pull/Legs");
    expect(prompt).toContain("3 training days");
    expect(prompt).toContain("45 minutes");
    expect(prompt).toContain("Back: 60");
    expect(prompt).toContain("left shoulder");
    expect(prompt).toContain("RPE 7.5");
  });

  it("flags deload week in prompt", () => {
    const prompt = buildReasoningPrompt({
      split: "ppl",
      targetDays: 3,
      sessionDuration: 45,
      muscleReadiness: {},
      recentWorkouts: [],
      activeInjuries: [],
      recentFeedback: null,
      isDeload: true,
    });
    expect(prompt).toContain("DELOAD");
  });
});

describe("parseReasoningOutput", () => {
  it("extracts day-by-day reasoning from structured text", () => {
    const text = `
## Day 1: Push (Chest, Shoulders, Triceps)
Focus on chest since readiness is high (85). Start with bench press for compound strength.
Include shoulder work but avoid overhead pressing due to injury.

## Day 2: Pull (Back, Biceps)
Back readiness is lower (60) — reduce volume. Prioritize rows over heavy deadlifts.

## Day 3: Legs (Quads, Glutes, Hamstrings)
Full volume — readiness is excellent (90). Include squat variation.
    `.trim();

    const result = parseReasoningOutput(text);
    expect(result).toHaveLength(3);
    expect(result[0].dayLabel).toBe("Push");
    expect(result[0].reasoning).toContain("bench press");
    expect(result[1].dayLabel).toBe("Pull");
    expect(result[2].dayLabel).toBe("Legs");
  });

  it("returns empty array for unparseable text", () => {
    expect(parseReasoningOutput("Random unstructured text")).toEqual([]);
  });
});
