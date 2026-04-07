import { describe, expect, it, vi } from "vitest";
import { BYOK_REQUIRED_AFTER, isBYOKRequired, validateGeminiKeyAgainstGoogle } from "./byok";

describe("isBYOKRequired", () => {
  it("returns false for users created before BYOK_REQUIRED_AFTER (grandfathered)", () => {
    const creationTime = BYOK_REQUIRED_AFTER - 1;
    expect(isBYOKRequired(creationTime)).toBe(false);
  });

  it("returns true for users created exactly at BYOK_REQUIRED_AFTER", () => {
    expect(isBYOKRequired(BYOK_REQUIRED_AFTER)).toBe(true);
  });

  it("returns true for users created after BYOK_REQUIRED_AFTER", () => {
    const creationTime = BYOK_REQUIRED_AFTER + 1000;
    expect(isBYOKRequired(creationTime)).toBe(true);
  });
});

describe("validateGeminiKeyAgainstGoogle", () => {
  function makeResponse(status: number): Response {
    return new Response(null, { status });
  }

  it("returns valid: true on a 200 response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200));
    const result = await validateGeminiKeyAgainstGoogle(
      "AIza_test_key",
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({ valid: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns invalid_key on a 401 response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(401));
    const result = await validateGeminiKeyAgainstGoogle(
      "AIza_test_key",
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({ valid: false, reason: "invalid_key" });
  });

  it("returns invalid_key on a 403 response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(403));
    const result = await validateGeminiKeyAgainstGoogle(
      "AIza_test_key",
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({ valid: false, reason: "invalid_key" });
  });

  it("returns quota_exceeded on a 429 response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(429));
    const result = await validateGeminiKeyAgainstGoogle(
      "AIza_test_key",
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({ valid: false, reason: "quota_exceeded" });
  });

  it("returns unknown on an unexpected non-OK status (500)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(500));
    const result = await validateGeminiKeyAgainstGoogle(
      "AIza_test_key",
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({ valid: false, reason: "unknown" });
  });

  it("returns network_error when fetch throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    const result = await validateGeminiKeyAgainstGoogle(
      "AIza_test_key",
      fetchImpl as unknown as typeof fetch,
    );
    expect(result).toEqual({ valid: false, reason: "network_error" });
  });

  it("never echoes the raw key in any return value (sanitization)", async () => {
    const leakKey = "AIza_leak_attempt_for_sanitization_xyz";

    // Simulate Google AI echoing the key in an error body, plus a non-OK
    // status. We deliberately include the key in the body and statusText to
    // prove the helper does not read or surface it.
    const leakyResponse = new Response(
      JSON.stringify({
        error: {
          message: `API key ${leakKey} is invalid`,
          status: "INVALID_ARGUMENT",
        },
      }),
      { status: 400, statusText: `bad key ${leakKey}` },
    );
    const fetchImpl = vi.fn().mockResolvedValue(leakyResponse);

    const result = await validateGeminiKeyAgainstGoogle(
      leakKey,
      fetchImpl as unknown as typeof fetch,
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(leakKey);
    expect(result).toEqual({ valid: false, reason: "unknown" });
  });

  it("never echoes the raw key when fetch throws with the key in the error message", async () => {
    const leakKey = "AIza_leak_attempt_for_sanitization_xyz";
    const fetchImpl = vi.fn().mockRejectedValue(new Error(`failed to fetch with key ${leakKey}`));

    const result = await validateGeminiKeyAgainstGoogle(
      leakKey,
      fetchImpl as unknown as typeof fetch,
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(leakKey);
    expect(result).toEqual({ valid: false, reason: "network_error" });
  });
});
