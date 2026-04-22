import { describe, expect, it } from "vitest";
import { getScheduledFailureContent, shouldNotifyScheduledFailure } from "./chatHelpers";

describe("getScheduledFailureContent", () => {
  it("returns the missing-key message for BYOK-required users", () => {
    expect(getScheduledFailureContent(new Error("byok_key_missing"), "claude")).toBe(
      "You need to add an API key in Settings before chat can run.",
    );
  });

  it("returns the model-missing message before provider classification", () => {
    expect(getScheduledFailureContent(new Error("byok_model_missing"), "openrouter")).toBe(
      "The selected provider needs a model name before chat can start. Add one in Settings and try again.",
    );
  });

  it("returns the house-key cap message for grandfathered users", () => {
    expect(getScheduledFailureContent(new Error("house_key_quota_exhausted"), "gemini")).toBe(
      "You've used your 500 free AI messages this month. Add your own API key in Settings to keep going.",
    );
  });

  it("uses the provider-specific BYOK message for sanitized error codes", () => {
    const message = getScheduledFailureContent(new Error("byok_quota_exceeded"), "openai");
    expect(message).toContain("OpenAI is rejecting requests");
    expect(message).toContain("billing");
  });

  it("uses the generic fallback when no provider is known", () => {
    expect(getScheduledFailureContent(new Error("byok_key_invalid"))).toBe(
      "Your API key isn't working anymore. Check it in Settings and try again.",
    );
  });

  it("classifies raw provider errors when a provider is known", () => {
    const message = getScheduledFailureContent(
      new Error("You exceeded your current quota: insufficient_quota."),
      "openai",
    );
    expect(message).toContain("OpenAI is rejecting requests");
  });

  it("falls back to the generic chat error for unexpected failures", () => {
    expect(getScheduledFailureContent(new Error("database blew up"), "claude")).toBe(
      "I'm having trouble right now. Please try again in a moment.",
    );
  });

  it("falls back to the generic chat error for classifiable errors without a known provider", () => {
    expect(
      getScheduledFailureContent(new Error("You exceeded your current quota: insufficient_quota.")),
    ).toBe("I'm having trouble right now. Please try again in a moment.");
  });

  it("attributes 'high demand' errors to the upstream provider when provider is known", () => {
    const msg = getScheduledFailureContent(
      new Error("This model is currently experiencing high demand. Please try again later."),
      "gemini",
    );
    expect(msg).toContain("Google Gemini");
    expect(msg).toContain("not Roni");
    expect(msg).toContain("(/settings)");
  });

  it("attributes transient server errors to the provider", () => {
    const error = Object.assign(new Error("Internal"), { status: 503 });
    const msg = getScheduledFailureContent(error, "claude");
    expect(msg).toContain("Anthropic Claude");
  });

  it("stays generic for transient errors when provider is unknown", () => {
    expect(
      getScheduledFailureContent(new Error("This model is currently experiencing high demand.")),
    ).toBe("I'm having trouble right now. Please try again in a moment.");
  });
});

describe("shouldNotifyScheduledFailure", () => {
  it("does not notify on expected sentinel errors", () => {
    expect(shouldNotifyScheduledFailure(new Error("byok_key_missing"))).toBe(false);
    expect(shouldNotifyScheduledFailure(new Error("byok_model_missing"))).toBe(false);
    expect(shouldNotifyScheduledFailure(new Error("house_key_quota_exhausted"))).toBe(false);
  });

  it("does not notify on classified provider-state errors", () => {
    expect(
      shouldNotifyScheduledFailure(
        new Error("You exceeded your current quota: insufficient_quota."),
      ),
    ).toBe(false);
  });

  it("notifies on unexpected failures", () => {
    expect(shouldNotifyScheduledFailure(new Error("database blew up"))).toBe(true);
  });

  it("does not notify on transient provider outages", () => {
    expect(
      shouldNotifyScheduledFailure(new Error("This model is currently experiencing high demand.")),
    ).toBe(false);
    expect(
      shouldNotifyScheduledFailure(Object.assign(new Error("Unavailable"), { status: 503 })),
    ).toBe(false);
  });
});
