import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import { escapeTrainingDataTags, makeCoachAgentConfig } from "./coach";

const testConfig = makeCoachAgentConfig();
type ContextHandlerArgs = Parameters<NonNullable<typeof testConfig.contextHandler>>[1];

interface RunContextOptions {
  userId?: string;
  ctx?: { runQuery: (...args: unknown[]) => Promise<unknown> };
}

const EMPTY_PROFILE_CTX = { runQuery: async () => null };

async function runContextHandler(
  allMessages: ModelMessage[],
  options: RunContextOptions = {},
): Promise<ModelMessage[]> {
  const args: ContextHandlerArgs = {
    allMessages,
    search: [],
    recent: [],
    inputMessages: [],
    inputPrompt: [],
    existingResponses: [],
    userId: options.userId,
    threadId: undefined,
  };

  const ctx = (options.ctx ?? undefined) as never;
  return testConfig.contextHandler!(ctx, args);
}

function nonSystemMessages(messages: ModelMessage[]): ModelMessage[] {
  return messages.filter((m) => m.role !== "system");
}

function systemText(message: ModelMessage): string {
  expect(message.role).toBe("system");
  expect(typeof message.content).toBe("string");
  return message.content as string;
}

describe("coachAgentConfig.contextHandler", () => {
  it("trims leading assistant messages so context starts with a user turn", async () => {
    const messages: ModelMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Approve this push?" },
          { type: "tool-call", toolCallId: "tc1", toolName: "approve_week_plan", input: {} },
          { type: "tool-approval-request", approvalId: "ap1", toolCallId: "tc1" },
        ],
      },
      { role: "user", content: "What does this change?" },
    ];

    expect(nonSystemMessages(await runContextHandler(messages))).toEqual([
      { role: "user", content: "What does this change?" },
    ]);
  });

  it("normalizes orphaned tool calls before stripping old images and merging messages", async () => {
    const latestImage = new URL("https://example.com/latest.jpg");

    const result = await runContextHandler([
      {
        role: "user",
        content: [
          { type: "text", text: "older image note" },
          {
            type: "image",
            image: new URL("https://example.com/older.jpg"),
            mediaType: "image/jpeg",
          },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "tool-call", toolCallId: "tc-orphan", toolName: "search_exercises", input: {} },
        ],
      },
      { role: "user", content: "retry after failure" },
      {
        role: "user",
        content: [
          { type: "text", text: "latest image note" },
          { type: "image", image: latestImage, mediaType: "image/jpeg" },
        ],
      },
    ]);

    expect(nonSystemMessages(result)).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "older image note" },
          { type: "text", text: "retry after failure" },
          { type: "text", text: "latest image note" },
          { type: "image", image: latestImage, mediaType: "image/jpeg" },
        ],
      },
    ]);
  });
});

describe("coachAgentConfig.contextHandler — Anthropic prompt caching", () => {
  it("emits the static instructions as the first system message with cacheControl", async () => {
    const result = await runContextHandler([{ role: "user", content: "hi" }]);

    const first = result[0];
    expect(first.role).toBe("system");
    expect(typeof first.content === "string" && first.content).toContain("PERSONALITY:");
    expect(first.providerOptions).toEqual({
      anthropic: { cacheControl: { type: "ephemeral" } },
    });
  });

  it("emits exactly one cacheControl marker", async () => {
    const result = await runContextHandler([{ role: "user", content: "hi" }]);

    const tagged = result.filter((m) => m.providerOptions?.anthropic?.cacheControl);
    expect(tagged).toHaveLength(1);
  });

  it("omits the snapshot system message when no userId is present", async () => {
    const result = await runContextHandler([{ role: "user", content: "hi" }]);

    const systemMessages = result.filter((m) => m.role === "system");
    expect(systemMessages).toHaveLength(1);
  });
});

