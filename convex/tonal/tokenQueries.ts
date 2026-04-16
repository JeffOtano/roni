import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalQuery } from "../_generated/server";

/** One page of userProfiles whose Tonal token expires within the window. */
export const getExpiringTokensPage = internalQuery({
  args: {
    beforeTimestamp: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { beforeTimestamp, paginationOpts }) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_tonalTokenExpiresAt", (q) =>
        q.gt("tonalTokenExpiresAt", 0).lt("tonalTokenExpiresAt", beforeTimestamp),
      )
      .paginate(paginationOpts);
  },
});
