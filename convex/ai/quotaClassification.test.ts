import { APICallError } from "@ai-sdk/provider";
import { describe, expect, it } from "vitest";
import {
  buildProviderTransientMessage,
  classifyTransientError,
  isContextLimitError,
  isQuotaError,
} from "./transientErrors";

function apiCallError(overrides: {
  statusCode?: number;
  isRetryable?: boolean;
  responseBody?: string;
  message?: string;
}): APICallError {
  return new APICallError({
    message: overrides.message ?? "API call failed",
    url: "https://example.test/v1/messages",
    requestBodyValues: {},
    statusCode: overrides.statusCode,
    isRetryable: overrides.isRetryable ?? false,
    responseBody: overrides.responseBody,
  });
}

describe("isQuotaError", () => {
  it("returns true for 'You exceeded your current quota' message", () => {
    const error = new Error("You exceeded your current quota, please check your plan.");

    expect(isQuotaError(error)).toBe(true);
  });

  it("returns true for error with responseBody containing 'input_token_count'", () => {
    const error = apiCallError({
      statusCode: 429,
      responseBody: '{"error":{"message":"input_token_count limit reached"}}',
    });

    expect(isQuotaError(error)).toBe(true);
  });

  it("returns true for 'resource_exhausted' combined with 'quota'", () => {
    const error = new Error("RESOURCE_EXHAUSTED: quota exceeded for this project");

    expect(isQuotaError(error)).toBe(true);
  });

  it("returns true for 'insufficient_quota' message", () => {
    const error = new Error("insufficient_quota: you have used all your free tier credits");

    expect(isQuotaError(error)).toBe(true);
  });

  it("returns false for plain 'rate limit' message without quota indicators", () => {
    const error = new Error("Rate limit exceeded for this endpoint");

    expect(isQuotaError(error)).toBe(false);
  });

  it("returns false for non-Error string input", () => {
    expect(isQuotaError("some error string")).toBe(false);
  });

  it("returns false for undefined input", () => {
    expect(isQuotaError(undefined)).toBe(false);
  });

  it("returns true for APICallError with statusCode 429 and quota text in responseBody", () => {
    const error = apiCallError({
      statusCode: 429,
      responseBody: "you exceeded your current quota for gemini-3-flash",
    });

    expect(isQuotaError(error)).toBe(true);
  });
});

describe("isContextLimitError", () => {
  it("returns true when error message contains 'input_token_count'", () => {
    const error = new Error("input_token_count exceeds limit for this model");

    expect(isContextLimitError(error)).toBe(true);
  });

  it("returns true when responseBody contains 'input_token_count' via APICallError", () => {
    const error = apiCallError({
      statusCode: 429,
      responseBody: '{"error":{"code":"input_token_count","message":"token limit exceeded"}}',
    });

    expect(isContextLimitError(error)).toBe(true);
  });

  it("returns false for generic quota error without 'input_token_count'", () => {
    const error = new Error("RESOURCE_EXHAUSTED: quota exceeded for model");

    expect(isContextLimitError(error)).toBe(false);
  });

  it("returns false for non-Error input", () => {
    expect(isContextLimitError("input_token_count")).toBe(false);
    expect(isContextLimitError(undefined)).toBe(false);
  });

  it("returns false when input_token_count appears without a quota signal", () => {
    // Guards against a future regression that drops the quota/exceed/limit
    // requirement — a malformed-prompt error mentioning the field name
    // shouldn't be reclassified as a transient quota error.
    const error = new Error("validation failed for field input_token_count");

    expect(isContextLimitError(error)).toBe(false);
  });
});

describe("classifyTransientError (context_limit + quota)", () => {
  it("returns 'context_limit' when error contains 'input_token_count' in responseBody", () => {
    const error = apiCallError({
      statusCode: 429,
      isRetryable: true,
      responseBody: '{"error":{"code":"input_token_count","message":"token limit exceeded"}}',
    });

    expect(classifyTransientError(error)).toBe("context_limit");
  });

  it("returns 'rate_limit' for a non-input_token_count quota error", () => {
    const error = apiCallError({
      statusCode: 429,
      isRetryable: false,
      responseBody: "you exceeded your current quota for gemini-3-flash",
    });

    expect(classifyTransientError(error)).toBe("rate_limit");
  });

  it("returns 'context_limit' even when isTransientError would return false", () => {
    // A non-retryable 400 with input_token_count in body should still be
    // classified as context_limit because that check runs before isTransientError.
    const error = apiCallError({
      statusCode: 400,
      isRetryable: false,
      responseBody: "input_token_count exceeds the model maximum",
    });

    expect(classifyTransientError(error)).toBe("context_limit");
  });
});

