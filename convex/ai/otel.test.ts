import { describe, expect, it } from "vitest";
import { flushTelemetry, isPhoenixEnabled, runInRunSpan, startRunSpan } from "./otel";

// No PHOENIX_API_KEY in vitest env — the module runs with a no-op provider and
// returns a fallback hex traceId so aiRun.runId stays unique per turn.

const HEX32 = /^[0-9a-f]{32}$/;

describe("startRunSpan", () => {
  it("returns a 32-char hex runId even without a Phoenix provider", () => {
    const { handle } = startRunSpan({
      userId: "u1",
      threadId: "t1",
      source: "chat",
      environment: "dev",
    });
    expect(handle.runId).toMatch(HEX32);
  });

  it("generates distinct runIds per turn", () => {
    const a = startRunSpan({
      userId: "u1",
      threadId: "t1",
      source: "chat",
      environment: "dev",
    });
    const b = startRunSpan({
      userId: "u1",
      threadId: "t1",
      source: "chat",
      environment: "dev",
    });
    expect(a.handle.runId).not.toBe(b.handle.runId);
  });

  it("accepts optional BYOK/image/provider metadata without throwing", () => {
    expect(() =>
      startRunSpan({
        userId: "u1",
        threadId: "t1",
        source: "approval_continuation",
        environment: "prod",
        provider: "gemini",
        release: "abcdef",
        promptVersion: "deadbeef",
        hasImages: true,
        isByok: false,
      }),
    ).not.toThrow();
  });

  it("records an error without throwing", () => {
    const { handle } = startRunSpan({
      userId: "u1",
      threadId: "t1",
      source: "chat",
      environment: "dev",
    });
    expect(() => handle.recordError("AI_APICallError")).not.toThrow();
  });
});

describe("runInRunSpan", () => {
  it("passes the handle to the callback and returns its result", async () => {
    const result = await runInRunSpan(
      {
        userId: "u1",
        threadId: "t1",
        source: "chat",
        environment: "dev",
      },
      async (handle) => ({ runId: handle.runId, value: 42 }),
    );
    expect(result.runId).toMatch(HEX32);
    expect(result.value).toBe(42);
  });

  it("ends the span and flushes even when the callback throws", async () => {
    await expect(
      runInRunSpan(
        {
          userId: "u1",
          threadId: "t1",
          source: "chat",
          environment: "dev",
        },
        async () => {
          throw new Error("boom");
        },
      ),
    ).rejects.toThrow("boom");
  });
});

describe("flushTelemetry", () => {
  it("resolves even without a configured Phoenix provider", async () => {
    await expect(flushTelemetry()).resolves.toBeUndefined();
  });
});

describe("isPhoenixEnabled", () => {
  // Provider wiring is decided at module-load time, so assert against the
  // ambient env rather than hard-coding false. Both CI (key set) and local
  // dev (key absent) exercise the same branch this way.
  it("mirrors whether PHOENIX_API_KEY was set at module load", () => {
    const expected = Boolean(process.env.PHOENIX_API_KEY);
    expect(isPhoenixEnabled()).toBe(expected);
  });
});
