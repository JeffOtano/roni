import { describe, expect, it } from "vitest";
import {
  classifyByokError,
  isTransientError,
  throwIfByokError,
  withByokErrorSanitization,
} from "./resilience";

describe("isTransientError", () => {
  it("returns true for network errors", () => {
    expect(isTransientError(new TypeError("fetch failed"))).toBe(true);
  });

  it("returns false for 429 rate limit (treated as BYOK quota_exceeded, not transient)", () => {
    // With BYOK, a 429 from Google AI means the user's per-key quota is
    // exhausted. Retrying does not help, and it must surface as a typed
    // BYOK error rather than be retried as a generic transient failure.
    // See classifyByokError below for the routing.
    const error = Object.assign(new Error("Rate limited"), { status: 429 });
    expect(isTransientError(error)).toBe(false);
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

describe("classifyByokError", () => {
  it("classifies a 401 status as byok_key_invalid", () => {
    const error = Object.assign(new Error("Unauthorized"), { status: 401 });
    expect(classifyByokError(error)).toBe("byok_key_invalid");
  });

  it("classifies a 403 status as byok_key_invalid", () => {
    const error = Object.assign(new Error("Forbidden"), { status: 403 });
    expect(classifyByokError(error)).toBe("byok_key_invalid");
  });

  it("classifies an 'API key not valid' message as byok_key_invalid", () => {
    // Google AI's actual error format. The classifier matches on substring
    // so we never have to read the full body (which could echo the key).
    const error = new Error("API key not valid. Please pass a valid API key.");
    expect(classifyByokError(error)).toBe("byok_key_invalid");
  });

  it("classifies a 429 status as byok_quota_exceeded", () => {
    const error = Object.assign(new Error("Rate limited"), { status: 429 });
    expect(classifyByokError(error)).toBe("byok_quota_exceeded");
  });

  it("classifies a 'quota' substring as byok_quota_exceeded", () => {
    const error = new Error("RESOURCE_EXHAUSTED: Quota exceeded for model.");
    expect(classifyByokError(error)).toBe("byok_quota_exceeded");
  });

  it("classifies a 'safety' substring as byok_safety_blocked", () => {
    const error = new Error("Response was blocked due to safety filters");
    expect(classifyByokError(error)).toBe("byok_safety_blocked");
  });

  it("returns null for transient errors that are not BYOK-classifiable", () => {
    const error = Object.assign(new Error("Internal server error"), { status: 500 });
    expect(classifyByokError(error)).toBeNull();
  });

  it("returns null for non-Error inputs", () => {
    expect(classifyByokError("oops")).toBeNull();
    expect(classifyByokError(null)).toBeNull();
    expect(classifyByokError(undefined)).toBeNull();
  });
});

describe("throwIfByokError", () => {
  it("throws a sanitized Error with the BYOK code as the message", () => {
    const error = Object.assign(new Error("Unauthorized"), { status: 401 });
    expect(() => throwIfByokError(error)).toThrow("byok_key_invalid");
  });

  it("does not leak the original error message into the sanitized error", () => {
    // If the AI SDK ever wraps the key in the error message ("API key
    // AIza... is invalid"), the sanitized error must not echo that.
    const leakKey = "AIza_leak_for_throw_test";
    const error = new Error(`API key not valid (${leakKey})`);
    try {
      throwIfByokError(error);
      throw new Error("expected throwIfByokError to throw");
    } catch (caught) {
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toBe("byok_key_invalid");
      expect((caught as Error).message).not.toContain(leakKey);
    }
  });

  it("returns without throwing for non-BYOK errors", () => {
    const error = Object.assign(new Error("Internal"), { status: 500 });
    expect(() => throwIfByokError(error)).not.toThrow();
  });
});

describe("withByokErrorSanitization", () => {
  it("returns the wrapped function's result on success", async () => {
    const result = await withByokErrorSanitization(async () => "ok");
    expect(result).toBe("ok");
  });

  it("rethrows BYOK errors as the typed code without leaking the raw message", async () => {
    const leakKey = "AIza_leak_for_wrap_test";
    const error = new Error(`API key not valid (${leakKey})`);
    await expect(
      withByokErrorSanitization(async () => {
        throw error;
      }),
    ).rejects.toMatchObject({ message: "byok_key_invalid" });
  });

  it("rethrows non-BYOK errors unchanged so transient handling can run", async () => {
    const original = Object.assign(new Error("Internal server error"), { status: 500 });
    await expect(
      withByokErrorSanitization(async () => {
        throw original;
      }),
    ).rejects.toBe(original);
  });
});
