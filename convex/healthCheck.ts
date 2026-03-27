/**
 * Periodic health signal check. Queries internal state for symptoms of
 * backend problems and alerts Discord when thresholds are exceeded.
 */

import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const EXPIRED_TOKEN_ALERT_THRESHOLD = 2;
const MOVEMENT_SYNC_STALE_MS = 48 * 60 * 60 * 1000; // 48h (expected daily at 3 AM)

export interface HealthSignals {
  expiredTokenCount: number;
  stuckPushCount: number;
  lastMovementSyncAge: string;
  movementSyncStale: boolean;
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
  if (signals.movementSyncStale) {
    issues.push(`Movement sync stale (${signals.lastMovementSyncAge})`);
  }

  if (issues.length === 0) {
    return `All clear. Movement sync: ${signals.lastMovementSyncAge}.`;
  }

  return issues.join(" | ");
}

function formatAge(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "< 1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} day(s) ago`;
}

/** Count users with tokens that are already expired (expiresAt > 0 and < now). */
export const getExpiredTokenCount = internalQuery({
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

/** Get the most recent lastSyncedAt from the movements table. */
export const getLastMovementSyncTime = internalQuery({
  handler: async (ctx) => {
    const latest = await ctx.db.query("movements").order("desc").first();
    return latest?.lastSyncedAt ?? null;
  },
});

/** Main health check action. Called by cron every 15 minutes. */
export const runHealthCheck = internalAction({
  handler: async (ctx) => {
    const now = Date.now();

    const [expiredTokenCount, stuckPushIds, lastSyncTime] = await Promise.all([
      ctx.runQuery(internal.healthCheck.getExpiredTokenCount),
      ctx.runQuery(internal.workoutPlans.getStuckPushingPlanIds, {
        cutoffTs: now - 5 * 60 * 1000,
        limit: 50,
      }),
      ctx.runQuery(internal.healthCheck.getLastMovementSyncTime),
    ]);

    const syncAgeMs = lastSyncTime ? now - lastSyncTime : Infinity;

    const signals: HealthSignals = {
      expiredTokenCount,
      stuckPushCount: stuckPushIds.length,
      lastMovementSyncAge: lastSyncTime ? formatAge(syncAgeMs) : "never",
      movementSyncStale: syncAgeMs > MOVEMENT_SYNC_STALE_MS,
    };

    const summary = formatHealthSummary(signals);
    const hasIssues =
      signals.expiredTokenCount >= EXPIRED_TOKEN_ALERT_THRESHOLD ||
      signals.stuckPushCount > 0 ||
      signals.movementSyncStale;

    if (hasIssues) {
      void ctx.runAction(internal.discord.notifyError, {
        source: "healthCheck",
        message: summary,
      });
    }
  },
});
