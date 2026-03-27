import { describe, expect, it } from "vitest";
import { RETENTION } from "./dataRetention";

describe("data retention constants", () => {
  it("AI usage retention is 90 days", () => {
    expect(RETENTION.aiUsageDays).toBe(90);
  });

  it("AI tool calls retention is 30 days", () => {
    expect(RETENTION.aiToolCallsDays).toBe(30);
  });

  it("expired cache retention is 24 hours", () => {
    expect(RETENTION.expiredCacheHours).toBe(24);
  });
});
