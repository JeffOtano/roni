/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, test } from "vitest";
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
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.TOKEN_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.TOKEN_ENCRYPTION_KEY = originalKey;
    }
  });

  test("returns without error when TOKEN_ENCRYPTION_KEY is not set", async () => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
    const t = convexTest(schema, modules);

    await t.action(internal.tonal.tokenRefresh.refreshExpiringTokens, {});
  });

  test("completes without error when no tokens are expiring", async () => {
    // 64 hex chars = 32-byte AES key. Real value not needed because the
    // expiring-tokens page is empty (token expires far outside the 2-hour
    // window), so decryptToken/refreshTonalToken are never invoked.
    process.env.TOKEN_ENCRYPTION_KEY = "00".repeat(32);
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      await ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: `tonal-${userId}`,
        tonalToken: "token",
        lastActiveAt: Date.now(),
        tonalTokenExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
    });

    await t.action(internal.tonal.tokenRefresh.refreshExpiringTokens, {});
  });
});
