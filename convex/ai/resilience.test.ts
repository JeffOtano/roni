import { describe, expect, it } from "vitest";
import { isTransientError } from "./resilience";

describe("isTransientError", () => {
  it("returns true for network errors", () => {
    expect(isTransientError(new TypeError("fetch failed"))).toBe(true);
  });

  it("returns true for 429 rate limit", () => {
    const error = Object.assign(new Error("Rate limited"), { status: 429 });
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for 500 server error", () => {
    const error = Object.assign(new Error("Internal"), { status: 500 });
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for 502 bad gateway", () => {
    const error = Object.assign(new Error("Bad Gateway"), { status: 502 });
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for 503 service unavailable", () => {
    const error = Object.assign(new Error("Unavailable"), { status: 503 });
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for timeout errors", () => {
    const error = new Error("Request timed out");
    error.name = "TimeoutError";
    expect(isTransientError(error)).toBe(true);
  });

  it("returns false for 400 bad request", () => {
    const error = Object.assign(new Error("Bad request"), { status: 400 });
    expect(isTransientError(error)).toBe(false);
  });

  it("returns false for 401 unauthorized", () => {
    const error = Object.assign(new Error("Unauthorized"), { status: 401 });
    expect(isTransientError(error)).toBe(false);
  });

  it("returns false for 403 forbidden", () => {
    const error = Object.assign(new Error("Forbidden"), { status: 403 });
    expect(isTransientError(error)).toBe(false);
  });

  it("returns false for generic errors without status", () => {
    expect(isTransientError(new Error("Something broke"))).toBe(false);
  });
});
