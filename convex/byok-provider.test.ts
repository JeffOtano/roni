import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BYOK_REQUIRED_AFTER, resolveProviderKey } from "./byok";
import { encrypt } from "./tonal/encryption";
import type { Doc } from "./_generated/dataModel";

describe("resolveProviderKey", () => {
  const originalByokDisabled = process.env.BYOK_DISABLED;
  const originalHouseKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const originalEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

  const TEST_ENCRYPTION_KEY = "22".repeat(32);
  const HOUSE_KEY = "AIzaHouseKey00000000000000000000000abcd";
  const GEMINI_USER_KEY = "AIzaSyA1B2C3D4E5F6G7H8I9J0KlMnOpQrStUvW";
  const CLAUDE_USER_KEY = "sk-ant-test-key-for-claude-provider";
  const OPENROUTER_USER_KEY = "sk-or-v1-test-key-for-openrouter";

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

  it("returns gemini with house key for a grandfathered user with no selectedProvider", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = HOUSE_KEY;
    const grandfatheredCreationTime = BYOK_REQUIRED_AFTER - 1;

    const result = await resolveProviderKey(makeProfile(), grandfatheredCreationTime);

    expect(result).toEqual({ provider: "gemini", apiKey: HOUSE_KEY, isHouseKey: true });
  });

  it("returns BYOK provider for a grandfathered user who opted into another provider", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = HOUSE_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    const ciphertext = await encrypt(CLAUDE_USER_KEY, TEST_ENCRYPTION_KEY);
    const grandfatheredCreationTime = BYOK_REQUIRED_AFTER - 1;
    const profile = makeProfile({
      selectedProvider: "claude",
      claudeApiKeyEncrypted: ciphertext,
    });

    const result = await resolveProviderKey(profile, grandfatheredCreationTime);

    expect(result.provider).toBe("claude");
    expect(result.apiKey).toBe(CLAUDE_USER_KEY);
  });

  it("falls back to house key for grandfathered user with non-gemini selectedProvider but no key", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = HOUSE_KEY;
    const grandfatheredCreationTime = BYOK_REQUIRED_AFTER - 1;
    const profile = makeProfile({ selectedProvider: "claude" });

    const result = await resolveProviderKey(profile, grandfatheredCreationTime);

    expect(result).toEqual({ provider: "gemini", apiKey: HOUSE_KEY, isHouseKey: true });
  });

  it("returns gemini with house key when kill switch is active", async () => {
    process.env.BYOK_DISABLED = "true";
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = HOUSE_KEY;
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    const result = await resolveProviderKey(
      makeProfile({ geminiApiKeyEncrypted: undefined }),
      byokCreationTime,
    );

    expect(result).toEqual({ provider: "gemini", apiKey: HOUSE_KEY, isHouseKey: true });
  });

  it("throws byok_key_missing when BYOK user has no key for selectedProvider", async () => {
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    await expect(
      resolveProviderKey(makeProfile({ selectedProvider: "claude" }), byokCreationTime),
    ).rejects.toThrow("byok_key_missing");
  });

  it("throws byok_key_missing when profile is null for BYOK user", async () => {
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    await expect(resolveProviderKey(null, byokCreationTime)).rejects.toThrow("byok_key_missing");
  });

  it("returns the correct provider when selectedProvider is set to gemini", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    const ciphertext = await encrypt(GEMINI_USER_KEY, TEST_ENCRYPTION_KEY);
    const profile = makeProfile({
      selectedProvider: "gemini",
      geminiApiKeyEncrypted: ciphertext,
    });
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    const result = await resolveProviderKey(profile, byokCreationTime);

    expect(result.provider).toBe("gemini");
    expect(result.apiKey).toBe(GEMINI_USER_KEY);
  });

  it("returns the correct provider when selectedProvider is set to claude", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    const ciphertext = await encrypt(CLAUDE_USER_KEY, TEST_ENCRYPTION_KEY);
    const profile = makeProfile({
      selectedProvider: "claude",
      claudeApiKeyEncrypted: ciphertext,
    });
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    const result = await resolveProviderKey(profile, byokCreationTime);

    expect(result.provider).toBe("claude");
    expect(result.apiKey).toBe(CLAUDE_USER_KEY);
  });

  it("defaults to gemini when selectedProvider is undefined", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    const ciphertext = await encrypt(GEMINI_USER_KEY, TEST_ENCRYPTION_KEY);
    const profile = makeProfile({
      geminiApiKeyEncrypted: ciphertext,
    });
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    const result = await resolveProviderKey(profile, byokCreationTime);

    expect(result.provider).toBe("gemini");
    expect(result.apiKey).toBe(GEMINI_USER_KEY);
  });

  it("omits modelOverride for non-OpenRouter providers", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    const ciphertext = await encrypt(GEMINI_USER_KEY, TEST_ENCRYPTION_KEY);
    const profile = makeProfile({
      geminiApiKeyEncrypted: ciphertext,
      modelOverride: "gemini-2.5-pro",
    });
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    const result = await resolveProviderKey(profile, byokCreationTime);

    expect(result).toEqual({
      provider: "gemini",
      apiKey: GEMINI_USER_KEY,
    });
  });

  it("omits modelOverride for grandfathered users falling back to house key", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = HOUSE_KEY;
    const grandfatheredCreationTime = BYOK_REQUIRED_AFTER - 1;

    const result = await resolveProviderKey(
      makeProfile({ modelOverride: "some-model" }),
      grandfatheredCreationTime,
    );

    expect(result.modelOverride).toBeUndefined();
  });

  it("omits modelOverride for grandfathered user on a non-OpenRouter provider", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = HOUSE_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    const ciphertext = await encrypt(CLAUDE_USER_KEY, TEST_ENCRYPTION_KEY);
    const grandfatheredCreationTime = BYOK_REQUIRED_AFTER - 1;
    const profile = makeProfile({
      selectedProvider: "claude",
      claudeApiKeyEncrypted: ciphertext,
      modelOverride: "claude-opus-4-20250514",
    });

    const result = await resolveProviderKey(profile, grandfatheredCreationTime);

    expect(result.modelOverride).toBeUndefined();
  });

  it("omits modelOverride when kill switch is active", async () => {
    process.env.BYOK_DISABLED = "true";
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = HOUSE_KEY;
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    const result = await resolveProviderKey(
      makeProfile({ modelOverride: "some-model" }),
      byokCreationTime,
    );

    expect(result.modelOverride).toBeUndefined();
  });

  it("ignores invalid selectedProvider and falls back to gemini", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    const ciphertext = await encrypt(GEMINI_USER_KEY, TEST_ENCRYPTION_KEY);
    const profile = makeProfile({
      selectedProvider: "invalid_provider",
      geminiApiKeyEncrypted: ciphertext,
    });
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    const result = await resolveProviderKey(profile, byokCreationTime);

    expect(result.provider).toBe("gemini");
    expect(result.apiKey).toBe(GEMINI_USER_KEY);
  });

  it("uses the OpenRouter default model when no override is set", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    const ciphertext = await encrypt(OPENROUTER_USER_KEY, TEST_ENCRYPTION_KEY);
    const profile = makeProfile({
      selectedProvider: "openrouter",
      openrouterApiKeyEncrypted: ciphertext,
    });
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    const result = await resolveProviderKey(profile, byokCreationTime);

    expect(result).toEqual({
      provider: "openrouter",
      apiKey: OPENROUTER_USER_KEY,
    });
  });

  it("returns OpenRouter when the model override is present", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    const ciphertext = await encrypt(OPENROUTER_USER_KEY, TEST_ENCRYPTION_KEY);
    const profile = makeProfile({
      selectedProvider: "openrouter",
      openrouterApiKeyEncrypted: ciphertext,
      modelOverride: "openai/gpt-5.4-mini",
    });
    const byokCreationTime = BYOK_REQUIRED_AFTER + 1000;

    const result = await resolveProviderKey(profile, byokCreationTime);

    expect(result).toEqual({
      provider: "openrouter",
      apiKey: OPENROUTER_USER_KEY,
      modelOverride: "openai/gpt-5.4-mini",
    });
  });
});
