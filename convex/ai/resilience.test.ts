import { APICallError } from "@ai-sdk/provider";
import { describe, expect, it } from "vitest";
import {
  buildByokErrorMessage,
  classifyByokError,
  isTransientError,
  withByokErrorSanitization,
} from "./resilience";
import { buildProviderTransientMessage, classifyTransientError } from "./transientErrors";

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

describe("isTransientError", () => {
  it("returns true for network errors", () => {
    expect(isTransientError(new TypeError("fetch failed"))).toBe(true);
  });

  it("returns true for 429 rate limit", () => {
    const error = Object.assign(new Error("Rate limited"), { status: 429 });
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for Gemini high demand message", () => {
    const error = new Error(
      "This model is currently experiencing high demand. Please try again later.",
    );
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for service unavailable message", () => {
    const error = new Error("The service is currently unavailable.");
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for 500 server error", () => {
    const error = Object.assign(new Error("Internal"), { status: 500 });
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for 502 bad gateway", () => {
    const error = Object.assign(new Error("Bad Gateway"), { status: 502 });
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for 503 service unavailable", () => {
    const error = Object.assign(new Error("Unavailable"), { status: 503 });
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for 504 gateway timeout with non-pattern message", () => {
    const error = Object.assign(new Error("Bad"), { status: 504 });
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for 529 Anthropic overloaded via bare status", () => {
    const error = Object.assign(new Error("overload"), { status: 529 });
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for timeout errors", () => {
    const error = new Error("Request timed out");
    error.name = "TimeoutError";
    expect(isTransientError(error)).toBe(true);
  });

  it("returns false for 400 bad request", () => {
    const error = Object.assign(new Error("Bad request"), { status: 400 });
    expect(isTransientError(error)).toBe(false);
  });

  it("returns false for 401 unauthorized", () => {
    const error = Object.assign(new Error("Unauthorized"), { status: 401 });
    expect(isTransientError(error)).toBe(false);
  });

  it("returns false for 403 forbidden", () => {
    const error = Object.assign(new Error("Forbidden"), { status: 403 });
    expect(isTransientError(error)).toBe(false);
  });

  it("returns true for AbortError by name", () => {
    const error = new Error("The operation was aborted");
    error.name = "AbortError";
    expect(isTransientError(error)).toBe(true);
  });

  it("returns true for errors containing 'aborted' in message", () => {
    expect(isTransientError(new Error("This operation was aborted"))).toBe(true);
  });

  it("returns false for generic errors without status", () => {
    expect(isTransientError(new Error("Something broke"))).toBe(false);
  });

  it("defers to APICallError.isRetryable = true", () => {
    expect(isTransientError(apiCallError({ statusCode: 529, isRetryable: true }))).toBe(true);
  });

  it("defers to APICallError.isRetryable = false even when status looks transient", () => {
    // SDK says don't retry (e.g., auth-layer 429), trust it.
    expect(isTransientError(apiCallError({ statusCode: 429, isRetryable: false }))).toBe(false);
  });
});

