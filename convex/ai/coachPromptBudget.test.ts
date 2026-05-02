import { describe, expect, it } from "vitest";
import { getFunctionName } from "convex/server";
import type { ModelMessage } from "ai";
import { type CoachAgentConfigOptions, makeCoachAgentConfig } from "./coach";
import { internal } from "../_generated/api";

type ContextHandlerArgs = Parameters<
  NonNullable<ReturnType<typeof makeCoachAgentConfig>["contextHandler"]>
>[1];

const GATHER_SNAPSHOT_INPUTS_NAME = getFunctionName(internal.coachState.gatherSnapshotInputs);
const EMPTY_SNAPSHOT_INPUTS = {
  profile: null,
  scores: [],
  readiness: null,
  activities: [],
  activeBlock: null,
  recentFeedback: [],
  activeGoals: [],
  activeInjuries: [],
  exerciseExclusions: [],
  externalActivities: [],
  garminWellness: [],
};

function buildLargeSnapshotInputs() {
  const activeGoals = Array.from({ length: 60 }, (_, index) => ({
    title: `Goal ${index} ${"bench ".repeat(10)}`,
    targetValue: 100,
    baselineValue: 0,
    currentValue: 20,
    deadline: "2026-12-31",
  }));

  return {
    ...EMPTY_SNAPSHOT_INPUTS,
    profile: {
      profileData: {
        firstName: "Test",
        lastName: "User",
        heightInches: 70,
        weightPounds: 180,
        level: "intermediate",
        workoutsPerWeek: 4,
      },
      onboardingData: { goal: "general strength" },
      trainingPreferences: null,
      ownedAccessories: null,
    },
    activeGoals,
  };
}

const LARGE_SNAPSHOT_CTX = {
  runQuery: async (query: unknown) => {
    if (getFunctionName(query as never) === GATHER_SNAPSHOT_INPUTS_NAME) {
      return buildLargeSnapshotInputs();
    }
    return null;
  },
};

async function runContextHandler(
  allMessages: ModelMessage[],
  config: CoachAgentConfigOptions,
  userId?: string,
): Promise<ModelMessage[]> {
  const agentConfig = makeCoachAgentConfig(config);
  const args: ContextHandlerArgs = {
    allMessages,
    search: [],
    recent: [],
    inputMessages: [],
    inputPrompt: [],
    existingResponses: [],
    userId,
    threadId: undefined,
  };

  const ctx = (userId ? LARGE_SNAPSHOT_CTX : undefined) as never;
  return agentConfig.contextHandler!(ctx, args);
}

function nonSystemMessages(messages: ModelMessage[]): ModelMessage[] {
  return messages.filter((message) => message.role !== "system");
}

function systemText(message: ModelMessage): string {
  expect(message.role).toBe("system");
  expect(typeof message.content).toBe("string");
  return message.content as string;
}

