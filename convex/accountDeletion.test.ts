/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function createUser(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ctx.db.insert("users", {}));
}

async function createSession(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  suffix: string,
) {
  return t.run(async (ctx) =>
    ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + Number(suffix),
    }),
  );
}

async function createAccount(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  suffix: string,
) {
  return t.run(async (ctx) =>
    ctx.db.insert("authAccounts", {
      userId,
      provider: `provider-${suffix}`,
      providerAccountId: `account-${suffix}`,
      secret: `secret-${suffix}`,
    }),
  );
}

async function createUserProfile(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.run(async (ctx) =>
    ctx.db.insert("userProfiles", {
      userId,
      tonalUserId: `tonal-${userId}`,
      tonalToken: "token",
      lastActiveAt: Date.now(),
    }),
  );
}

async function countUserSessions(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.run(async (ctx) => {
    const sessions = await ctx.db.query("authSessions").collect();
    return sessions.filter((session) => session.userId === userId);
  });
}

async function countSessionTokens(t: ReturnType<typeof convexTest>, sessionId: Id<"authSessions">) {
  return t.run(async (ctx) => {
    const tokens = await ctx.db.query("authRefreshTokens").collect();
    return tokens.filter((token) => token.sessionId === sessionId);
  });
}

async function countUserAccounts(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.run(async (ctx) => {
    const accounts = await ctx.db.query("authAccounts").collect();
    return accounts.filter((account) => account.userId === userId);
  });
}

async function countAccountCodes(t: ReturnType<typeof convexTest>, accountId: Id<"authAccounts">) {
  return t.run(async (ctx) => {
    const codes = await ctx.db.query("authVerificationCodes").collect();
    return codes.filter((code) => code.accountId === accountId);
  });
}

async function countCurrentStrengthScores(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.run(async (ctx) => {
    const scores = await ctx.db.query("currentStrengthScores").collect();
    return scores.filter((score) => score.userId === userId);
  });
}

async function countUserCacheEntries(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  return t.run(async (ctx) => {
    const entries = await ctx.db.query("tonalCache").collect();
    return entries.filter((entry) => entry.userId === userId);
  });
}

async function drainAuthData(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
  let iterations = 0;
  while (await t.mutation(internal.accountDeletion.deleteAuthData, { userId })) {
    iterations += 1;
    if (iterations > 5_000) {
      throw new Error("deleteAuthData did not converge");
    }
  }
  return iterations;
}

async function drainUserTableBatch(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  table: "currentStrengthScores",
) {
  let iterations = 0;
  while (await t.mutation(internal.accountDeletion.deleteUserTableBatch, { userId, table })) {
    iterations += 1;
    if (iterations > 5_000) {
      throw new Error(`deleteUserTableBatch did not converge for ${table}`);
    }
  }
}

describe("deleteAuthData", () => {
  test("drains more than 500 auth sessions and accounts across repeated calls", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const otherUserId = await createUser(t);

    for (let i = 0; i < 501; i += 1) {
      await createSession(t, userId, `user-${i}`);
      await createAccount(t, userId, `user-${i}`);
    }

    await createSession(t, otherUserId, "other");
    await createAccount(t, otherUserId, "other");

    const iterations = await drainAuthData(t, userId);

    expect(iterations).toBeGreaterThan(1);
    expect(await countUserSessions(t, userId)).toHaveLength(0);
    expect(await countUserAccounts(t, userId)).toHaveLength(0);
    expect(await countUserSessions(t, otherUserId)).toHaveLength(1);
    expect(await countUserAccounts(t, otherUserId)).toHaveLength(1);
  });

  test("deletes refresh tokens in batches before deleting the session", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const sessionId = await createSession(t, userId, "batched-session");

    await t.run(async (ctx) => {
      for (let i = 0; i < 501; i += 1) {
        await ctx.db.insert("authRefreshTokens", {
          sessionId,
          expirationTime: Date.now() + i,
        });
      }
    });

    await expect(t.mutation(internal.accountDeletion.deleteAuthData, { userId })).resolves.toBe(
      true,
    );
    expect(await countSessionTokens(t, sessionId)).toHaveLength(1);
    expect(await countUserSessions(t, userId)).toHaveLength(1);

    await expect(t.mutation(internal.accountDeletion.deleteAuthData, { userId })).resolves.toBe(
      true,
    );
    expect(await countSessionTokens(t, sessionId)).toHaveLength(0);
    expect(await countUserSessions(t, userId)).toHaveLength(1);

    await expect(t.mutation(internal.accountDeletion.deleteAuthData, { userId })).resolves.toBe(
      true,
    );
    expect(await countUserSessions(t, userId)).toHaveLength(0);

    await expect(t.mutation(internal.accountDeletion.deleteAuthData, { userId })).resolves.toBe(
      false,
    );
  });

  test("deletes verification codes in batches before deleting the account", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const accountId = await createAccount(t, userId, "batched-account");

    await t.run(async (ctx) => {
      for (let i = 0; i < 501; i += 1) {
        await ctx.db.insert("authVerificationCodes", {
          accountId,
          provider: "password",
          code: `code-${i}`,
          expirationTime: Date.now() + i,
        });
      }
    });

    await expect(t.mutation(internal.accountDeletion.deleteAuthData, { userId })).resolves.toBe(
      true,
    );
    expect(await countAccountCodes(t, accountId)).toHaveLength(1);
    expect(await countUserAccounts(t, userId)).toHaveLength(1);

    await expect(t.mutation(internal.accountDeletion.deleteAuthData, { userId })).resolves.toBe(
      true,
    );
    expect(await countAccountCodes(t, accountId)).toHaveLength(0);
    expect(await countUserAccounts(t, userId)).toHaveLength(1);

    await expect(t.mutation(internal.accountDeletion.deleteAuthData, { userId })).resolves.toBe(
      true,
    );
    expect(await countUserAccounts(t, userId)).toHaveLength(0);

    await expect(t.mutation(internal.accountDeletion.deleteAuthData, { userId })).resolves.toBe(
      false,
    );
  });
});

describe("deleteUserTableBatch", () => {
  test("deletes current strength scores in batches via the shared registry", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const otherUserId = await createUser(t);

    await t.run(async (ctx) => {
      for (let i = 0; i < 501; i += 1) {
        await ctx.db.insert("currentStrengthScores", {
          userId,
          bodyRegion: `region-${i}`,
          score: i,
          fetchedAt: Date.now() + i,
        });
      }

      await ctx.db.insert("currentStrengthScores", {
        userId: otherUserId,
        bodyRegion: "other-region",
        score: 999,
        fetchedAt: Date.now(),
      });
    });

    await drainUserTableBatch(t, userId, "currentStrengthScores");

    expect(await countCurrentStrengthScores(t, userId)).toHaveLength(0);
    expect(await countCurrentStrengthScores(t, otherUserId)).toHaveLength(1);
  });
});

describe("deletionInProgress", () => {
  test("blocks history sync writes and user cache writes while deletion is running", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    await createUserProfile(t, userId);

    await t.mutation(internal.accountDeletion.markDeletionInProgress, { userId });

    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: [{ bodyRegion: "upper", score: 123 }],
    });
    await t.mutation(internal.tonal.cache.setCacheEntry, {
      userId,
      dataType: "strengthScores",
      data: { score: 123 },
      fetchedAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });

    expect(await t.query(internal.tonal.cache.getUserProfile, { userId })).toBeNull();
    expect(await countCurrentStrengthScores(t, userId)).toHaveLength(0);
    expect(await countUserCacheEntries(t, userId)).toHaveLength(0);
  });
});
