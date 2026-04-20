/**
 * Circuit breaker for external API health tracking.
 * Trips after FAILURE_THRESHOLD consecutive failures within FAILURE_WINDOW_MS.
 * Closes on first success (no half-open state for simplicity).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const FAILURE_THRESHOLD = 5;
const FAILURE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

/** Check if the circuit is currently open (API considered unhealthy). */
export const isCircuitOpen = internalQuery({
  args: { service: v.string() },
  handler: async (ctx, { service }) => {
    const health = await ctx.db
      .query("systemHealth")
      .withIndex("by_service", (q) => q.eq("service", service))
      .unique();
    return health?.circuitOpen === true;
  },
});

/** Record a successful API call. Writes only on the rare circuit-close
 *  transition; sporadic non-open failure counts reset naturally via
 *  recordFailure's windowed check. Skipping in every non-open state keeps
 *  recordSuccess contention-free under bursts of concurrent traffic. */
export const recordSuccess = internalMutation({
  args: { service: v.string() },
  handler: async (ctx, { service }) => {
    const health = await ctx.db
      .query("systemHealth")
      .withIndex("by_service", (q) => q.eq("service", service))
      .unique();

    if (!health) {
      await ctx.db.insert("systemHealth", {
        service,
        consecutiveFailures: 0,
        circuitOpen: false,
        lastSuccessAt: Date.now(),
      });
      return;
    }

    if (!health.circuitOpen) return;

    await ctx.db.patch(health._id, {
      consecutiveFailures: 0,
      circuitOpen: false,
      lastSuccessAt: Date.now(),
    });
    console.log(`[circuitBreaker] Circuit CLOSED for ${service} - API recovered`);
  },
});

/** Record a failed API call. Opens circuit if threshold exceeded within window. */
export const recordFailure = internalMutation({
  args: { service: v.string() },
  handler: async (ctx, { service }) => {
    const health = await ctx.db
      .query("systemHealth")
      .withIndex("by_service", (q) => q.eq("service", service))
      .unique();

    const now = Date.now();

    if (!health) {
      await ctx.db.insert("systemHealth", {
        service,
        consecutiveFailures: 1,
        lastFailureAt: now,
        circuitOpen: false,
      });
      return;
    }

    // If the last failure was outside the window, reset the counter
    const withinWindow = health.lastFailureAt && now - health.lastFailureAt < FAILURE_WINDOW_MS;
    const newCount = withinWindow ? health.consecutiveFailures + 1 : 1;

    const updates: Record<string, unknown> = {
      consecutiveFailures: newCount,
      lastFailureAt: now,
    };

    if (newCount >= FAILURE_THRESHOLD && !health.circuitOpen) {
      updates.circuitOpen = true;
      updates.circuitOpenedAt = now;
      console.log(
        `[circuitBreaker] Circuit OPENED for ${service} - ${newCount} consecutive failures`,
      );
    }

    await ctx.db.patch(health._id, updates);
  },
});
