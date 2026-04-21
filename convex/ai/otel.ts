"use node";

// `"use node"` required: @opentelemetry/core reads `performance` at import,
// which the default V8 isolate doesn't expose.

import {
  context,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  type Span,
  SpanStatusCode,
  trace,
  type Tracer,
} from "@opentelemetry/api";
import type { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { register } from "@arizeai/phoenix-otel";

// Temporary: surface OTLP exporter failures (auth, network) to convex logs.
// Remove once Phoenix tracing is verified end-to-end.
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

const DEFAULT_COLLECTOR_ENDPOINT = "https://app.phoenix.arize.com";
const DEFAULT_PROJECT_NAME = "roni-coach";
const TRACER_NAME = "roni-coach";
const ROOT_SPAN_NAME = "roni.user_turn";

/**
 * Phoenix Cloud is the canonical AI trace destination. When PHOENIX_API_KEY is
 * unset we fall back to no-op spans so dev without credentials still runs —
 * `span.spanContext().traceId` in that case is all zeros, which we detect and
 * replace with a random trace id so `aiRun.runId` remains unique per turn.
 */
function initProvider(): NodeTracerProvider | null {
  const apiKey = process.env.PHOENIX_API_KEY;
  if (!apiKey) {
    console.log("[phoenix] PHOENIX_API_KEY not set — tracing disabled");
    return null;
  }
  const url =
    process.env.PHOENIX_COLLECTOR_ENDPOINT ??
    process.env.PHOENIX_HOST ??
    DEFAULT_COLLECTOR_ENDPOINT;
  const projectName = process.env.PHOENIX_PROJECT_NAME ?? DEFAULT_PROJECT_NAME;
  try {
    const provider = register({
      projectName,
      url,
      apiKey,
      batch: true,
      global: true,
    });
    console.log(`[phoenix] provider registered: url=${url} project=${projectName}`);
    return provider;
  } catch (error) {
    console.error("[phoenix] register() threw:", error);
    return null;
  }
}

const telemetryProvider: NodeTracerProvider | null = initProvider();

function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME);
}

export interface RunSpanMetadata {
  userId: string;
  threadId: string;
  source: "chat" | "approval_continuation";
  provider?: string;
  environment: "dev" | "prod";
  release?: string;
  promptVersion?: string;
  hasImages?: boolean;
  isByok?: boolean;
}

export interface RunSpanHandle {
  /** 32-char hex traceId from the span context. Safe to persist as `aiRun.runId`. */
  runId: string;
  /** Mark the span as errored for the Phoenix UI. */
  recordError(errorClass: string): void;
  /** Flush + end the span. Must be called in the caller's `finally`. */
  end(): Promise<void>;
}

const ZERO_TRACE_ID = "00000000000000000000000000000000";

/** Fallback id when no provider is registered so `aiRun.runId` stays unique. */
function fallbackTraceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Wrap a user turn in one Phoenix trace. Retries and fallback share the same
 * runId because the span is made active and the AI SDK's auto-created spans
 * inherit the parent context from {@link runInRunSpan}.
 */
export function startRunSpan(meta: RunSpanMetadata): { span: Span; handle: RunSpanHandle } {
  const span: Span = getTracer().startSpan(ROOT_SPAN_NAME, {
    attributes: buildSpanAttributes(meta),
  });
  const spanTraceId = span.spanContext().traceId;
  const runId = spanTraceId === ZERO_TRACE_ID ? fallbackTraceId() : spanTraceId;

  const handle: RunSpanHandle = {
    runId,
    recordError(errorClass: string) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute("roni.terminal_error_class", errorClass);
    },
    async end() {
      span.end();
      await flushTelemetry();
    },
  };
  return { span, handle };
}

/**
 * Runs `fn` inside the context of a new run span so child AI SDK spans inherit
 * its traceId. `fn` receives the handle so it can mark errors before returning.
 */
export async function runInRunSpan<T>(
  meta: RunSpanMetadata,
  fn: (handle: RunSpanHandle) => Promise<T>,
): Promise<T> {
  const { span, handle } = startRunSpan(meta);
  try {
    return await context.with(trace.setSpan(context.active(), span), () => fn(handle));
  } catch (error) {
    // Surface unhandled errors from the callback as a failed span so Phoenix
    // flags them. The caller still sees the rethrow.
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await handle.end();
  }
}

function buildSpanAttributes(meta: RunSpanMetadata): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {
    // Tag as an OpenInference CHAIN so Phoenix's Traces/Spans views include it.
    // Child AI SDK spans get LLM/TOOL kinds auto-translated by phoenix-otel's
    // OpenInferenceBatchSpanProcessor.
    "openinference.span.kind": "CHAIN",
    "roni.user_id": meta.userId,
    "roni.thread_id": meta.threadId,
    "roni.source": meta.source,
    "roni.environment": meta.environment,
    "user.id": meta.userId,
    "session.id": meta.threadId,
  };
  if (meta.provider) attrs["roni.provider"] = meta.provider;
  if (meta.release) attrs["roni.release"] = meta.release;
  if (meta.promptVersion) attrs["roni.prompt_version"] = meta.promptVersion;
  if (typeof meta.hasImages === "boolean") attrs["roni.has_images"] = meta.hasImages;
  if (typeof meta.isByok === "boolean") attrs["roni.is_byok"] = meta.isByok;
  return attrs;
}

/** Flush pending spans — Convex kills in-flight exports on action exit. */
export async function flushTelemetry(): Promise<void> {
  if (!telemetryProvider) {
    console.log("[phoenix] flushTelemetry: no provider configured");
    return;
  }
  try {
    await telemetryProvider.forceFlush();
    console.log("[phoenix] flushTelemetry: spans flushed");
  } catch (error) {
    console.error("[phoenix] flushTelemetry failed:", error);
  }
}

/** True when Phoenix is configured and spans will be exported. */
export function isPhoenixEnabled(): boolean {
  return telemetryProvider !== null;
}
