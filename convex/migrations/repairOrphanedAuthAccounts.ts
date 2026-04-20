/**
 * One-shot cleanup for users whose `authAccounts.userId` got repointed at an
 * empty duplicate row by the old `createOrUpdateUser` callback bug (fixed in
 * #228). For each affected email:
 *
 * 1. Find the oldest `users` row for the email (the real one holding data).
 * 2. Safety check: verify every orphan `users` row has zero references in
 *    the 18 user-scoped app tables. Abort that email if any found — orphans
 *    were created by an auth-only path that never completed a signed-in
 *    session, so they should have zero app data.
 * 3. Repoint the password `authAccounts` row at the oldest user.
 * 4. For each orphan, run the full account-deletion sequence used by
 *    `convex/account.ts:deleteAccount` (agent component data → by-userId
 *    tables → specialized tables → remaining auth data → user record). This
 *    ensures nothing user-scoped is left behind, across every current and
 *    future table enumerated in `convex/userData.ts`.
 *
 * Dry run:  npx convex run migrations/repairOrphanedAuthAccounts:run '{"dryRun": true}' --prod
 * Execute:  npx convex run migrations/repairOrphanedAuthAccounts:run '{"dryRun": false}' --prod
 */

import { v } from "convex/values";
import {
  type ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { BY_USER_ID_BATCH_TABLES } from "../userData";

// Emails with duplicate user rows from the pre-fix prod scan.
const AFFECTED_EMAILS = [
  "otano.jeffrey@gmail.com",
  "chris24mansfield@gmail.com",
  "ken.adler@gmail.com",
  "ricardovasq@gmail.com",
  "arianna.ratner@gmail.com",
  "mike.byron@outlook.com",
] as const;

// Safety check: every user-scoped table that has a `userId` index. If an
// orphan has any row here we abort that email and surface it in the report,
// since orphans should be completely empty.
const SAFETY_INDEXES: Record<string, string> = {
  aiUsage: "by_userId",
  checkIns: "by_userId",
  completedWorkouts: "by_userId_activityId",
  currentStrengthScores: "by_userId",
  emailChangeRequests: "by_userId",
  exercisePerformance: "by_userId_movementId",
  externalActivities: "by_userId_externalId",
  goals: "by_userId",
  injuries: "by_userId",
  muscleReadiness: "by_userId",
  personalRecords: "by_userId_movementId",
  strengthScoreSnapshots: "by_userId_date",
  tonalCache: "by_userId_dataType",
  trainingBlocks: "by_userId",
  userProfiles: "by_userId",
  weekPlans: "by_userId",
  workoutFeedback: "by_userId",
  workoutPlans: "by_userId",
};

type PlanResult =
  | { kind: "skip"; reason: string }
  | {
      kind: "plan";
      authAccountId: Id<"authAccounts">;
      currentAuthUserId: Id<"users">;
      oldestUserId: Id<"users">;
      orphanIds: Array<Id<"users">>;
      dataHits: Array<{ userId: Id<"users">; table: string }>;
    };

export const planEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }): Promise<PlanResult> => {
    const users = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .collect();

    if (users.length <= 1) {
      return { kind: "skip", reason: "no duplicates" };
    }

    const sorted = [...users].sort((a, b) => a._creationTime - b._creationTime);
    const oldest = sorted[0];
    const orphans = sorted.slice(1);

    const authAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();

    if (!authAccount) {
      return { kind: "skip", reason: "no password authAccount" };
    }

    const dataHits: Array<{ userId: Id<"users">; table: string }> = [];
    for (const orphan of orphans) {
      for (const [table, idx] of Object.entries(SAFETY_INDEXES)) {
        const row = await ctx.db
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .query(table as any)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .withIndex(idx as any, (q: any) => q.eq("userId", orphan._id))
          .first();
        if (row) {
          dataHits.push({ userId: orphan._id, table });
          break;
        }
      }
    }

    return {
      kind: "plan",
      authAccountId: authAccount._id,
      currentAuthUserId: authAccount.userId,
      oldestUserId: oldest._id,
      orphanIds: orphans.map((o) => o._id),
      dataHits,
    };
  },
});

