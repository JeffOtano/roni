import { describe, expect, it } from "vitest";
import { generateKeyString, hashApiKey } from "./crypto";

describe("hashApiKey", () => {
  it("produces consistent SHA-256 hex digest", async () => {
    const hash1 = await hashApiKey("test-key-123");
    const hash2 = await hashApiKey("test-key-123");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different keys", async () => {
    const hash1 = await hashApiKey("key-a");
    const hash2 = await hashApiKey("key-b");
    expect(hash1).not.toBe(hash2);
  });
});

describe("generateKeyString", () => {
  it("returns a base64url string of 43 characters", () => {
    const key = generateKeyString();
    expect(key.length).toBe(43);
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 10 }, () => generateKeyString()));
    expect(keys.size).toBe(10);
  });
});
