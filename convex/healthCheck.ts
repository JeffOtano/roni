/**
 * Periodic health signal check. Queries internal state for symptoms of
 * backend problems and alerts Discord when thresholds are exceeded.
 */

import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import * as analytics from "./lib/posthog";

const EXPIRED_TOKEN_ALERT_THRESHOLD = 2;

export interface HealthSignals {
  expiredTokenCount: number;
  circuitOpen: boolean;
}

/** Pure function: format health signals into a Discord-friendly summary. */
export function formatHealthSummary(signals: HealthSignals): string {
  const issues: string[] = [];

  if (signals.expiredTokenCount >= EXPIRED_TOKEN_ALERT_THRESHOLD) {
    issues.push(`${signals.expiredTokenCount} expired tokens`);
  }
  if (signals.circuitOpen) {
    issues.push("Tonal API circuit breaker OPEN");
  }

  if (issues.length === 0) {
    return "All clear.";
  }

  return issues.join(" | ");
}

/** Count users with tokens that are already expired (expiresAt > 0 and < now). */
export const getExpiredTokenCount = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const profiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_tonalTokenExpiresAt", (q) =>
        q.gt("tonalTokenExpiresAt", 0).lt("tonalTokenExpiresAt", now),
      )
      .collect();
    return profiles.length;
  },
});

/** Main health check action. Called by cron every hour. */
export const runHealthCheck = internalAction({
  handler: async (ctx) => {
    const [expiredTokenCount, circuitOpen] = await Promise.all([
      ctx.runQuery(internal.healthCheck.getExpiredTokenCount),
      ctx.runQuery(internal.systemHealth.isCircuitOpen, { service: "tonal" }),
    ]);

    const signals: HealthSignals = {
      expiredTokenCount,
      circuitOpen,
    };

    const summary = formatHealthSummary(signals);
    const hasIssues =
      signals.expiredTokenCount >= EXPIRED_TOKEN_ALERT_THRESHOLD || signals.circuitOpen;

    if (hasIssues) {
      await ctx.runAction(internal.discord.notifyError, {
        source: "healthCheck",
        message: summary,
      });
    }

    analytics.captureSystem("health_check_completed", {
      has_issues: hasIssues,
      expired_tokens: signals.expiredTokenCount,
      circuit_open: signals.circuitOpen,
    });
    await analytics.flush();
  },
});
