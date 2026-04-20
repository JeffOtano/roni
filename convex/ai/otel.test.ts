import { describe, expect, it } from "vitest";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { translatedAttributes, translateSpan } from "./otel";

const USER_ID = "k5762r1m174t2cmjgb9178ptk582y3p6";
const TRACE_ID = "1049455d-e028-452c-94b2-2b6ef905ba4d";

function buildSpan(attrs: ReadableSpan["attributes"]): ReadableSpan {
  return {
    name: "ai.streamText",
    attributes: attrs,
    resource: resourceFromAttributes({ "service.name": "roni-coach" }),
    // Unused methods/fields filled with stubs so the Proxy passthrough has something to delegate to.
    events: [],
    links: [],
    status: { code: 0 },
    startTime: [0, 0],
    endTime: [0, 0],
    duration: [0, 0],
    ended: true,
    instrumentationScope: { name: "ai" },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    kind: 0,
    spanContext: () => ({ traceId: "", spanId: "", traceFlags: 0 }),
  } as unknown as ReadableSpan;
}

describe("translatedAttributes", () => {
  it("promotes ai.telemetry.metadata.<key> to top-level <key>", () => {
    const out = translatedAttributes({
      "ai.telemetry.metadata.threadId": "thread-1",
      "ai.telemetry.metadata.provider": "gemini",
    });
    expect(out.threadId).toBe("thread-1");
    expect(out.provider).toBe("gemini");
  });

  it("rewrites ai.telemetry.metadata.posthog_trace_id to posthog.trace_id", () => {
    const out = translatedAttributes({
      "ai.telemetry.metadata.posthog_trace_id": TRACE_ID,
    });
    expect(out["posthog.trace_id"]).toBe(TRACE_ID);
  });

  it("skips posthog_distinct_id at the attribute level (handled via Resource)", () => {
    const out = translatedAttributes({
      "ai.telemetry.metadata.posthog_distinct_id": USER_ID,
    });
    expect(out["posthog.distinct_id"]).toBeUndefined();
    expect(out["user.id"]).toBeUndefined();
  });

  it("converts ai.response.msToFirstChunk (ms) to $ai_time_to_first_token (s)", () => {
    const out = translatedAttributes({ "ai.response.msToFirstChunk": 2500 });
    expect(out["$ai_time_to_first_token"]).toBe(2.5);
  });

  it("leaves non-telemetry attributes untouched", () => {
    const out = translatedAttributes({
      "ai.model.id": "gemini-3-flash-preview",
      "ai.usage.inputTokens": 100,
    });
    expect(out["ai.model.id"]).toBe("gemini-3-flash-preview");
    expect(out["ai.usage.inputTokens"]).toBe(100);
  });
});

describe("translateSpan", () => {
  it("merges posthog.distinct_id and user.id into the Resource from metadata", () => {
    const span = buildSpan({
      "ai.telemetry.metadata.posthog_distinct_id": USER_ID,
    });
    const translated = translateSpan(span);
    const resourceAttrs = translated.resource.attributes;
    expect(resourceAttrs["posthog.distinct_id"]).toBe(USER_ID);
    expect(resourceAttrs["user.id"]).toBe(USER_ID);
    expect(resourceAttrs["service.name"]).toBe("roni-coach");
  });

  it("preserves the original Resource when no distinct_id is present", () => {
    const span = buildSpan({ "ai.model.id": "gemini-3-flash-preview" });
    const translated = translateSpan(span);
    expect(translated.resource.attributes["posthog.distinct_id"]).toBeUndefined();
  });

  it("exposes translated attributes while preserving other span fields", () => {
    const span = buildSpan({
      "ai.telemetry.metadata.threadId": "thread-abc",
      "ai.response.msToFirstChunk": 1200,
    });
    const translated = translateSpan(span);
    expect(translated.attributes.threadId).toBe("thread-abc");
    expect(translated.attributes["$ai_time_to_first_token"]).toBe(1.2);
    expect(translated.name).toBe("ai.streamText");
  });
});
