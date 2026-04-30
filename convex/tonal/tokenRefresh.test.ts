/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

// Vite normalizes same-directory glob keys to "./foo.ts" instead of
// "../tonal/foo.ts", which breaks convex-test module resolution.
// Remap ./foo.ts -> ../tonal/foo.ts to match the expected path format.
const rawModules = import.meta.glob("../**/*.*s");
const modules: typeof rawModules = {};
for (const [key, value] of Object.entries(rawModules)) {
  modules[key.startsWith("./") ? "../tonal/" + key.slice(2) : key] = value;
}

describe("refreshExpiringTokens", () => {
  test("returns without error when TOKEN_ENCRYPTION_KEY is not set", async () => {
    // The action checks for TOKEN_ENCRYPTION_KEY before entering the processing
    // loop. In the test environment the env var is absent, so the action exits
    // early. This verifies that the early-return path does not throw.
    const t = convexTest(schema, modules);

    await t.action(internal.tonal.tokenRefresh.refreshExpiringTokens, {});
  });

  test("completes without error when no tokens are expiring", async () => {
    // TOKEN_ENCRYPTION_KEY is absent so the action returns early regardless of
    // what's in the DB, but this confirms the action shape is callable.
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      await ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: `tonal-${userId}`,
        tonalToken: "token",
        lastActiveAt: Date.now(),
        // Token expires far in the future — not within the 2-hour window
        tonalTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
    });

    await t.action(internal.tonal.tokenRefresh.refreshExpiringTokens, {});
  });
});
