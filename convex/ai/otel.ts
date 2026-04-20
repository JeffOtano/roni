"use node";

// OpenTelemetry depends on Node's built-in `performance`/`perf_hooks` APIs,
// which the default V8 isolate doesn't expose. `"use node"` forces this module
// into the Node runtime, matching its sole caller (convex/chatProcessing.ts).

import { trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import type { ExportResult } from "@opentelemetry/core";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PostHogTraceExporter } from "@posthog/ai/otel";

// PostHog's OTel ingestion for Vercel AI SDK v6 drops `ai.telemetry.metadata.*`
// and doesn't map `ai.response.msToFirstChunk` to `$ai_time_to_first_token`.
// Their Vercel integration was validated against AI SDK v5 and hasn't caught up
// to v6's attribute layout. We intercept outbound spans and re-emit the fields
// under keys PostHog does honor:
//   - `ai.telemetry.metadata.posthog_distinct_id` → `posthog.distinct_id`
//     (the OTel generic-path attribute PostHog uses for user linkage) + `user.id`
//   - `ai.response.msToFirstChunk` → `$ai_time_to_first_token` (in seconds)
//   - `ai.telemetry.metadata.<key>` → top-level `<key>` for custom props
export function translatedAttributes(
  attrs: ReadableSpan["attributes"],
): ReadableSpan["attributes"] {
  const out: Record<string, unknown> = { ...attrs };
  const METADATA_PREFIX = "ai.telemetry.metadata.";
  for (const [key, value] of Object.entries(attrs)) {
    if (!key.startsWith(METADATA_PREFIX)) continue;
    const shortKey = key.slice(METADATA_PREFIX.length);
    if (shortKey === "posthog_distinct_id") continue; // handled via Resource merge
    if (shortKey === "posthog_trace_id" && typeof value === "string") {
      out["posthog.trace_id"] = value;
    } else {
      out[shortKey] = value;
    }
  }
  const ttftMs = attrs["ai.response.msToFirstChunk"];
  if (typeof ttftMs === "number") {
    out["$ai_time_to_first_token"] = ttftMs / 1000;
  }
  return out as ReadableSpan["attributes"];
}

// ReadableSpan mixes properties and methods (`spanContext()` is a method). A
// Proxy preserves method bindings while swapping `attributes` and `resource`.
// The Resource swap is load-bearing: PostHog reads `posthog.distinct_id` from
// the Resource, not span attributes.
export function translateSpan(span: ReadableSpan): ReadableSpan {
  const translatedAttrs = translatedAttributes(span.attributes);
  const distinctId = span.attributes["ai.telemetry.metadata.posthog_distinct_id"];
  const mergedResource =
    typeof distinctId === "string"
      ? span.resource.merge(
          resourceFromAttributes({ "posthog.distinct_id": distinctId, "user.id": distinctId }),
        )
      : span.resource;
  return new Proxy(span, {
    get(target, prop, receiver) {
      if (prop === "attributes") return translatedAttrs;
      if (prop === "resource") return mergedResource;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

class TranslatingExporter implements SpanExporter {
  constructor(private readonly inner: SpanExporter) {}
  export(spans: ReadableSpan[], resultCallback: (r: ExportResult) => void): void {
    this.inner.export(spans.map(translateSpan), resultCallback);
  }
  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }
  forceFlush(): Promise<void> {
    return this.inner.forceFlush?.() ?? Promise.resolve();
  }
}

// Module-scope initialization so the provider persists across warm Node
// invocations; Convex doesn't expose a lifecycle hook for per-action setup.
// The PostHog Convex install guide specifies this pattern.
function initProvider(): BasicTracerProvider | null {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return null;

  const posthogExporter = new PostHogTraceExporter({
    apiKey,
    host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
  });
  const translatingExporter = new TranslatingExporter(posthogExporter);
  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({ "service.name": "roni-coach" }),
    spanProcessors: [new BatchSpanProcessor(translatingExporter)],
  });
  trace.setGlobalTracerProvider(provider);
  return provider;
}

const telemetryProvider: BasicTracerProvider | null = initProvider();

/**
 * Flush pending OTel spans before a Convex action returns. Required because
 * Convex actions terminate their Node context on return, killing any in-flight
 * background exports. Safe to call even if telemetry isn't configured.
 */
export async function flushTelemetry(): Promise<void> {
  if (!telemetryProvider) return;
  try {
    await telemetryProvider.forceFlush();
  } catch {
    // Telemetry must never break the primary flow.
  }
}
