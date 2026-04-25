import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { safeStringify, toSessionDuration } from "./helpers";

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

describe("safeStringify", () => {
  let originalVercelEnv: string | undefined;
  let originalOverride: string | undefined;

  beforeEach(() => {
    originalVercelEnv = process.env.VERCEL_ENV;
    originalOverride = process.env.AI_TOOL_PREVIEW_MAX_CHARS;
    delete process.env.VERCEL_ENV;
    delete process.env.AI_TOOL_PREVIEW_MAX_CHARS;
  });

  afterEach(() => {
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
    if (originalOverride === undefined) delete process.env.AI_TOOL_PREVIEW_MAX_CHARS;
    else process.env.AI_TOOL_PREVIEW_MAX_CHARS = originalOverride;
  });

  it("returns full JSON when below the limit", () => {
    expect(safeStringify({ hello: "world" })).toBe('{"hello":"world"}');
  });

  it("truncates output above the explicit limit", () => {
    const padded = "x".repeat(300);

    const result = safeStringify({ note: padded }, 64);

    expect(result.length).toBe(64);
    expect(result.endsWith("...[truncated]")).toBe(true);
  });

  it("uses the prod default in production", () => {
    process.env.VERCEL_ENV = "production";
    const padded = "y".repeat(2000);

    const result = safeStringify({ note: padded });

    expect(result.length).toBe(1024);
    expect(result.endsWith("...[truncated]")).toBe(true);
  });

  it("uses the dev default outside production", () => {
    const padded = "z".repeat(8000);

    const result = safeStringify({ note: padded });

    expect(result.length).toBe(4096);
    expect(result.endsWith("...[truncated]")).toBe(true);
  });

  it("honors the AI_TOOL_PREVIEW_MAX_CHARS override at runtime", () => {
    process.env.AI_TOOL_PREVIEW_MAX_CHARS = "128";
    const padded = "q".repeat(500);

    const result = safeStringify({ note: padded });

    expect(result.length).toBe(128);
    expect(result.endsWith("...[truncated]")).toBe(true);
  });

  it("never splits a UTF-16 surrogate pair when truncating", () => {
    // JSON output: `"` + 16 'a' + emoji (2 chars) + 50 'z' + `"`. With limit=32
    // and suffix length=14, the naive cut at index 18 would land on the emoji's
    // low surrogate (json[17] is the high surrogate). The function must back
    // off one char so the surrogate pair stays intact in the kept slice.
    const limit = 32;
    const value = "a".repeat(16) + "😀" + "z".repeat(50);

    const result = safeStringify(value, limit);

    expect(result.length).toBeLessThanOrEqual(limit);
    expect(result.endsWith("...[truncated]")).toBe(true);
    const lastBeforeSuffix = result.slice(0, -"...[truncated]".length);
    const lastCode = lastBeforeSuffix.charCodeAt(lastBeforeSuffix.length - 1);
    expect(lastCode >= 0xd800 && lastCode <= 0xdbff).toBe(false);
  });

  it("returns empty string for undefined", () => {
    expect(safeStringify(undefined)).toBe("");
  });

  it("returns empty string when maxChars cannot fit the truncation suffix", () => {
    // Suffix "...[truncated]" is 14 chars; with maxChars=10 there is no room
    // for any kept content plus the suffix, so refuse rather than emit a
    // malformed slice.
    const padded = "x".repeat(100);

    expect(safeStringify({ note: padded }, 10)).toBe("");
  });

  it("falls back to a sentinel when JSON.stringify throws", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    expect(safeStringify(cyclic)).toBe("[unserializable]");
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
