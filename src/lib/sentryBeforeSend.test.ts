import { describe, expect, it } from "vitest";
import type { ErrorEvent, EventHint } from "@sentry/nextjs";
import { sentryBeforeSend, shouldDropSentryEvent } from "./sentryBeforeSend";

function eventWithValue(value: string): ErrorEvent {
  return { exception: { values: [{ value }] } } as unknown as ErrorEvent;
}

function hintWithError(message: string): EventHint {
  return { originalException: new Error(message) };
}

describe("shouldDropSentryEvent", () => {
  it.each([
    "byok_key_missing",
    "byok_model_missing",
    "byok_key_invalid",
    "byok_quota_exceeded",
    "byok_safety_blocked",
    "byok_unknown_error",
    "house_key_quota_exhausted",
    "tonal_invalid_credentials",
  ])("drops sentinel code %s", (code) => {
    const event = eventWithValue(`Uncaught Error: ${code}`);
    const hint = hintWithError(code);
    expect(shouldDropSentryEvent(event, hint)).toBe(true);
  });

  it("drops Convex RateLimited errors", () => {
    const payload = 'ConvexError: {"kind":"RateLimited","name":"dailyMessages"}';
    expect(shouldDropSentryEvent(eventWithValue(payload), hintWithError(payload))).toBe(true);
  });

  it("drops Not authenticated auth-guard races", () => {
    expect(
      shouldDropSentryEvent(
        eventWithValue("Uncaught Error: Not authenticated"),
        hintWithError("Not authenticated"),
      ),
    ).toBe(true);
  });

  it("drops wrong-email-or-password legacy messages", () => {
    expect(
      shouldDropSentryEvent(
        eventWithValue("Uncaught Error: Wrong email or password."),
        hintWithError("Wrong email or password."),
      ),
    ).toBe(true);
  });

  it("drops Gemini turn-ordering errors", () => {
    const payload =
      "Please ensure that function call turn comes immediately after a user turn or after a function response turn.";
    expect(shouldDropSentryEvent(eventWithValue(payload), hintWithError(payload))).toBe(true);
  });

  it("drops Gemini quota errors (including AI SDK retry-wrapped form)", () => {
    const wrapped =
      "Failed after 3 attempts. Last error: You exceeded your current quota, please check your plan and billing details.";
    expect(shouldDropSentryEvent(eventWithValue(wrapped), hintWithError(wrapped))).toBe(true);
  });

  it("drops truncated Gemini quota variants (no billing-details suffix)", () => {
    const truncated = "You exceeded your current quota, please check your plan.";
    expect(shouldDropSentryEvent(eventWithValue(truncated), hintWithError(truncated))).toBe(true);
  });

  it("drops Gemini free-tier metric quota errors (generate_content_free_tier_requests)", () => {
    const msg =
      "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3-flash";
    expect(shouldDropSentryEvent(eventWithValue(msg), hintWithError(msg))).toBe(true);
  });

  it("drops Gemini prepayment-credits-depleted billing errors", () => {
    const payload =
      "Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.";
    expect(shouldDropSentryEvent(eventWithValue(payload), hintWithError(payload))).toBe(true);
  });

  it("drops Gemini high-demand / overload errors", () => {
    const payload =
      "This model is currently experiencing high demand. Spikes in demand are usually temporary.";
    expect(shouldDropSentryEvent(eventWithValue(payload), hintWithError(payload))).toBe(true);
  });

  it("drops Gemini RESOURCE_EXHAUSTED errors", () => {
    const payload = "Error: 429 RESOURCE_EXHAUSTED";
    expect(shouldDropSentryEvent(eventWithValue(payload), hintWithError(payload))).toBe(true);
  });

  it("drops Firefox iOS reader-mode injection noise", () => {
    const payload = "undefined is not an object (evaluating 'window.__firefox__.reader')";
    expect(shouldDropSentryEvent(eventWithValue(payload), hintWithError(payload))).toBe(true);
  });

  it("drops Chrome extension runtime.sendMessage noise", () => {
    const payload = "Invalid call to runtime.sendMessage(). Tab not found.";
    expect(shouldDropSentryEvent(eventWithValue(payload), hintWithError(payload))).toBe(true);
  });

  it("drops cross-origin Script error noise", () => {
    expect(
      shouldDropSentryEvent(eventWithValue("Script error."), hintWithError("Script error.")),
    ).toBe(true);
  });

  it("drops benign ResizeObserver loop warnings", () => {
    const payload = "ResizeObserver loop completed with undelivered notifications.";
    expect(shouldDropSentryEvent(eventWithValue(payload), hintWithError(payload))).toBe(true);
  });

  it("drops third-party minified n.standardSelectors errors", () => {
    const payload =
      "TypeError: Cannot read properties of undefined (reading 'n.standardSelectors')";
    expect(shouldDropSentryEvent(eventWithValue(payload), hintWithError(payload))).toBe(true);
  });

  it("keeps real errors", () => {
    const event = eventWithValue("TypeError: Cannot read properties of undefined");
    const hint = hintWithError("TypeError: Cannot read properties of undefined");
    expect(shouldDropSentryEvent(event, hint)).toBe(false);
  });

  it("falls back to event.exception value when originalException is missing", () => {
    const event = eventWithValue("Uncaught Error: byok_quota_exceeded");
    expect(shouldDropSentryEvent(event, {})).toBe(true);
  });

  it("drops event when hint has generic message but exception value contains quota error", () => {
    // Real-world scenario: the AI SDK wraps the error with a generic message
    // while the original quota error is preserved in event.exception.values.
    const quotaMsg = "You exceeded your current quota, please check your plan and billing details.";
    const event: ErrorEvent = {
      exception: {
        values: [{ value: "Failed to process stream" }, { value: quotaMsg }],
      },
    } as unknown as ErrorEvent;
    const hint = hintWithError("Failed to process stream");
    expect(shouldDropSentryEvent(event, hint)).toBe(true);
  });

  it("drops event when hint has generic message but exception value contains free-tier metric", () => {
    const metricMsg =
      "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3-flash";
    const event: ErrorEvent = {
      exception: {
        values: [{ value: metricMsg }],
      },
    } as unknown as ErrorEvent;
    const hint = hintWithError("Error reading stream");
    expect(shouldDropSentryEvent(event, hint)).toBe(true);
  });

  it("keeps event when no message source contains a suppressed substring", () => {
    const event: ErrorEvent = {
      exception: {
        values: [{ value: "Something unexpected went wrong" }],
      },
    } as unknown as ErrorEvent;
    const hint = hintWithError("Something unexpected went wrong");
    expect(shouldDropSentryEvent(event, hint)).toBe(false);
  });
});

describe("sentryBeforeSend", () => {
  it("returns null for dropped events", () => {
    const event = eventWithValue("Uncaught Error: byok_key_missing");
    expect(sentryBeforeSend(event, hintWithError("byok_key_missing"))).toBeNull();
  });

  it("returns the event unchanged for real errors", () => {
    const event = eventWithValue("ReferenceError: foo is not defined");
    const hint = hintWithError("foo is not defined");
    expect(sentryBeforeSend(event, hint)).toBe(event);
  });
});
