import type { ToolCtx } from "@convex-dev/agent";
import type { Id } from "../_generated/dataModel";

export function requireUserId(ctx: ToolCtx): Id<"users"> {
  if (!ctx.userId) throw new Error("Not authenticated");
  return ctx.userId as Id<"users">;
}
