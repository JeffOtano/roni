import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BYOK_REQUIRED_AFTER,
  isBYOKRequired,
  maskGeminiKey,
  prepareGeminiKeyForStorage,
  resolveGeminiKey,
  validateGeminiKeyAgainstGoogle,
} from "./byok";
import { decrypt, encrypt } from "./tonal/encryption";
import type { Doc } from "./_generated/dataModel";

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

describe("prepareGeminiKeyForStorage", () => {
  const TEST_ENCRYPTION_KEY = "00".repeat(32);
  const VALID_KEY = "AIzaSyA1B2C3D4E5F6G7H8I9J0KlMnOpQrStUvW";

  it("returns ciphertext that does not contain the plaintext key", async () => {
    const { encrypted } = await prepareGeminiKeyForStorage(VALID_KEY, TEST_ENCRYPTION_KEY);
    expect(encrypted).not.toContain(VALID_KEY);
  });

  it("trims leading and trailing whitespace before validating and encrypting", async () => {
    const padded = `   ${VALID_KEY}   `;
    const { encrypted } = await prepareGeminiKeyForStorage(padded, TEST_ENCRYPTION_KEY);
    const decrypted = await decrypt(encrypted, TEST_ENCRYPTION_KEY);
    expect(decrypted).toBe(VALID_KEY);
  });

  it("trims trailing newlines before validating and encrypting", async () => {
    const withNewlines = `${VALID_KEY}\n\n`;
    const { encrypted } = await prepareGeminiKeyForStorage(withNewlines, TEST_ENCRYPTION_KEY);
    const decrypted = await decrypt(encrypted, TEST_ENCRYPTION_KEY);
    expect(decrypted).toBe(VALID_KEY);
  });

  it("rejects a key that does not match the Gemini format", async () => {
    await expect(prepareGeminiKeyForStorage("not_a_key", TEST_ENCRYPTION_KEY)).rejects.toThrow(
      /Invalid Gemini API key format/,
    );
  });

  it("rejects an empty string", async () => {
    await expect(prepareGeminiKeyForStorage("", TEST_ENCRYPTION_KEY)).rejects.toThrow(
      /Invalid Gemini API key format/,
    );
  });

  it("rejects a key with the AIza prefix but wrong length", async () => {
    const tooShort = "AIzaShort";
    await expect(prepareGeminiKeyForStorage(tooShort, TEST_ENCRYPTION_KEY)).rejects.toThrow(
      /Invalid Gemini API key format/,
    );
  });

  it("sets addedAt to approximately Date.now()", async () => {
    const before = Date.now();
    const { addedAt } = await prepareGeminiKeyForStorage(VALID_KEY, TEST_ENCRYPTION_KEY);
    const after = Date.now();
    expect(addedAt).toBeGreaterThanOrEqual(before);
    expect(addedAt).toBeLessThanOrEqual(after);
  });

  it("encrypts such that decrypt roundtrips back to the original key", async () => {
    const { encrypted } = await prepareGeminiKeyForStorage(VALID_KEY, TEST_ENCRYPTION_KEY);
    const decrypted = await decrypt(encrypted, TEST_ENCRYPTION_KEY);
    expect(decrypted).toBe(VALID_KEY);
  });
});

