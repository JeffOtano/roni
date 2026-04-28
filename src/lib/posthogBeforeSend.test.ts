import { describe, expect, it } from "vitest";
import type { CaptureResult } from "posthog-js";
import { posthogBeforeSend, shouldDropPosthogEvent } from "./posthogBeforeSend";

function makeEvent(overrides: Partial<CaptureResult>): CaptureResult {
  return {
    uuid: "00000000-0000-0000-0000-000000000000",
    event: "$exception",
    properties: {},
    ...overrides,
  } as CaptureResult;
}

describe("shouldDropPosthogEvent", () => {
  it("returns false for non-exception events", () => {
    expect(
      shouldDropPosthogEvent(
        makeEvent({
          event: "$pageview",
          properties: { $exception_message: "function call turn comes immediately after" },
        }),
      ),
    ).toBe(false);
  });

  it("returns false for null events", () => {
    expect(shouldDropPosthogEvent(null)).toBe(false);
  });

  it("drops Gemini turn-ordering errors", () => {
    expect(
      shouldDropPosthogEvent(
        makeEvent({
          properties: {
            $exception_message:
              "Please ensure that function call turn comes immediately after a user turn or after a function response turn.",
          },
        }),
      ),
    ).toBe(true);
  });

  it("drops Gemini quota errors", () => {
    expect(
      shouldDropPosthogEvent(
        makeEvent({
          properties: {
            $exception_values: [{ value: "You exceeded your current quota, please check..." }],
          },
        }),
      ),
    ).toBe(true);
  });

  it("drops Gemini high-demand errors", () => {
    expect(
      shouldDropPosthogEvent(
        makeEvent({
          properties: {
            $exception_values: [{ value: "This model is currently experiencing high demand." }],
          },
        }),
      ),
    ).toBe(true);
  });

  it("drops Firefox reader-mode injection errors", () => {
    expect(
      shouldDropPosthogEvent(
        makeEvent({
          properties: {
            $exception_message:
              "undefined is not an object (evaluating 'window.__firefox__.reader')",
          },
        }),
      ),
    ).toBe(true);
  });

  it("drops Chrome extension runtime.sendMessage noise", () => {
    expect(
      shouldDropPosthogEvent(
        makeEvent({
          properties: {
            $exception_list: [{ value: "Invalid call to runtime.sendMessage(). Tab not found." }],
          },
        }),
      ),
    ).toBe(true);
  });

  it("drops BYOK error codes", () => {
    expect(
      shouldDropPosthogEvent(
        makeEvent({ properties: { $exception_message: "byok_quota_exceeded" } }),
      ),
    ).toBe(true);
  });

  it("drops cross-origin Script error noise", () => {
    expect(
      shouldDropPosthogEvent(makeEvent({ properties: { $exception_message: "Script error." } })),
    ).toBe(true);
  });

  it("keeps real errors", () => {
    expect(
      shouldDropPosthogEvent(
        makeEvent({
          properties: {
            $exception_message: "Cannot read properties of undefined (reading 'foo')",
          },
        }),
      ),
    ).toBe(false);
  });

  it("returns false when there is no exception payload", () => {
    expect(shouldDropPosthogEvent(makeEvent({ properties: {} }))).toBe(false);
  });
});

describe("posthogBeforeSend", () => {
  it("returns null for suppressed events", () => {
    const event = makeEvent({
      properties: { $exception_message: "ResizeObserver loop completed" },
    });
    expect(posthogBeforeSend(event)).toBeNull();
  });

  it("passes through unsuppressed events unchanged", () => {
    const event = makeEvent({
      properties: { $exception_message: "TypeError: real bug" },
    });
    expect(posthogBeforeSend(event)).toBe(event);
  });

  it("passes through null events unchanged", () => {
    expect(posthogBeforeSend(null)).toBeNull();
  });
});