describe("classifyByokError", () => {
  it("classifies a 401 status as byok_key_invalid", () => {
    const error = Object.assign(new Error("Unauthorized"), { status: 401 });
    expect(classifyByokError(error)).toBe("byok_key_invalid");
  });

  it("classifies a 403 status as byok_key_invalid", () => {
    const error = Object.assign(new Error("Forbidden"), { status: 403 });
    expect(classifyByokError(error)).toBe("byok_key_invalid");
  });

  it("classifies an 'API key not valid' message as byok_key_invalid", () => {
    const error = new Error("API key not valid. Please pass a valid API key.");
    expect(classifyByokError(error)).toBe("byok_key_invalid");
  });

  it("classifies a 429 status as byok_quota_exceeded", () => {
    const error = Object.assign(new Error("Rate limited"), { status: 429 });
    expect(classifyByokError(error)).toBe("byok_quota_exceeded");
  });

  it("classifies 'credits are depleted' as byok_quota_exceeded", () => {
    const error = new Error(
      "Your prepayment credits are depleted. Please go to AI Studio to manage your billing.",
    );
    expect(classifyByokError(error)).toBe("byok_quota_exceeded");
  });

  it("classifies a 'quota' substring as byok_quota_exceeded", () => {
    const error = new Error("RESOURCE_EXHAUSTED: Quota exceeded for model.");
    expect(classifyByokError(error)).toBe("byok_quota_exceeded");
  });

  it("classifies Anthropic 'credit balance is too low' as byok_quota_exceeded", () => {
    const error = new Error(
      "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
    );
    expect(classifyByokError(error)).toBe("byok_quota_exceeded");
  });

  it("classifies an error whose billing text lives on responseBody", () => {
    const error = Object.assign(new Error("AI_APICallError: Bad Request"), {
      status: 400,
      responseBody: JSON.stringify({
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "Your credit balance is too low",
        },
      }),
    });
    expect(classifyByokError(error)).toBe("byok_quota_exceeded");
  });

  it("classifies an error whose auth text lives on cause.message", () => {
    const cause = new Error("invalid_api_key: authentication failed");
    const error = new Error("request failed");
    (error as Error & { cause?: unknown }).cause = cause;
    expect(classifyByokError(error)).toBe("byok_key_invalid");
  });

  it("classifies OpenAI 'insufficient_quota' as byok_quota_exceeded", () => {
    const error = new Error("You exceeded your current quota: insufficient_quota.");
    expect(classifyByokError(error)).toBe("byok_quota_exceeded");
  });

  it("classifies a 'safety' substring as byok_safety_blocked", () => {
    const error = new Error("Response was blocked due to safety filters");
    expect(classifyByokError(error)).toBe("byok_safety_blocked");
  });

  it("returns null for transient errors that are not BYOK-classifiable", () => {
    const error = Object.assign(new Error("Internal server error"), { status: 500 });
    expect(classifyByokError(error)).toBeNull();
  });

  it("returns null for non-Error inputs", () => {
    expect(classifyByokError("oops")).toBeNull();
    expect(classifyByokError(null)).toBeNull();
    expect(classifyByokError(undefined)).toBeNull();
  });

  it("classifies APICallError 401 via statusCode, not ad-hoc .status", () => {
    expect(classifyByokError(apiCallError({ statusCode: 401 }))).toBe("byok_key_invalid");
  });

  it("classifies APICallError 429 via statusCode", () => {
    expect(classifyByokError(apiCallError({ statusCode: 429 }))).toBe("byok_quota_exceeded");
  });

  it("classifies APICallError 400 billing body via responseBody", () => {
    const err = apiCallError({
      statusCode: 400,
      responseBody: JSON.stringify({ error: { message: "Your credit balance is too low" } }),
    });
    expect(classifyByokError(err)).toBe("byok_quota_exceeded");
  });
});

describe("buildByokErrorMessage", () => {
  it("names the provider and links to its billing page on quota", () => {
    const msg = buildByokErrorMessage("byok_quota_exceeded", "claude");

    expect(msg).toContain("Anthropic Claude");
    expect(msg).toContain("(https://console.anthropic.com/settings/billing)");
    expect(msg).toContain("(/settings)");
  });

  it("names the provider and links to settings on invalid key", () => {
    const msg = buildByokErrorMessage("byok_key_invalid", "gemini");

    expect(msg).toContain("Google Gemini");
    expect(msg).toContain("(/settings)");
  });

  it("uses the OpenAI billing URL for OpenAI quota errors", () => {
    const msg = buildByokErrorMessage("byok_quota_exceeded", "openai");

    expect(msg).toContain("OpenAI");
    expect(msg).toContain("(https://platform.openai.com/settings/organization/billing)");
  });
});

describe("classifyTransientError", () => {
  it("returns null for non-transient errors", () => {
    expect(classifyTransientError(new Error("database blew up"))).toBeNull();
  });

  it("returns 'provider_overload' for 'high demand'", () => {
    expect(
      classifyTransientError(new Error("This model is currently experiencing high demand.")),
    ).toBe("provider_overload");
  });

  it("returns 'provider_overload' for 'overloaded'", () => {
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

describe("buildProviderTransientMessage", () => {
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

describe("withByokErrorSanitization", () => {
  it("returns the wrapped function's result on success", async () => {
    const result = await withByokErrorSanitization(async () => "ok");
    expect(result).toBe("ok");
  });

  it("rethrows BYOK errors as the typed code without leaking the raw message", async () => {
    const leakKey = "AIza_leak_for_wrap_test";
    const error = new Error(`API key not valid (${leakKey})`);
    await expect(
      withByokErrorSanitization(async () => {
        throw error;
      }),
    ).rejects.toMatchObject({ message: "byok_key_invalid" });
  });

  it("rethrows non-BYOK errors unchanged so transient handling can run", async () => {
    const original = Object.assign(new Error("Internal server error"), { status: 500 });
    await expect(
      withByokErrorSanitization(async () => {
        throw original;
      }),
    ).rejects.toBe(original);
  });
});
