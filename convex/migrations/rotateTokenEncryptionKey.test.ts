import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../tonal/encryption";
import { rotateProfileFields } from "./rotateTokenEncryptionKey";

const OLD_KEY = "a".repeat(64);
const NEW_KEY = "b".repeat(64);

describe("rotateProfileFields", () => {
  it("re-encrypts every field when all are present", async () => {
    const fields = {
      tonalToken: await encrypt("tonal-access", OLD_KEY),
      tonalRefreshToken: await encrypt("tonal-refresh", OLD_KEY),
      geminiApiKeyEncrypted: await encrypt("gemini-byok-key", OLD_KEY),
    };

    const result = await rotateProfileFields(fields, OLD_KEY, NEW_KEY);

    expect(await decrypt(result.tonalToken, NEW_KEY)).toBe("tonal-access");
    expect(await decrypt(result.tonalRefreshToken!, NEW_KEY)).toBe("tonal-refresh");
    expect(await decrypt(result.geminiApiKeyEncrypted!, NEW_KEY)).toBe("gemini-byok-key");
  });

  it("re-encrypts only the required field when optionals are undefined", async () => {
    const fields = {
      tonalToken: await encrypt("just-tonal", OLD_KEY),
    };

    const result = await rotateProfileFields(fields, OLD_KEY, NEW_KEY);

    expect(await decrypt(result.tonalToken, NEW_KEY)).toBe("just-tonal");
    expect(result.tonalRefreshToken).toBeUndefined();
    expect(result.geminiApiKeyEncrypted).toBeUndefined();
  });

  it("re-encrypts a partial set of fields and leaves absent ones undefined", async () => {
    const fields = {
      tonalToken: await encrypt("tonal-access", OLD_KEY),
      tonalRefreshToken: await encrypt("tonal-refresh", OLD_KEY),
    };

    const result = await rotateProfileFields(fields, OLD_KEY, NEW_KEY);

    expect(await decrypt(result.tonalToken, NEW_KEY)).toBe("tonal-access");
    expect(await decrypt(result.tonalRefreshToken!, NEW_KEY)).toBe("tonal-refresh");
    expect(result.geminiApiKeyEncrypted).toBeUndefined();
  });

  it("throws when the required tonalToken cannot be decrypted", async () => {
    const fields = {
      tonalToken: "garbage",
    };

    await expect(rotateProfileFields(fields, OLD_KEY, NEW_KEY)).rejects.toThrow();
  });

  it("throws when the old key does not match the ciphertext", async () => {
    const wrongKey = "c".repeat(64);
    const fields = {
      tonalToken: await encrypt("tonal-access", OLD_KEY),
    };

    await expect(rotateProfileFields(fields, wrongKey, NEW_KEY)).rejects.toThrow();
  });
});
