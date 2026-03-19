import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Add an email to the beta waitlist. Idempotent — ignores duplicates. */
export const join = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.toLowerCase().trim();
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    if (existing) return { alreadyOnList: true };
    await ctx.db.insert("waitlist", { email: normalized, createdAt: Date.now() });
    return { alreadyOnList: false };
  },
});

/** Get total waitlist count (for display). */
export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("waitlist").collect();
    return entries.length;
  },
});
