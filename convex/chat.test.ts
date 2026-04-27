/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const syncStreamsMock = vi.fn(async () => ({}));
const listUIMessagesMock = vi.fn(async () => ({
  page: [],
  isDone: true,
  continueCursor: "",
}));

// Keep the real @convex-dev/agent exports (validators, types, etc.) but replace
// the two I/O functions that hit the agent component's tables.
vi.mock("@convex-dev/agent", async (importOriginal) => {
  const original = await importOriginal<typeof import("@convex-dev/agent")>();
  return {
    ...original,
    syncStreams: syncStreamsMock,
    listUIMessages: listUIMessagesMock,
  };
});

// assertThreadOwnership calls ctx.runQuery(components.agent.threads.getThread)
// which is an external component unavailable in the test environment. Replace it
// with a no-op so the listMessages handler can be exercised without the component.
vi.mock("./chatHelpers", async (importOriginal) => {
  const original = await importOriginal<typeof import("./chatHelpers")>();
  return {
    ...original,
    assertThreadOwnership: vi.fn(async () => {}),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THREAD_ID = "test-thread-id";
const PAGINATION_OPTS = { numItems: 10, cursor: null } as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("listMessages", () => {
  beforeEach(() => {
    syncStreamsMock.mockClear();
    listUIMessagesMock.mockClear();
  });

  test("rejects unauthenticated access", async () => {
    const t = convexTest(schema, modules);

    await expect(
      t.query(api.chat.listMessages, {
        threadId: THREAD_ID,
        paginationOpts: PAGINATION_OPTS,
        streamArgs: { kind: "list" },
      }),
    ).rejects.toThrow("Not authenticated");
  });

  test("excludes aborted streams (TONALCOACH-1C regression)", async () => {
    // Root cause: syncStreams returns "aborted" streams by default. These contain
    // error deltas from failed LLM attempts that the Vercel AI SDK client re-throws
    // as unhandled promise rejections via the void (async () => {...})() pattern
    // in useStreamingUIMessages.js. Passing includeStatuses: ["streaming", "finished"]
    // prevents aborted streams from reaching the client entirely.
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));
    const authed = t.withIdentity({ subject: `${userId}|session` });

    await authed.query(api.chat.listMessages, {
      threadId: THREAD_ID,
      paginationOpts: PAGINATION_OPTS,
      streamArgs: { kind: "list" },
    });

    expect(syncStreamsMock).toHaveBeenCalledOnce();

    const syncStreamsOptions = syncStreamsMock.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(syncStreamsOptions?.includeStatuses).toEqual(["streaming", "finished"]);
    expect(syncStreamsOptions?.includeStatuses).not.toContain("aborted");
  });

  test("merges paginated messages and stream data in the response", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));
    const authed = t.withIdentity({ subject: `${userId}|session` });

    listUIMessagesMock.mockResolvedValueOnce({
      page: [{ id: "msg-1", role: "user" }],
      isDone: true,
      continueCursor: "cursor-abc",
    });
    syncStreamsMock.mockResolvedValueOnce({ activeStreams: [] });

    const result = await authed.query(api.chat.listMessages, {
      threadId: THREAD_ID,
      paginationOpts: PAGINATION_OPTS,
      streamArgs: { kind: "list" },
    });

    expect(result).toMatchObject({
      page: [{ id: "msg-1", role: "user" }],
      continueCursor: "cursor-abc",
      streams: { activeStreams: [] },
    });
  });

  test("forwards threadId and paginationOpts to listUIMessages", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => ctx.db.insert("users", {}));
    const authed = t.withIdentity({ subject: `${userId}|session` });

    await authed.query(api.chat.listMessages, {
      threadId: THREAD_ID,
      paginationOpts: PAGINATION_OPTS,
      streamArgs: { kind: "list" },
    });

    expect(listUIMessagesMock).toHaveBeenCalledOnce();
    const listUIMessagesOptions = listUIMessagesMock.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(listUIMessagesOptions?.threadId).toBe(THREAD_ID);
    expect(listUIMessagesOptions?.paginationOpts).toEqual(PAGINATION_OPTS);
  });
});
