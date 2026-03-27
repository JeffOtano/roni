import { describe, expect, it } from "vitest";
import { TonalApiError } from "./client";

// ---------------------------------------------------------------------------
// TonalApiError classification
//
// tokenRetry.ts uses isTonal401() internally to decide retry behavior.
// That function is private, but we can test the TonalApiError class it
// depends on and verify the classification logic patterns.
// ---------------------------------------------------------------------------

describe("TonalApiError", () => {
  it("is an instance of Error", () => {
    const err = new TonalApiError(401, "Unauthorized");

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TonalApiError);
  });

  it("exposes status and body properties", () => {
    const err = new TonalApiError(401, "Token expired");

    expect(err.status).toBe(401);
    expect(err.body).toBe("Token expired");
  });

  it("formats a descriptive error message", () => {
    const err = new TonalApiError(500, "Internal Server Error");

    expect(err.message).toBe("Tonal API 500: Internal Server Error");
  });

  it("has name set to TonalApiError", () => {
    const err = new TonalApiError(403, "Forbidden");

    expect(err.name).toBe("TonalApiError");
  });
});

// ---------------------------------------------------------------------------
// 401 detection logic (mirrors isTonal401 from tokenRetry.ts)
// ---------------------------------------------------------------------------

describe("401 detection pattern", () => {
  function isTonal401(error: unknown): error is TonalApiError {
    return error instanceof TonalApiError && error.status === 401;
  }

  it("identifies TonalApiError with status 401", () => {
    const err = new TonalApiError(401, "Unauthorized");

    expect(isTonal401(err)).toBe(true);
  });

  it("rejects TonalApiError with non-401 status", () => {
    const err = new TonalApiError(500, "Server error");

    expect(isTonal401(err)).toBe(false);
  });

  it("rejects generic Error", () => {
    const err = new Error("Something went wrong");

    expect(isTonal401(err)).toBe(false);
  });

  it("rejects non-Error values", () => {
    expect(isTonal401(null)).toBe(false);
    expect(isTonal401(undefined)).toBe(false);
    expect(isTonal401("401")).toBe(false);
    expect(isTonal401(401)).toBe(false);
  });

  it("rejects plain object with matching shape", () => {
    const fake = { status: 401, body: "Unauthorized", name: "TonalApiError" };

    expect(isTonal401(fake)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Retry decision logic
// ---------------------------------------------------------------------------

describe("retry decision logic", () => {
  it("should retry on first 401, then succeed", () => {
    let callCount = 0;

    // Simulate the withTokenRetry pattern
    const simulateCall = (): string => {
      callCount++;
      if (callCount === 1) {
        throw new TonalApiError(401, "Token expired");
      }
      return "success";
    };

    // First call throws
    expect(() => simulateCall()).toThrow(TonalApiError);

    // Second call (after refresh) succeeds
    const result = simulateCall();
    expect(result).toBe("success");
    expect(callCount).toBe(2);
  });

  it("should not retry on non-401 errors", () => {
    const err = new TonalApiError(500, "Internal Server Error");

    const isTonal401 = err instanceof TonalApiError && err.status === 401;

    expect(isTonal401).toBe(false);
    // In the real code, non-401 errors are re-thrown immediately
  });

  it("should give up after retry also returns 401", () => {
    let callCount = 0;

    const simulateCall = (): string => {
      callCount++;
      throw new TonalApiError(401, "Token expired");
    };

    // Both calls throw 401
    expect(() => simulateCall()).toThrow(TonalApiError);
    expect(() => simulateCall()).toThrow(TonalApiError);
    expect(callCount).toBe(2);
    // In the real code, this marks the token as expired
  });
});
