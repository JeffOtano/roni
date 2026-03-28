const POSTHOG_HOST = "https://us.i.posthog.com";

/**
 * Capture a PostHog $ai_generation event from a Convex action.
 * Uses direct fetch (no batching) since this is called once per LLM response.
 * Errors are swallowed — analytics must never break the primary flow.
 */
export async function captureAiGeneration(args: {
  distinctId: string;
  traceId?: string;
  spanName?: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  const properties: Record<string, unknown> = {
    $ai_model: args.model,
    $ai_provider: args.provider,
    $ai_input_tokens: args.inputTokens,
    $ai_output_tokens: args.outputTokens,
  };
  if (args.traceId !== undefined) properties.$ai_trace_id = args.traceId;
  if (args.spanName !== undefined) properties.$ai_span_name = args.spanName;
  if (args.cacheReadTokens !== undefined)
    properties.$ai_cache_read_input_tokens = args.cacheReadTokens;
  if (args.cacheWriteTokens !== undefined)
    properties.$ai_cache_creation_input_tokens = args.cacheWriteTokens;

  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event: "$ai_generation",
        distinct_id: args.distinctId,
        properties,
      }),
    });
  } catch {
    // Intentionally swallowed
  }
}

const pending: Array<{ distinctId: string; event: string; properties?: Record<string, unknown> }> =
  [];

function getApiKey(): string | undefined {
  return process.env.POSTHOG_PROJECT_TOKEN;
}

/**
 * Capture a server-side analytics event.
 * Safe to call even if PostHog is not configured (no-ops silently).
 * Events are batched and sent on flush().
 */
export function capture(userId: string, event: string, properties?: Record<string, unknown>): void {
  if (!getApiKey()) return;
  pending.push({ distinctId: userId, event, properties });
}

/**
 * Capture a system event not tied to a specific user.
 */
export function captureSystem(event: string, properties?: Record<string, unknown>): void {
  capture("system", event, properties);
}

/**
 * Flush pending events to PostHog via HTTP API. Call at the end of Convex actions.
 * Uses fetch() instead of posthog-node to avoid Node.js built-in dependencies,
 * which are not available in Convex's default V8 runtime.
 */
export async function flush(): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey || pending.length === 0) return;

  const batch = pending.splice(0, pending.length).map((e) => ({
    ...e,
    timestamp: new Date().toISOString(),
  }));

  try {
    await fetch(`${POSTHOG_HOST}/batch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, batch }),
    });
  } catch {
    // Fire-and-forget: don't break the action if analytics fails
  }
}
