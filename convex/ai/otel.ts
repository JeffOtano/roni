"use node";

// `"use node"` required: @opentelemetry/core reads `performance` at import,
// which the default V8 isolate doesn't expose.

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

// Workaround for PostHog's Vercel AI SDK v6 gap: drops `ai.telemetry.metadata.*`,
// skips `msToFirstChunk` → `$ai_time_to_first_token`, and ignores distinct_id on
// span attributes (only reads it from the OTel Resource). Remove once PostHog
// catches up to AI SDK v6.
export function translatedAttributes(
  attrs: ReadableSpan["attributes"],
): ReadableSpan["attributes"] {
  const out: Record<string, unknown> = { ...attrs };
  const METADATA_PREFIX = "ai.telemetry.metadata.";
  for (const [key, value] of Object.entries(attrs)) {
    if (!key.startsWith(METADATA_PREFIX)) continue;
    const shortKey = key.slice(METADATA_PREFIX.length);
    if (shortKey === "posthog_distinct_id") continue;
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

export function translateSpan(span: ReadableSpan): ReadableSpan {
  const translatedAttrs = translatedAttributes(span.attributes);
  const distinctId = span.attributes["ai.telemetry.metadata.posthog_distinct_id"];
  const mergedResource =
    typeof distinctId === "string"
      ? span.resource.merge(
          resourceFromAttributes({ "posthog.distinct_id": distinctId, "user.id": distinctId }),
        )
      : span.resource;
  // Proxy preserves method bindings (`spanContext()`) while swapping attributes + resource.
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

function initProvider(): BasicTracerProvider | null {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) return null;
  const exporter = new TranslatingExporter(
    new PostHogTraceExporter({
      apiKey,
      host: process.env.POSTHOG_HOST ?? "https://us.i.posthog.com",
    }),
  );
  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes({ "service.name": "roni-coach" }),
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });
  trace.setGlobalTracerProvider(provider);
  return provider;
}

const telemetryProvider: BasicTracerProvider | null = initProvider();

// Must run before the action returns — Convex kills in-flight exports on exit.
export async function flushTelemetry(): Promise<void> {
  if (!telemetryProvider) return;
  try {
    await telemetryProvider.forceFlush();
  } catch {
    // Never break the primary flow on telemetry failure.
  }
}
