import { saveMessage } from "@convex-dev/agent";
import { components, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { BUDGET_WARNING_THRESHOLD, DAILY_TOKEN_BUDGET } from "../aiUsage";

const BUDGET_EXCEEDED_MESSAGE =
  "I've hit my daily thinking limit -- let's pick this up tomorrow. Your limit resets at midnight UTC.";
const WARNING_THRESHOLD_TOKENS = DAILY_TOKEN_BUDGET * BUDGET_WARNING_THRESHOLD;

export function shouldNotifyBudgetWarning(todayUsage: number, latestUsageTokens: number): boolean {
  const previousUsage = Math.max(0, todayUsage - latestUsageTokens);
  return previousUsage < WARNING_THRESHOLD_TOKENS && todayUsage >= WARNING_THRESHOLD_TOKENS;
}

export async function checkDailyBudget(
  ctx: ActionCtx,
  userId: string,
  threadId: string,
): Promise<boolean> {
  const { totalTokens: todayUsage, latestUsageTokens } = await ctx.runQuery(
    internal.aiUsage.getDailyTokenUsageStats,
    {
      userId: userId as Id<"users">,
    },
  );

  if (todayUsage >= DAILY_TOKEN_BUDGET) {
    await saveMessage(ctx, components.agent, {
      threadId,
      userId,
      message: { role: "assistant", content: BUDGET_EXCEEDED_MESSAGE },
    });
    return true;
  }

  if (!shouldNotifyBudgetWarning(todayUsage, latestUsageTokens)) return false;

  const warningDate = new Date().toISOString().slice(0, 10);
  const claimed = await ctx.runMutation(internal.aiUsage.claimDailyBudgetWarning, {
    userId: userId as Id<"users">,
    date: warningDate,
  });
  if (!claimed) return false;

  await ctx.scheduler.runAfter(0, internal.discord.notifyError, {
    source: "aiBudget",
    message: `User ${userId} at ${Math.round((todayUsage / DAILY_TOKEN_BUDGET) * 100)}% of daily token budget (${todayUsage.toLocaleString()} / ${DAILY_TOKEN_BUDGET.toLocaleString()})`,
    userId,
  });

  return false;
}