describe("buildProviderTransientMessage with isByok flag", () => {
  it("builds rate-limit message without BYOK hint when isByok is true", () => {
    const msg = buildProviderTransientMessage("rate_limit", "gemini", true);

    expect(msg).toContain("Google Gemini");
    expect(msg).toContain("rate-limited");
    expect(msg).not.toContain("add your own");
  });

  it("builds rate-limit message with 'add your own ... API key' hint when isByok is false", () => {
    const msg = buildProviderTransientMessage("rate_limit", "gemini", false);

    expect(msg).toContain("Google Gemini");
    expect(msg).toContain("rate-limited");
    expect(msg).toContain("add your own");
    expect(msg).toContain("API key");
  });

  it("builds rate-limit message without BYOK hint when isByok is undefined", () => {
    const msg = buildProviderTransientMessage("rate_limit", "gemini");

    expect(msg).toContain("Google Gemini");
    expect(msg).toContain("rate-limited");
    expect(msg).not.toContain("add your own");
  });

  it("builds context-limit message containing 'fresh chat thread'", () => {
    const msg = buildProviderTransientMessage("context_limit", "gemini");

    expect(msg).toContain("Google Gemini");
    expect(msg).toContain("fresh chat thread");
  });
});

describe("classifyTransientError (general cases)", () => {
  it("returns null for non-transient errors", () => {
    expect(classifyTransientError(new Error("database blew up"))).toBeNull();
  });

  it("returns 'provider_overload' for 'high demand' message", () => {
    expect(
      classifyTransientError(new Error("This model is currently experiencing high demand.")),
    ).toBe("provider_overload");
  });

  it("returns 'provider_overload' for 'overloaded' message", () => {
    expect(classifyTransientError(new Error("The model is overloaded, try again."))).toBe(
      "provider_overload",
    );
  });

  it("returns 'provider_overload' for 'try again later'", () => {
    expect(classifyTransientError(new Error("Service busy — please try again later."))).toBe(
      "provider_overload",
    );
  });

  it("returns 'rate_limit' for explicit rate limit text", () => {
    expect(classifyTransientError(new Error("Rate limit exceeded"))).toBe("rate_limit");
  });

  it("returns 'rate_limit' for a 429 APICallError", () => {
    expect(
      classifyTransientError(apiCallError({ statusCode: 429, isRetryable: true, message: "" })),
    ).toBe("rate_limit");
  });

  it("returns 'timeout' for AbortError name", () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    expect(classifyTransientError(error)).toBe("timeout");
  });

  it("returns 'network' for fetch TypeError", () => {
    expect(classifyTransientError(new TypeError("fetch failed"))).toBe("network");
  });

  it("returns 'server_error' for a bare 500", () => {
    expect(classifyTransientError(Object.assign(new Error("Internal"), { status: 500 }))).toBe(
      "server_error",
    );
  });

  it("returns 'server_error' for a bare 504 gateway timeout", () => {
    expect(classifyTransientError(Object.assign(new Error("Bad"), { status: 504 }))).toBe(
      "server_error",
    );
  });

  it("falls back to 'provider_overload' for a retryable APICallError with no matching signal", () => {
    expect(
      classifyTransientError(
        apiCallError({ statusCode: 418, isRetryable: true, message: "teapot" }),
      ),
    ).toBe("provider_overload");
  });
});

describe("buildProviderTransientMessage (general cases)", () => {
  it("names the provider and blames upstream for overload", () => {
    const msg = buildProviderTransientMessage("provider_overload", "gemini");
    expect(msg).toContain("Google Gemini");
    expect(msg).toContain("not Roni");
    expect(msg).toContain("(/settings)");
  });

  it("keeps rate-limit messaging short and directive", () => {
    const msg = buildProviderTransientMessage("rate_limit", "claude");
    expect(msg).toContain("Anthropic Claude");
    expect(msg).toContain("rate-limited");
  });

  it("phrases timeouts as being on the provider's side", () => {
    const msg = buildProviderTransientMessage("timeout", "openai");
    expect(msg).toContain("OpenAI");
    expect(msg).toContain("timed out");
  });

  it("labels network hiccups against the provider name", () => {
    const msg = buildProviderTransientMessage("network", "openrouter");
    expect(msg).toContain("OpenRouter");
    expect(msg.toLowerCase()).toContain("network");
  });

  it("attributes server errors to the provider", () => {
    const msg = buildProviderTransientMessage("server_error", "gemini");
    expect(msg).toContain("Google Gemini");
    expect(msg).toContain("not Roni");
  });
});
