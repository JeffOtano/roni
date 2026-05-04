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
    const event = makeEvent({
      event: "$pageview",
      properties: { $exception_message: "function call turn comes immediately after" },
    });

    const dropped = shouldDropPosthogEvent(event);

    expect(dropped).toBe(false);
  });

  it("returns false for null events", () => {
    const dropped = shouldDropPosthogEvent(null);

    expect(dropped).toBe(false);
  });

  it("drops Gemini turn-ordering errors", () => {
    const event = makeEvent({
      properties: {
        $exception_message:
          "Please ensure that function call turn comes immediately after a user turn or after a function response turn.",
      },
    });

    const dropped = shouldDropPosthogEvent(event);

    expect(dropped).toBe(true);
  });

  it("drops Gemini quota errors", () => {
    const event = makeEvent({
      properties: {
        $exception_values: [{ value: "You exceeded your current quota, please check..." }],
      },
    });

    const dropped = shouldDropPosthogEvent(event);

    expect(dropped).toBe(true);
  });

  it("drops AI SDK retry-wrapped quota errors", () => {
    const event = makeEvent({
      properties: {
        $exception_values: [
          {
            value:
              "Failed after 3 attempts. Last error: You exceeded your current quota, please check your plan and billing details.",
          },
        ],
      },
    });

    const dropped = shouldDropPosthogEvent(event);

    expect(dropped).toBe(true);
  });

  it("drops Gemini prepayment-credits-depleted billing errors", () => {
    const event = makeEvent({
      properties: {
        $exception_values: [
          {
            value:
              "Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.",
          },
        ],
      },
    });

    const dropped = shouldDropPosthogEvent(event);

    expect(dropped).toBe(true);
  });

  it("drops Gemini high-demand errors", () => {
    const event = makeEvent({
      properties: {
        $exception_values: [{ value: "This model is currently experiencing high demand." }],
      },
    });

    const dropped = shouldDropPosthogEvent(event);

    expect(dropped).toBe(true);
  });

  it("drops Firefox reader-mode injection errors", () => {
    const event = makeEvent({
      properties: {
        $exception_message: "undefined is not an object (evaluating 'window.__firefox__.reader')",
      },
    });

    const dropped = shouldDropPosthogEvent(event);

    expect(dropped).toBe(true);
  });

  it("drops Chrome extension runtime.sendMessage noise", () => {
    const event = makeEvent({
      properties: {
        $exception_list: [{ value: "Invalid call to runtime.sendMessage(). Tab not found." }],
      },
    });

    const dropped = shouldDropPosthogEvent(event);

    expect(dropped).toBe(true);
  });

  it("drops BYOK error codes", () => {
    const event = makeEvent({ properties: { $exception_message: "byok_quota_exceeded" } });

    const dropped = shouldDropPosthogEvent(event);

    expect(dropped).toBe(true);
  });

  it("drops cross-origin Script error noise", () => {
    const event = makeEvent({ properties: { $exception_message: "Script error." } });

    const dropped = shouldDropPosthogEvent(event);

    expect(dropped).toBe(true);
  });

  it("keeps real errors", () => {
    const event = makeEvent({
      properties: { $exception_message: "Cannot read properties of undefined (reading 'foo')" },
    });

    const dropped = shouldDropPosthogEvent(event);

    expect(dropped).toBe(false);
  });

  it("returns false when there is no exception payload", () => {
    const event = makeEvent({ properties: {} });

    const dropped = shouldDropPosthogEvent(event);

    expect(dropped).toBe(false);
  });
});

describe("posthogBeforeSend", () => {
  it("returns null for suppressed events", () => {
    const event = makeEvent({
      properties: { $exception_message: "ResizeObserver loop completed" },
    });

    const result = posthogBeforeSend(event);

    expect(result).toBeNull();
  });

  it("passes through unsuppressed events unchanged", () => {
    const event = makeEvent({ properties: { $exception_message: "TypeError: real bug" } });

    const result = posthogBeforeSend(event);

    expect(result).toBe(event);
  });

  it("passes through null events unchanged", () => {
    const result = posthogBeforeSend(null);

    expect(result).toBeNull();
  });
});
