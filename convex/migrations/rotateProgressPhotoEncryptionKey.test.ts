import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../tonal/encryption";
import { rotatePhotoBlob } from "./rotateProgressPhotoEncryptionKey";

const OLD_KEY = "a".repeat(64);
const NEW_KEY = "b".repeat(64);

describe("rotatePhotoBlob", () => {
  it("re-encrypts a photo blob so the new key can decrypt it", async () => {
    const plaintext = "base64-photo-bytes-go-here";
    const oldEncoded = await encrypt(plaintext, OLD_KEY);

    const newEncoded = await rotatePhotoBlob(oldEncoded, OLD_KEY, NEW_KEY);

    expect(await decrypt(newEncoded, NEW_KEY)).toBe(plaintext);
  });

  it("produces a ciphertext that the old key can no longer decrypt", async () => {
    const plaintext = "some-photo-payload";
    const oldEncoded = await encrypt(plaintext, OLD_KEY);

    const newEncoded = await rotatePhotoBlob(oldEncoded, OLD_KEY, NEW_KEY);

    await expect(decrypt(newEncoded, OLD_KEY)).rejects.toThrow();
  });

  it("round-trips a large-ish payload without corruption", async () => {
    const plaintext = "x".repeat(65_536);
    const oldEncoded = await encrypt(plaintext, OLD_KEY);

    const newEncoded = await rotatePhotoBlob(oldEncoded, OLD_KEY, NEW_KEY);

    expect(await decrypt(newEncoded, NEW_KEY)).toBe(plaintext);
  });

  it("throws when the ciphertext is not valid base64 triples", async () => {
    await expect(rotatePhotoBlob("not-a-valid-ciphertext", OLD_KEY, NEW_KEY)).rejects.toThrow();
  });

  it("throws when the old key does not match the ciphertext", async () => {
    const wrongKey = "c".repeat(64);
    const oldEncoded = await encrypt("payload", OLD_KEY);

    await expect(rotatePhotoBlob(oldEncoded, wrongKey, NEW_KEY)).rejects.toThrow();
  });
});
