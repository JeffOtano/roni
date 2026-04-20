/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import schema from "./schema";

const limitMock = vi.fn(async (..._args: unknown[]) => ({ ok: true, retryAfter: undefined }));
vi.mock("./rateLimits", () => ({
  rateLimiter: { limit: limitMock },
}));

const { createOrUpdateUser } = await import("./auth");

const modules = import.meta.glob("./**/*.*s");

describe("createOrUpdateUser", () => {
  test("returns existingUserId without inserting on update path", async () => {
    const t = convexTest(schema, modules);

    const existingUserId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "repeat@example.com", name: "Repeat User" }),
    );

    const result = await t.run((ctx) =>
      createOrUpdateUser(ctx, {
        existingUserId,
        profile: { email: "repeat@example.com" },
      }),
    );

    expect(result).toBe(existingUserId);

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
    expect(users[0]._id).toBe(existingUserId);
  });

  test("rate-limits and inserts a new user on create path", async () => {
    limitMock.mockClear();
    const t = convexTest(schema, modules);

    const result = await t.run((ctx) =>
      createOrUpdateUser(ctx, {
        existingUserId: null,
        profile: { email: "new@example.com", name: "New User" },
      }),
    );

    expect(limitMock).toHaveBeenCalledTimes(1);
    const [, name, options] = limitMock.mock.calls[0];
    expect(name).toBe("newSignup");
    expect(options).toEqual({ throws: true });

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
    expect(users[0]._id).toBe(result);
    expect(users[0].email).toBe("new@example.com");
    expect(users[0].name).toBe("New User");
  });

  test("does not repoint when called twice with same existingUserId", async () => {
    const t = convexTest(schema, modules);

    const existingUserId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "repeat@example.com" }),
    );

    // Simulate the reset-send + reset-verify sequence that used to create
    // two orphan rows under the pre-#228 bug.
    await t.run((ctx) =>
      createOrUpdateUser(ctx, {
        existingUserId,
        profile: { email: "repeat@example.com" },
      }),
    );
    await t.run((ctx) =>
      createOrUpdateUser(ctx, {
        existingUserId,
        profile: { email: "repeat@example.com" },
      }),
    );

    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
    expect(users[0]._id).toBe(existingUserId);
  });
});
