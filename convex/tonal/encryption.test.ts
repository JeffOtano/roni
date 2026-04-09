import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./encryption";

describe("Token Encryption", () => {
  const TEST_KEY = "a".repeat(64);

  it("round-trips a token through encrypt/decrypt", async () => {
    const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test.payload";
    const encrypted = await encrypt(token, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(token);
  });

  it("produces different ciphertext for same input (random IV)", async () => {
    const token = "same-token";
    const a = await encrypt(token, TEST_KEY);
    const b = await encrypt(token, TEST_KEY);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with wrong key", async () => {
    const token = "secret-token";
    const encrypted = await encrypt(token, TEST_KEY);
    const wrongKey = "b".repeat(64);
    await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const token = "secret-token";
    const encrypted = await encrypt(token, TEST_KEY);
    const [iv, tag] = encrypted.split(":");
    const tampered = `${iv}:${tag}:${btoa("tampered")}`;
    await expect(decrypt(tampered, TEST_KEY)).rejects.toThrow();
  });

  it("handles empty string", async () => {
    const encrypted = await encrypt("", TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe("");
  });

  it("handles unicode content", async () => {
    const token = "tönäl-tøken-日本語";
    const encrypted = await encrypt(token, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(token);
  });
});