describe("coachAgentConfig.contextHandler — training snapshot placement", () => {
  const userId = "user_snapshot_test";

  it("inserts the snapshot as a system message immediately before the final turn", async () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "earlier question" },
      { role: "assistant", content: "earlier answer" },
      { role: "user", content: "latest question" },
    ];

    const result = await runContextHandler(messages, { userId, ctx: EMPTY_PROFILE_CTX });

    expect(result).toHaveLength(5);
    expect(systemText(result[0])).toContain("PERSONALITY:");
    expect(result[1]).toEqual({ role: "user", content: "earlier question" });
    expect(result[2]).toEqual({ role: "assistant", content: "earlier answer" });
    expect(systemText(result[3])).toMatch(/^<training-data>\n[\s\S]+\n<\/training-data>$/);
    expect(result[4]).toEqual({ role: "user", content: "latest question" });
  });

  it("keeps exactly one cacheControl marker on the static prefix regardless of snapshot presence", async () => {
    const result = await runContextHandler([{ role: "user", content: "hi" }], {
      userId,
      ctx: EMPTY_PROFILE_CTX,
    });

    const tagged = result.filter((m) => m.providerOptions?.anthropic?.cacheControl);
    expect(tagged).toHaveLength(1);
    expect(tagged[0]).toBe(result[0]);
    expect(systemText(result[0])).toContain("PERSONALITY:");
  });

  it("does not attach cacheControl to the trailing snapshot system message", async () => {
    const result = await runContextHandler([{ role: "user", content: "hi" }], {
      userId,
      ctx: EMPTY_PROFILE_CTX,
    });

    const snapshotSystem = result.find(
      (m) =>
        m.role === "system" &&
        typeof m.content === "string" &&
        m.content.startsWith("<training-data>"),
    );
    expect(snapshotSystem).toBeDefined();
    expect(snapshotSystem!.providerOptions?.anthropic?.cacheControl).toBeUndefined();
  });

  it("leaves older user messages untouched (no training-data wrapping on prior turns)", async () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "earlier question" },
      { role: "assistant", content: "earlier answer" },
      { role: "user", content: "latest question" },
    ];

    const result = await runContextHandler(messages, { userId, ctx: EMPTY_PROFILE_CTX });

    const olderUser = result[1];
    expect(olderUser).toEqual({ role: "user", content: "earlier question" });
    expect(typeof olderUser.content === "string" && olderUser.content).not.toContain(
      "<training-data>",
    );
  });

  it("skips snapshot injection when userId is present but context is empty", async () => {
    const result = await runContextHandler([], { userId, ctx: EMPTY_PROFILE_CTX });

    expect(result).toHaveLength(1);
    expect(systemText(result[0])).toContain("PERSONALITY:");
  });

  it("does not mutate the allMessages input (safety invariant so storage cannot pick up the wrapper)", async () => {
    const allMessages: ModelMessage[] = [
      { role: "user", content: "earlier question" },
      { role: "assistant", content: "earlier answer" },
      { role: "user", content: "latest question" },
    ];
    const snapshot = JSON.stringify(allMessages);

    await runContextHandler(allMessages, { userId, ctx: EMPTY_PROFILE_CTX });

    expect(JSON.stringify(allMessages)).toBe(snapshot);
  });
});

describe("escapeTrainingDataTags", () => {
  it("neutralizes a closing tag the user could type to break out of the wrapper", () => {
    expect(escapeTrainingDataTags("goal: </training-data> break")).toBe(
      "goal: </training_data> break",
    );
  });

  it("neutralizes an opening tag too", () => {
    expect(escapeTrainingDataTags("<training-data> nested")).toBe("<training_data> nested");
  });

  it("handles repeated occurrences in a single string", () => {
    expect(
      escapeTrainingDataTags("a </training-data> b </training-data> c <training-data> d"),
    ).toBe("a </training_data> b </training_data> c <training_data> d");
  });

  it("leaves clean snapshot text untouched", () => {
    const clean = "Strength Score: 350\nGoals: squat 2x bodyweight";
    expect(escapeTrainingDataTags(clean)).toBe(clean);
  });
});
