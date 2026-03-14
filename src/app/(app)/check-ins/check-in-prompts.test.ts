import { describe, expect, it } from "vitest";
import { buildChatPrompt, TRIGGER_LABELS } from "./check-in-prompts";

describe("TRIGGER_LABELS", () => {
  it("has a label for every known trigger", () => {
    const triggers = [
      "missed_session",
      "gap_3_days",
      "tough_session_completed",
      "weekly_recap",
      "strength_milestone",
      "plateau",
    ];

    for (const trigger of triggers) {
      expect(TRIGGER_LABELS[trigger]).toBeDefined();
      expect(TRIGGER_LABELS[trigger].length).toBeGreaterThan(0);
    }
  });
});

describe("buildChatPrompt", () => {
  it("includes trigger-specific context for a known trigger", () => {
    const result = buildChatPrompt({
      message: "Hey, you missed your session yesterday.",
      trigger: "missed_session",
    });

    expect(result).toContain("I missed a scheduled workout");
    expect(result).toContain("Hey, you missed your session yesterday.");
    expect(result).toContain("specific actionable advice");
  });

  it("includes triggerContext when provided", () => {
    const result = buildChatPrompt({
      message: "You missed Tuesday's workout.",
      trigger: "missed_session",
      triggerContext: "2026-03-09:2",
    });

    expect(result).toContain("(context: 2026-03-09:2)");
    expect(result).toContain("I missed a scheduled workout");
  });

  it("omits triggerContext parenthetical when not provided", () => {
    const result = buildChatPrompt({
      message: "Keep it up!",
      trigger: "weekly_recap",
    });

    expect(result).not.toContain("(context:");
    expect(result).toContain("my weekly training recap");
  });

  it("falls back to generic description for unknown trigger", () => {
    const result = buildChatPrompt({
      message: "Something new happened.",
      trigger: "unknown_trigger_type",
    });

    expect(result).toContain("a recent check-in");
    expect(result).not.toContain("undefined");
  });

  it("builds correct prompt for each known trigger type", () => {
    const expectedFragments: Record<string, string> = {
      missed_session: "I missed a scheduled workout",
      gap_3_days: "I haven't worked out in a few days",
      tough_session_completed: "I just finished a tough workout",
      weekly_recap: "my weekly training recap",
      strength_milestone: "a strength milestone I hit",
      plateau: "a potential plateau in my training",
    };

    for (const [trigger, fragment] of Object.entries(expectedFragments)) {
      const result = buildChatPrompt({ message: "test", trigger });
      expect(result).toContain(fragment);
    }
  });
});
