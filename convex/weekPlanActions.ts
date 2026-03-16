import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { preferredSplitValidator } from "./weekPlanHelpers";

export const programWeek = internalAction({
  args: {
    userId: v.id("users"),
    weekStartDate: v.optional(v.string()),
    preferredSplit: v.optional(preferredSplitValidator),
    targetDays: v.optional(v.number()),
    sessionDurationMinutes: v.optional(v.union(v.literal(30), v.literal(45), v.literal(60))),
  },
  handler: async (ctx, args): Promise<{ weekPlanId: Id<"weekPlans"> } | { error: string }> => {
    const result = (await ctx.runAction(internal.coach.weekProgrammingLegacy.programWeek, {
      userId: args.userId,
      weekStartDate: args.weekStartDate,
      preferredSplit: args.preferredSplit,
      targetDays: args.targetDays,
      sessionDurationMinutes: args.sessionDurationMinutes,
    })) as { success: true; weekPlanId: Id<"weekPlans"> } | { success: false; error: string };
    if (result.success) return { weekPlanId: result.weekPlanId };
    return { error: result.error };
  },
});

export const programMyWeek = action({
  args: {},
  handler: async (ctx): Promise<{ weekPlanId: Id<"weekPlans"> }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const result: { weekPlanId: Id<"weekPlans"> } | { error: string } = await ctx.runAction(
      internal.weekPlans.programWeek,
      { userId, targetDays: 4 },
    );
    if ("error" in result) throw new Error(result.error);
    return result;
  },
});
