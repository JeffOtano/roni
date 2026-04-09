/**
 * Dynamic injury/limitation tracking.
 * Replaces static onboarding text with structured, updatable records.
 * The coach uses active injuries to exclude exercises and adjust programming.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";
import { rateLimiter } from "./rateLimits";

const MAX_ACTIVE_INJURIES = 10;
const severityValidator = v.union(v.literal("mild"), v.literal("moderate"), v.literal("severe"));

export const report = mutation({
  args: {
    area: v.string(),
    severity: severityValidator,
    avoidance: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await rateLimiter.limit(ctx, "reportInjury", { key: userId });

    if (!args.area.trim()) throw new Error("Area is required");
    if (!args.avoidance.trim()) throw new Error("Avoidance keywords are required");

    const activeCount = (
      await ctx.db
        .query("injuries")
        .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "active"))
        .collect()
    ).length;
    if (activeCount >= MAX_ACTIVE_INJURIES)
      throw new Error(`Maximum ${MAX_ACTIVE_INJURIES} active injuries`);

    return ctx.db.insert("injuries", {
      userId,
      area: args.area.slice(0, 100),
      severity: args.severity,
      avoidance: args.avoidance.slice(0, 200),
      notes: args.notes?.slice(0, 500),
      reportedAt: Date.now(),
      status: "active",
    });
  },
});

export const resolve = mutation({
  args: { injuryId: v.id("injuries") },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const injury = await ctx.db.get(args.injuryId);
    if (!injury || injury.userId !== userId) throw new Error("Injury not found");
    await ctx.db.patch(args.injuryId, { status: "resolved", resolvedAt: Date.now() });
  },
});

export const updateSeverity = mutation({
  args: {
    injuryId: v.id("injuries"),
    severity: severityValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const injury = await ctx.db.get(args.injuryId);
    if (!injury || injury.userId !== userId) throw new Error("Injury not found");
    await ctx.db.patch(args.injuryId, {
      severity: args.severity,
      ...(args.notes !== undefined ? { notes: args.notes.slice(0, 500) } : {}),
    });
  },
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("injuries")
      .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("injuries")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

/** Internal: get active injuries for AI context and exercise filtering. */
export const getActiveInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("injuries")
      .withIndex("by_userId_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .collect();
  },
});

/** Internal: report injury from coach tool. */
export const reportInternal = internalMutation({
  args: {
    userId: v.id("users"),
    area: v.string(),
    severity: severityValidator,
    avoidance: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("injuries", {
      userId: args.userId,
      area: args.area.slice(0, 100),
      severity: args.severity,
      avoidance: args.avoidance.slice(0, 200),
      notes: args.notes?.slice(0, 500),
      reportedAt: Date.now(),
      status: "active",
    });
  },
});

/** Internal: resolve injury from coach tool. */
export const resolveInternal = internalMutation({
  args: { injuryId: v.id("injuries"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const injury = await ctx.db.get(args.injuryId);
    if (!injury || injury.userId !== args.userId) throw new Error("Injury not found");
    await ctx.db.patch(args.injuryId, { status: "resolved", resolvedAt: Date.now() });
  },
});
