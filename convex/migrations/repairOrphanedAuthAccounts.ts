/**
 * One-shot cleanup for users whose `authAccounts.userId` got repointed at an
 * empty duplicate row by the old `createOrUpdateUser` callback bug (fixed in
 * #228). For each affected email:
 *
 * 1. Find the oldest `users` row for the email (the real one holding data).
 * 2. Verify every OTHER `users` row for that email has zero references in
 *    the 18 app tables that carry a `userId`. Abort that email if any found.
 * 3. Repoint the `authAccounts` row back to the oldest user.
 * 4. Delete orphan `authSessions` + `authRefreshTokens` for the duplicate
 *    user rows.
 * 5. Delete the duplicate user rows themselves.
 *
 * Dry run:  npx convex run migrations/repairOrphanedAuthAccounts:run '{"dryRun": true}' --prod
 * Execute:  npx convex run migrations/repairOrphanedAuthAccounts:run '{"dryRun": false}' --prod
 */

import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { Id, TableNames } from "../_generated/dataModel";

// Emails with duplicate user rows from the pre-fix prod scan.
const AFFECTED_EMAILS = [
  "otano.jeffrey@gmail.com",
  "chris24mansfield@gmail.com",
  "ken.adler@gmail.com",
  "ricardovasq@gmail.com",
  "arianna.ratner@gmail.com",
  "mike.byron@outlook.com",
] as const;

// Tables whose `userId` index we check to confirm an orphan row has no data.
// Index name is `by_userId` for most tables; a few use a compound index
// whose first field is `userId`, which Convex lets us query with `eq("userId", ...)`.
const USER_REFERENCING_TABLES: ReadonlyArray<{
  table: TableNames;
  index: string;
}> = [
  { table: "aiUsage", index: "by_userId" },
  { table: "checkIns", index: "by_userId" },
  { table: "completedWorkouts", index: "by_userId_activityId" },
  { table: "currentStrengthScores", index: "by_userId" },
  { table: "emailChangeRequests", index: "by_userId" },
  { table: "exercisePerformance", index: "by_userId_movementId" },
  { table: "externalActivities", index: "by_userId_externalId" },
  { table: "goals", index: "by_userId" },
  { table: "injuries", index: "by_userId" },
  { table: "muscleReadiness", index: "by_userId" },
  { table: "personalRecords", index: "by_userId_movementId" },
  { table: "strengthScoreSnapshots", index: "by_userId_date" },
  { table: "tonalCache", index: "by_userId_dataType" },
  { table: "trainingBlocks", index: "by_userId" },
  { table: "userProfiles", index: "by_userId" },
  { table: "weekPlans", index: "by_userId" },
  { table: "workoutFeedback", index: "by_userId" },
  { table: "workoutPlans", index: "by_userId" },
];

type EmailResult = {
  email: string;
  status: "skipped" | "aborted" | "planned" | "applied";
  reason?: string;
  oldestUserId?: Id<"users">;
  previousAuthAccountUserId?: Id<"users">;
  orphanUserIds?: Array<Id<"users">>;
  orphansWithData?: Array<{ userId: Id<"users">; table: string }>;
  deletedSessions?: number;
  deletedRefreshTokens?: number;
};

export const run = internalMutation({
  args: { dryRun: v.boolean() },
  handler: async (ctx, { dryRun }) => {
    const results: EmailResult[] = [];

    for (const email of AFFECTED_EMAILS) {
      results.push(await repairOneEmail(ctx, email, dryRun));
    }

    return { dryRun, results };
  },
});

async function repairOneEmail(
  ctx: MutationCtx,
  email: string,
  dryRun: boolean,
): Promise<EmailResult> {
  const usersForEmail = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .collect();

  if (usersForEmail.length <= 1) {
    return { email, status: "skipped", reason: "no duplicates" };
  }

  const sorted = [...usersForEmail].sort((a, b) => a._creationTime - b._creationTime);
  const oldest = sorted[0];
  const orphans = sorted.slice(1);

  const authAccount = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) =>
      q.eq("provider", "password").eq("providerAccountId", email),
    )
    .unique();

  if (!authAccount) {
    return { email, status: "skipped", reason: "no password authAccount" };
  }

  const orphansWithData: Array<{ userId: Id<"users">; table: string }> = [];
  for (const orphan of orphans) {
    for (const { table, index } of USER_REFERENCING_TABLES) {
      const row = await ctx.db
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .query(table as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .withIndex(index as any, (q: any) => q.eq("userId", orphan._id))
        .first();
      if (row) {
        orphansWithData.push({ userId: orphan._id, table });
        break;
      }
    }
  }

  if (orphansWithData.length > 0) {
    return {
      email,
      status: "aborted",
      reason: "orphan row has app data — refusing to delete",
      orphansWithData,
    };
  }

  const plan: EmailResult = {
    email,
    status: dryRun ? "planned" : "applied",
    oldestUserId: oldest._id,
    previousAuthAccountUserId: authAccount.userId,
    orphanUserIds: orphans.map((o) => o._id),
    deletedSessions: 0,
    deletedRefreshTokens: 0,
  };

  if (dryRun) return plan;

  if (authAccount.userId !== oldest._id) {
    await ctx.db.patch(authAccount._id, { userId: oldest._id });
  }

  for (const orphan of orphans) {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", orphan._id))
      .collect();
    for (const session of sessions) {
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of tokens) {
        await ctx.db.delete(token._id);
        plan.deletedRefreshTokens = (plan.deletedRefreshTokens ?? 0) + 1;
      }
      await ctx.db.delete(session._id);
      plan.deletedSessions = (plan.deletedSessions ?? 0) + 1;
    }
    await ctx.db.delete(orphan._id);
  }

  return plan;
}
