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

  it("drops raw Gemini high-demand error surfaced by AI SDK stream processing", () => {
    const msg =
      "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.";
    expect(shouldDropSentryEvent(eventWithValue(msg), hintWithError(msg))).toBe(true);
  });

  it("drops the friendly finalize message written by reportError for provider_overload", () => {
    const msg =
      "**Google Gemini is experiencing high demand right now** — this is on their end, not Roni.";
    expect(shouldDropSentryEvent(eventWithValue(msg), hintWithError(msg))).toBe(true);
  });

  it("keeps real errors", () => {
    const event = eventWithValue("TypeError: Cannot read properties of undefined");
    const hint = hintWithError("TypeError: Cannot read properties of undefined");
    expect(shouldDropSentryEvent(event, hint)).toBe(false);
  });

  it("keeps errors that mention 'on-demand' but not 'high demand'", () => {
    const msg = "Failed to fetch: network error in on-demand route";
    expect(shouldDropSentryEvent(eventWithValue(msg), hintWithError(msg))).toBe(false);
  });

  it("falls back to event.exception value when originalException is missing", () => {
    const event = eventWithValue("Uncaught Error: byok_quota_exceeded");
    expect(shouldDropSentryEvent(event, {})).toBe(true);
  });
});

describe("sentryBeforeSend", () => {
  it("returns null for dropped events", () => {
    const event = eventWithValue("Uncaught Error: byok_key_missing");
    expect(sentryBeforeSend(event, hintWithError("byok_key_missing"))).toBeNull();
  });

  it("returns null for raw Gemini high-demand stream error", () => {
    const msg = "This model is currently experiencing high demand.";
    expect(sentryBeforeSend(eventWithValue(msg), hintWithError(msg))).toBeNull();
  });

  it("returns the event unchanged for real errors", () => {
    const event = eventWithValue("ReferenceError: foo is not defined");
    const hint = hintWithError("foo is not defined");
    expect(sentryBeforeSend(event, hint)).toBe(event);
  });
});