describe("resolveGeminiKey", () => {
  // Save and restore env vars across tests so the suite never leaks state
  // into other test files. resolveGeminiKey reads three env vars at call time:
  // BYOK_DISABLED, GOOGLE_GENERATIVE_AI_API_KEY, and TOKEN_ENCRYPTION_KEY.
  const originalByokDisabled = process.env.BYOK_DISABLED;
  const originalHouseKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const originalEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

  const TEST_ENCRYPTION_KEY = "11".repeat(32);
  const HOUSE_KEY = "AIzaHouseKey00000000000000000000000abcd";
  const USER_KEY = "AIzaSyA1B2C3D4E5F6G7H8I9J0KlMnOpQrStUvW";

  beforeEach(() => {
    delete process.env.BYOK_DISABLED;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (originalByokDisabled === undefined) delete process.env.BYOK_DISABLED;
    else process.env.BYOK_DISABLED = originalByokDisabled;
    if (originalHouseKey === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalHouseKey;
    if (originalEncryptionKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = originalEncryptionKey;
  });

  function makeProfile(overrides: Partial<Doc<"userProfiles">> = {}): Doc<"userProfiles"> {
    return {
      _id: "profile_test_id" as Doc<"userProfiles">["_id"],
      _creationTime: 1,
      userId: "user_test_id" as Doc<"userProfiles">["userId"],
      ...overrides,
    } as Doc<"userProfiles">;
  }

  it("returns the house key for a grandfathered user", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = HOUSE_KEY;
    const grandfatheredCreationTime = BYOK_REQUIRED_AFTER - 1;

    const result = await resolveGeminiKey(makeProfile(), grandfatheredCreationTime);

    expect(result).toBe(HOUSE_KEY);
  });

  it("throws byok_key_missing when a BYOK user has no key on file", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = HOUSE_KEY;
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    await expect(
      resolveGeminiKey(makeProfile({ geminiApiKeyEncrypted: undefined }), byokCreationTime),
    ).rejects.toThrow("byok_key_missing");

    // Also covers the null-profile case, which the saveGeminiKey path can
    // produce if the userProfiles row is somehow missing.
    await expect(resolveGeminiKey(null, byokCreationTime)).rejects.toThrow("byok_key_missing");
  });

  it("decrypts and returns the user's key for a BYOK user with a key on file", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    const ciphertext = await encrypt(USER_KEY, TEST_ENCRYPTION_KEY);
    const profile = makeProfile({
      geminiApiKeyEncrypted: ciphertext,
      geminiApiKeyAddedAt: 12345,
    });
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    const result = await resolveGeminiKey(profile, byokCreationTime);

    expect(result).toBe(USER_KEY);
  });

  it("returns the house key when BYOK_DISABLED is set, regardless of user state", async () => {
    process.env.BYOK_DISABLED = "true";
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = HOUSE_KEY;
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    // Even though this user is post-BYOK and has no key on file (which would
    // normally throw byok_key_missing), the kill switch forces the house key.
    const result = await resolveGeminiKey(
      makeProfile({ geminiApiKeyEncrypted: undefined }),
      byokCreationTime,
    );

    expect(result).toBe(HOUSE_KEY);
  });

  it("end-to-end: prepareGeminiKeyForStorage ciphertext resolves back to the original key", async () => {
    // Composite regression guard: the encrypt-in-save path and the
    // decrypt-in-resolve path must use the same encryption key format.
    // If the save mutation ever uses a different key or encoding than
    // resolveGeminiKey expects, grandfathered users could be fine while
    // every BYOK user's key silently becomes unreadable at chat time.
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

    const { encrypted, addedAt } = await prepareGeminiKeyForStorage(USER_KEY, TEST_ENCRYPTION_KEY);
    const profile = makeProfile({
      geminiApiKeyEncrypted: encrypted,
      geminiApiKeyAddedAt: addedAt,
    });
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    const resolved = await resolveGeminiKey(profile, byokCreationTime);

    expect(resolved).toBe(USER_KEY);
  });
});

describe("_checkHouseKeyQuota", () => {
  it("is exported as an internalMutation", async () => {
    const { _checkHouseKeyQuota } = await import("./byok");
    expect(_checkHouseKeyQuota).toBeDefined();
  });
});

describe("maskGeminiKey", () => {
  it("returns the last 4 characters of a full Gemini key", () => {
    const key = "AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R";
    expect(maskGeminiKey(key)).toBe("6Q7R");
  });

  it("never returns more than 4 characters even for long inputs", () => {
    const long = "x".repeat(200);
    expect(maskGeminiKey(long)).toHaveLength(4);
  });

  it("returns the entire string when input is shorter than 4 characters", () => {
    expect(maskGeminiKey("abc")).toBe("abc");
  });

  it("returns an empty string for empty input", () => {
    expect(maskGeminiKey("")).toBe("");
  });
});
