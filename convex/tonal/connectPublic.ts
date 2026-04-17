import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import type { ConnectTonalResult } from "./connect";

export const connectTonal = action({
  args: {
    tonalEmail: v.string(),
    tonalPassword: v.string(),
  },
  handler: async (ctx, { tonalEmail, tonalPassword }): Promise<ConnectTonalResult> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    return await ctx.runAction(internal.tonal.connect.connectTonal, {
      userId,
      tonalEmail,
      tonalPassword,
    });
  },
});
