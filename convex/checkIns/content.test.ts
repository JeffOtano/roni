import { describe, expect, it } from "vitest";
import { CHECK_IN_MESSAGES, getMessageForTrigger } from "./content";

describe("getMessageForTrigger", () => {
  it("returns a non-empty string for every trigger", () => {
    const triggers = [
      "missed_session",
      "gap_3_days",
      "tough_session_completed",
      "weekly_recap",
      "strength_milestone",
      "plateau",
      "high_external_load",
      "consistency_streak",
    ] as const;
    for (const trigger of triggers) {
      const msg = getMessageForTrigger(trigger);
      expect(msg).toBe(CHECK_IN_MESSAGES[trigger]);
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it("returns message for high_external_load trigger", () => {
    expect(getMessageForTrigger("high_external_load")).toBeTruthy();
  });

  it("returns message for consistency_streak trigger", () => {
    expect(getMessageForTrigger("consistency_streak")).toBeTruthy();
  });

  it("returns different messages for different triggers", () => {
    const messages = new Set(
      [
        "missed_session",
        "gap_3_days",
        "tough_session_completed",
        "weekly_recap",
        "strength_milestone",
        "plateau",
        "high_external_load",
        "consistency_streak",
      ].map((t) => getMessageForTrigger(t as Parameters<typeof getMessageForTrigger>[0])),
    );
    expect(messages.size).toBe(8);
  });
});
