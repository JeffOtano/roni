import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "./encryption";

describe("Token Encryption", () => {
  const TEST_KEY = "a".repeat(64);

  it("round-trips a token through encrypt/decrypt", () => {
    const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test.payload";
    const encrypted = encrypt(token, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(token);
  });

  it("produces different ciphertext for same input (random IV)", () => {
    const token = "same-token";
    const a = encrypt(token, TEST_KEY);
    const b = encrypt(token, TEST_KEY);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with wrong key", () => {
    const token = "secret-token";
    const encrypted = encrypt(token, TEST_KEY);
    const wrongKey = "b".repeat(64);
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it("fails to decrypt tampered ciphertext", () => {
    const token = "secret-token";
    const encrypted = encrypt(token, TEST_KEY);
    const [iv, tag, data] = encrypted.split(":");
    const tampered = `${iv}:${tag}:${Buffer.from("tampered").toString("base64")}`;
    expect(() => decrypt(tampered, TEST_KEY)).toThrow();
  });

  it("handles empty string", () => {
    const encrypted = encrypt("", TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe("");
  });

  it("handles unicode content", () => {
    const token = "tönäl-tøken-日本語";
    const encrypted = encrypt(token, TEST_KEY);
    const decrypted = decrypt(encrypted, TEST_KEY);
    expect(decrypted).toBe(token);
  });
});
