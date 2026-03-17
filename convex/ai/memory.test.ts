import { describe, expect, it } from "vitest";
import { extractCoachingSignals } from "./memory";

describe("extractCoachingSignals", () => {
  it("detects exercise avoidance preference", () => {
    const signals = extractCoachingSignals([
      { role: "user", content: "I really don't like Bulgarian split squats" },
      { role: "assistant", content: "Got it — I'll avoid those in your programming." },
    ]);
    expect(signals).toContainEqual(
      expect.objectContaining({
        category: "avoidance",
        content: expect.stringContaining("Bulgarian split squats"),
      }),
    );
  });

  it("detects feedback style preference", () => {
    const signals = extractCoachingSignals([
      {
        role: "user",
        content: "Can you just give me the numbers? I don't need the motivation stuff.",
      },
    ]);
    expect(signals).toContainEqual(
      expect.objectContaining({
        category: "response_style",
        content: expect.stringContaining("data"),
      }),
    );
  });

  it("returns empty for generic conversation", () => {
    const signals = extractCoachingSignals([
      { role: "user", content: "Program my week" },
      { role: "assistant", content: "Here's your week plan..." },
    ]);
    expect(signals).toEqual([]);
  });
});
