import { describe, expect, it } from "vitest";
import { parseByokError } from "./parseByokError";

describe("parseByokError", () => {
  it("returns byok_key_invalid when the error message contains the code", () => {
    expect(parseByokError(new Error("byok_key_invalid"))).toBe("byok_key_invalid");
  });

  it("returns byok_quota_exceeded when the error message contains the code", () => {
    expect(parseByokError(new Error("byok_quota_exceeded"))).toBe("byok_quota_exceeded");
  });

  it("returns byok_safety_blocked when the error message contains the code", () => {
    expect(parseByokError(new Error("byok_safety_blocked"))).toBe("byok_safety_blocked");
  });

  it("returns byok_unknown_error when the error message contains the code", () => {
    expect(parseByokError(new Error("byok_unknown_error"))).toBe("byok_unknown_error");
  });

  it("returns byok_key_missing when the error message contains the code", () => {
    expect(parseByokError(new Error("byok_key_missing"))).toBe("byok_key_missing");
  });

  it("extracts the code even when wrapped by Convex framing around the message", () => {
    const wrapped = new Error(
      "[CONVEX M(chat:sendMessageMutation)] Uncaught Error: byok_key_invalid",
    );
    expect(parseByokError(wrapped)).toBe("byok_key_invalid");
  });

  it("returns null for a generic non-BYOK error", () => {
    expect(parseByokError(new Error("Rate limit exceeded for dailyMessages"))).toBeNull();
  });

  it("returns null when the input is not an Error instance and has no code", () => {
    expect(parseByokError("something bad happened")).toBeNull();
  });

  it("coerces non-Error inputs to string so codes embedded in thrown strings still match", () => {
    expect(parseByokError("byok_quota_exceeded")).toBe("byok_quota_exceeded");
  });

  it("returns null for null and undefined inputs", () => {
    expect(parseByokError(null)).toBeNull();
    expect(parseByokError(undefined)).toBeNull();
  });

  it("returns house_key_quota_exhausted when the error message contains the code", () => {
    expect(parseByokError(new Error("house_key_quota_exhausted"))).toBe(
      "house_key_quota_exhausted",
    );
  });

  it("extracts house_key_quota_exhausted even when wrapped by Convex framing", () => {
    const wrapped = new Error(
      "[CONVEX A(chat:sendMessage)] Uncaught Error: house_key_quota_exhausted",
    );
    expect(parseByokError(wrapped)).toBe("house_key_quota_exhausted");
  });
});