export const repointAuthAccount = internalMutation({
  args: {
    authAccountId: v.id("authAccounts"),
    newUserId: v.id("users"),
  },
  handler: async (ctx, { authAccountId, newUserId }) => {
    await ctx.db.patch(authAccountId, { userId: newUserId });
  },
});

type EmailResult = {
  email: string;
  status: "skipped" | "aborted" | "planned" | "applied";
  reason?: string;
  oldestUserId?: Id<"users">;
  previousAuthAccountUserId?: Id<"users">;
  orphanIds?: Array<Id<"users">>;
  orphansWithData?: Array<{ userId: Id<"users">; table: string }>;
};

export const run = internalAction({
  args: { dryRun: v.boolean() },
  handler: async (ctx, { dryRun }): Promise<{ dryRun: boolean; results: EmailResult[] }> => {
    const results: EmailResult[] = [];

    for (const email of AFFECTED_EMAILS) {
      const plan: PlanResult = await ctx.runQuery(
        internal.migrations.repairOrphanedAuthAccounts.planEmail,
        { email },
      );

      if (plan.kind === "skip") {
        results.push({ email, status: "skipped", reason: plan.reason });
        continue;
      }

      if (plan.dataHits.length > 0) {
        results.push({
          email,
          status: "aborted",
          reason: "orphan row has app data — refusing to delete",
          orphansWithData: plan.dataHits,
        });
        continue;
      }

      const base: EmailResult = {
        email,
        status: dryRun ? "planned" : "applied",
        oldestUserId: plan.oldestUserId,
        previousAuthAccountUserId: plan.currentAuthUserId,
        orphanIds: plan.orphanIds,
      };

      if (dryRun) {
        results.push(base);
        continue;
      }

      if (plan.currentAuthUserId !== plan.oldestUserId) {
        await ctx.runMutation(internal.migrations.repairOrphanedAuthAccounts.repointAuthAccount, {
          authAccountId: plan.authAccountId,
          newUserId: plan.oldestUserId,
        });
      }

      for (const orphanId of plan.orphanIds) {
        await deleteOneOrphan(ctx, orphanId);
      }

      results.push(base);
    }

    return { dryRun, results };
  },
});

/**
 * Full user-data wipe for one orphan userId. Mirrors the sequence in
 * `convex/account.ts:deleteAccount` so every user-scoped table (including
 * agent component data) is drained. The password `authAccounts` row is
 * already repointed at the oldest user by the time this runs, so
 * `deleteAuthData` only drains `authSessions` + `authRefreshTokens`.
 */
async function deleteOneOrphan(ctx: ActionCtx, orphanId: Id<"users">): Promise<void> {
  await ctx.runAction(components.agent.users.deleteAllForUserId, {
    userId: orphanId,
  });

  for (const table of BY_USER_ID_BATCH_TABLES) {
    let hasMore = true;
    while (hasMore) {
      hasMore = await ctx.runMutation(internal.accountDeletion.deleteUserTableBatch, {
        userId: orphanId,
        table,
      });
    }
  }

  for (const mutation of [
    internal.accountDeletion.deletePersonalRecordsBatch,
    internal.accountDeletion.deleteExercisePerformanceBatch,
    internal.accountDeletion.deleteTonalCacheBatch,
    internal.accountDeletion.deleteExternalActivitiesBatch,
  ] as const) {
    let hasMore = true;
    while (hasMore) {
      hasMore = await ctx.runMutation(mutation, { userId: orphanId });
    }
  }

  let hasMoreAuth = true;
  while (hasMoreAuth) {
    hasMoreAuth = await ctx.runMutation(internal.accountDeletion.deleteAuthData, {
      userId: orphanId,
    });
  }

  await ctx.runMutation(internal.accountDeletion.deleteUserRecord, {
    userId: orphanId,
  });
}
