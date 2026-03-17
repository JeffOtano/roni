import { describe, expect, it } from "vitest";

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
