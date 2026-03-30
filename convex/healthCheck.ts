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
  stuckPushCount: number;
  circuitOpen: boolean;
}

/** Pure function: format health signals into a Discord-friendly summary. */
export function formatHealthSummary(signals: HealthSignals): string {
  const issues: string[] = [];

  if (signals.expiredTokenCount >= EXPIRED_TOKEN_ALERT_THRESHOLD) {
    issues.push(`${signals.expiredTokenCount} expired tokens`);
  }
  if (signals.stuckPushCount > 0) {
    issues.push(`${signals.stuckPushCount} stuck push(es)`);
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
      .withIndex("by_tonalTokenExpiresAt")
      .filter((q) =>
        q.and(q.gt(q.field("tonalTokenExpiresAt"), 0), q.lt(q.field("tonalTokenExpiresAt"), now)),
      )
      .collect();
    return profiles.length;
  },
});

/** Main health check action. Called by cron every 15 minutes. */
export const runHealthCheck = internalAction({
  handler: async (ctx) => {
    const now = Date.now();

    const [expiredTokenCount, stuckPushIds, circuitOpen] = await Promise.all([
      ctx.runQuery(internal.healthCheck.getExpiredTokenCount),
      ctx.runQuery(internal.workoutPlans.getStuckPushingPlanIds, {
        cutoffTs: now - 5 * 60 * 1000,
        limit: 50,
      }),
      ctx.runQuery(internal.systemHealth.isCircuitOpen, { service: "tonal" }),
    ]);

    const signals: HealthSignals = {
      expiredTokenCount,
      stuckPushCount: stuckPushIds.length,
      circuitOpen,
    };

    const summary = formatHealthSummary(signals);
    const hasIssues =
      signals.expiredTokenCount >= EXPIRED_TOKEN_ALERT_THRESHOLD ||
      signals.stuckPushCount > 0 ||
      signals.circuitOpen;

    if (hasIssues) {
      await ctx.runAction(internal.discord.notifyError, {
        source: "healthCheck",
        message: summary,
      });
    }

    analytics.captureSystem("health_check_completed", {
      has_issues: hasIssues,
      expired_tokens: signals.expiredTokenCount,
      stuck_pushes: signals.stuckPushCount,
      circuit_open: signals.circuitOpen,
    });
    await analytics.flush();
  },
});
