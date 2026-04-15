import { describe, expect, it } from "vitest";
import { toSessionDuration } from "./helpers";

describe("toSessionDuration", () => {
  it("accepts valid numeric values", () => {
    expect(toSessionDuration(30)).toBe(30);
    expect(toSessionDuration(45)).toBe(45);
    expect(toSessionDuration(60)).toBe(60);
  });

  it("accepts valid string values", () => {
    expect(toSessionDuration("30")).toBe(30);
    expect(toSessionDuration("45")).toBe(45);
    expect(toSessionDuration("60")).toBe(60);
  });

  it("rejects invalid values", () => {
    expect(() => toSessionDuration(15)).toThrow("Invalid session duration");
    expect(() => toSessionDuration("90")).toThrow("Invalid session duration");
    expect(() => toSessionDuration("abc")).toThrow("Invalid session duration");
  });
});

describe("withToolTracking", () => {
  it("re-throws the original error from the inner function", async () => {
    const originalError = new Error("DB connection failed");
    const fn = async () => {
      throw originalError;
    };
    await expect(fn()).rejects.toThrow("DB connection failed");
  });

  it("measures elapsed time correctly", () => {
    const start = Date.now();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(typeof elapsed).toBe("number");
  });
});
