import { describe, expect, it } from "vitest";
import {
  getProviderConfig,
  isValidProvider,
  type ProviderId,
  PROVIDERS,
  validateKeyFormat,
} from "./providers";

describe("PROVIDERS registry", () => {
  it("contains all four providers", () => {
    const ids = Object.keys(PROVIDERS);
    expect(ids).toContain("gemini");
    expect(ids).toContain("claude");
    expect(ids).toContain("openai");
    expect(ids).toContain("openrouter");
    expect(ids).toHaveLength(4);
  });

  it("each provider has required fields", () => {
    for (const [id, config] of Object.entries(PROVIDERS)) {
      expect(config.label, `${id}.label`).toBeTruthy();
      expect(config.keyRegex, `${id}.keyRegex`).toBeInstanceOf(RegExp);
      expect(config.keyFormatError, `${id}.keyFormatError`).toBeTruthy();
      expect(config.keySourceUrl, `${id}.keySourceUrl`).toBeTruthy();
      expect(config.keyPlaceholder, `${id}.keyPlaceholder`).toBeTruthy();
    }
  });
});

describe("validateKeyFormat", () => {
  it("accepts valid Gemini key", () => {
    expect(validateKeyFormat("gemini", "AIzaSyA1234567890abcdefghijklmnopqrstuv")).toBe(true);
  });

  it("rejects invalid Gemini key", () => {
    expect(validateKeyFormat("gemini", "sk-ant-bad")).toBe(false);
  });

  it("accepts valid Claude key", () => {
    expect(validateKeyFormat("claude", "sk-ant-api03-abc123")).toBe(true);
  });

  it("accepts valid OpenAI key", () => {
    expect(validateKeyFormat("openai", "sk-proj-abc123")).toBe(true);
  });

  it("rejects Claude key as OpenAI", () => {
    expect(validateKeyFormat("openai", "sk-ant-api03-abc123")).toBe(false);
  });

  it("rejects OpenRouter key as OpenAI", () => {
    expect(validateKeyFormat("openai", "sk-or-v1-abc123")).toBe(false);
  });

  it("accepts valid OpenRouter key", () => {
    expect(validateKeyFormat("openrouter", "sk-or-v1-abc123")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(validateKeyFormat("gemini", "")).toBe(false);
  });
});

describe("getProviderConfig", () => {
  it("returns config for valid provider", () => {
    const config = getProviderConfig("gemini");
    expect(config.label).toBe("Google Gemini");
  });

  it("uses the quality-first default models", () => {
    expect(getProviderConfig("gemini").primaryModel).toBe("gemini-3-flash-preview");
    expect(getProviderConfig("claude").primaryModel).toBe("claude-sonnet-4-6");
    expect(getProviderConfig("claude").fallbackModel).toBe("claude-haiku-4-5");
    expect(getProviderConfig("openai").primaryModel).toBe("gpt-5.4");
    expect(getProviderConfig("openai").fallbackModel).toBe("gpt-5.4-mini");
    expect(getProviderConfig("openrouter").primaryModel).toBe("openrouter/auto");
  });

  it("throws for invalid provider", () => {
    expect(() => getProviderConfig("invalid" as ProviderId)).toThrow();
  });
});

describe("isValidProvider", () => {
  it("returns true for valid providers", () => {
    expect(isValidProvider("gemini")).toBe(true);
    expect(isValidProvider("claude")).toBe(true);
    expect(isValidProvider("openai")).toBe(true);
    expect(isValidProvider("openrouter")).toBe(true);
  });

  it("returns false for invalid providers", () => {
    expect(isValidProvider("gpt")).toBe(false);
    expect(isValidProvider("")).toBe(false);
  });
});
