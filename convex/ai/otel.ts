"use node";

// `"use node"` required: @opentelemetry/core reads `performance` at import,
// which the default V8 isolate doesn't expose.

import { context, type Span, SpanStatusCode, trace, type Tracer } from "@opentelemetry/api";
import type { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { register } from "@arizeai/phoenix-otel";

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
  if (!apiKey) return null;
  const url =
    process.env.PHOENIX_COLLECTOR_ENDPOINT ?? process.env.PHOENIX_HOST ?? DEFAULT_COLLECTOR_ENDPOINT;
  const projectName = process.env.PHOENIX_PROJECT_NAME ?? DEFAULT_PROJECT_NAME;
  return register({
    projectName,
    url,
    apiKey,
    batch: true,
    global: true,
  });
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
  } finally {
    await handle.end();
  }
}

function buildSpanAttributes(meta: RunSpanMetadata): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {
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
  if (!telemetryProvider) return;
  try {
    await telemetryProvider.forceFlush();
  } catch {
    // Never break the primary flow on telemetry failure.
  }
}

/** True when Phoenix is configured and spans will be exported. */
export function isPhoenixEnabled(): boolean {
  return telemetryProvider !== null;
}