describe("coachAgentConfig.contextHandler — provider-aware prompt budgets", () => {
  it("subtracts authenticated snapshot overhead before windowing messages", async () => {
    const priorContext = "prior ".repeat(Math.floor(148_000 / 6));
    const messages: ModelMessage[] = [
      { role: "user", content: priorContext },
      { role: "assistant", content: "prior answer" },
      { role: "user", content: "latest question" },
    ];
    const config: CoachAgentConfigOptions = {
      provider: "openrouter",
      modelId: "openrouter/auto",
    };

    const withoutSnapshot = await runContextHandler(messages, config);
    const withSnapshot = await runContextHandler(messages, config, "user_large_snapshot");

    expect(nonSystemMessages(withoutSnapshot)).toEqual(messages);
    expect(systemText(withSnapshot[1])).toContain("Active Goals:");
    expect(nonSystemMessages(withSnapshot)).toEqual([{ role: "user", content: "latest question" }]);
  });

  it("drops search-prefixed older context before the latest local turn when the full prompt budget is tight", async () => {
    const hugeSearchResult = "search result ".repeat(22_000);
    const messages: ModelMessage[] = [
      { role: "user", content: hugeSearchResult },
      { role: "assistant", content: "older search answer" },
      { role: "user", content: "latest local question" },
      { role: "assistant", content: "latest local answer" },
    ];

    const result = await runContextHandler(messages, {
      provider: "openrouter",
      modelId: "openrouter/auto",
    });

    expect(nonSystemMessages(result)).toEqual([
      { role: "user", content: "latest local question" },
      { role: "assistant", content: "latest local answer" },
    ]);
  });

  it("uses a tighter prompt budget for Claude Haiku than Claude Sonnet", async () => {
    const largePriorTurn = "prior context ".repeat(26_000);
    const messages: ModelMessage[] = [
      { role: "user", content: largePriorTurn },
      { role: "assistant", content: "prior answer" },
      { role: "user", content: "latest question" },
    ];

    const sonnet = await runContextHandler(messages, {
      provider: "claude",
      modelId: "claude-sonnet-4-6",
    });
    const haiku = await runContextHandler(messages, {
      provider: "claude",
      modelId: "claude-haiku-4-5",
    });

    expect(nonSystemMessages(sonnet)[0]).toEqual({ role: "user", content: largePriorTurn });
    expect(nonSystemMessages(haiku)).toEqual([{ role: "user", content: "latest question" }]);
  });

  it("keeps non-Claude system messages at the front under authenticated budget pressure", async () => {
    const hugeSearchResult = "search ".repeat(Math.floor(148_000 / 7));
    const messages: ModelMessage[] = [
      { role: "user", content: hugeSearchResult },
      { role: "assistant", content: "dropped search answer" },
      { role: "user", content: "retained local preference" },
      { role: "assistant", content: "retained local answer" },
      { role: "user", content: "latest local question" },
    ];

    const result = await runContextHandler(
      messages,
      { provider: "openrouter", modelId: "openrouter/auto" },
      "user_default_tight_budget",
    );

    expect(systemText(result[0])).toContain("PERSONALITY:");
    expect(systemText(result[1])).toContain("Active Goals:");
    expect(result.slice(2).every((message) => message.role !== "system")).toBe(true);
    expect(nonSystemMessages(result)).toEqual([
      { role: "user", content: "retained local preference" },
      { role: "assistant", content: "retained local answer" },
      { role: "user", content: "latest local question" },
    ]);
  });

  it("keeps Claude cache markers on the retained head under authenticated budget pressure", async () => {
    const hugeSearchResult = "search ".repeat(Math.floor(148_000 / 7));
    const messages: ModelMessage[] = [
      { role: "user", content: hugeSearchResult },
      { role: "assistant", content: "dropped search answer" },
      { role: "user", content: "retained preference" },
      { role: "assistant", content: "retained answer" },
      { role: "user", content: "latest question" },
    ];

    const result = await runContextHandler(
      messages,
      { provider: "claude", modelId: "claude-haiku-4-5" },
      "user_claude_tight_budget",
    );
    const snapshotIndex = result.findIndex(
      (message) =>
        message.role === "system" &&
        typeof message.content === "string" &&
        message.content.startsWith("<training-data>"),
    );
    const taggedAssistants = result.filter(
      (message) => message.role === "assistant" && message.providerOptions?.anthropic?.cacheControl,
    );

    expect(result[0].providerOptions?.anthropic?.cacheControl).toEqual({ type: "ephemeral" });
    expect(nonSystemMessages(result)).toEqual([
      { role: "user", content: "retained preference" },
      expect.objectContaining({
        role: "assistant",
        content: "retained answer",
        providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
      }),
      { role: "user", content: "latest question" },
    ]);
    expect(snapshotIndex).toBe(3);
    expect(taggedAssistants).toHaveLength(1);
    expect(taggedAssistants[0].content).toBe("retained answer");
  });
});
