import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const apiKey = process.env.POSTHOG_PROJECT_TOKEN;
  if (!apiKey) return null;

  if (!client) {
    client = new PostHog(apiKey, {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Capture a server-side analytics event.
 * Safe to call even if PostHog is not configured (no-ops silently).
 */
export function capture(userId: string, event: string, properties?: Record<string, unknown>): void {
  const ph = getClient();
  if (!ph) return;
  ph.capture({ distinctId: userId, event, properties });
}

/**
 * Capture a system event not tied to a specific user.
 */
export function captureSystem(event: string, properties?: Record<string, unknown>): void {
  capture("system", event, properties);
}

/**
 * Flush pending events. Call at the end of Convex actions.
 */
export async function flush(): Promise<void> {
  const ph = getClient();
  if (!ph) return;
  await ph.flush();
}
