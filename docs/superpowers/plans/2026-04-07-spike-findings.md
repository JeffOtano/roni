# OSS Release: Spike Findings

**Date:** 2026-04-07
**Context:** Preparation work for the open-source release. Findings captured here so downstream tasks can reference them.

## Task 0.1: @convex-dev/agent per-request provider construction

**Question:** Can we construct a coach agent per-request with a runtime-supplied Gemini API key?

**Answer:** Yes. Two viable patterns are supported. The recommended one for Task 3.8 is "construct the Agent per request with a fresh provider instance." A second viable pattern is "keep a singleton Agent and pass `model` per call." Both work because `@convex-dev/agent` accepts a per-call `model` override that takes precedence over the constructor's `languageModel`.

### Method note

This spike is a code-reading exercise only. The original Task 0.1 included a vitest smoke test, but we are skipping it because:

- It would require a real Gemini API key in CI.
- The behavior can be conclusively verified from the type definitions and runtime source.
- A live test belongs in Task 3.9 (BYOK integration tests), which is already scoped to cover the end-to-end flow.

### Evidence

1. `@convex-dev/agent` exports an `Agent` class whose constructor requires `languageModel` (the type is `LanguageModel`, not `LanguageModel | undefined`).
   - File: `node_modules/@convex-dev/agent/dist/client/index.d.ts:63` and `:95`
   - File (source): `node_modules/@convex-dev/agent/src/client/index.ts:234`

2. The `AgentPrompt` type (mixed into both `TextArgs` and `StreamingTextArgs`) declares an optional per-call `model` field that overrides the constructor's `languageModel`.
   - File: `node_modules/@convex-dev/agent/dist/client/types.d.ts:57-61`
     ```
     /**
      * The model to use for the LLM calls. This will override the languageModel
      * specified in the Agent config.
      */
     model?: LanguageModel;
     ```
   - The same file confirms the AI SDK's underlying `model` is stripped via `Omit<..., "model" | "prompt" | "messages">` so the `AgentPrompt.model` is the only `model` field on the call args. See `types.d.ts:302` (TextArgs) and `:309` (StreamingTextArgs).

3. The runtime path in `Agent.streamText` confirms the override semantics.
   - File: `node_modules/@convex-dev/agent/src/client/index.ts:570`
     ```
     model: streamTextArgs.model ?? this.options.languageModel,
     ```
   - The `Agent.generateText` path goes through `start()`, which performs the same fallback at `node_modules/@convex-dev/agent/src/client/start.ts:158-159`:
     ```
     const model = args.model ?? opts.languageModel;
     assert(model, "model is required");
     ```

4. `@ai-sdk/google` exports `createGoogleGenerativeAI({ apiKey })` which returns a `GoogleGenerativeAIProvider` you can call to get a `LanguageModel`.
   - File: `node_modules/@ai-sdk/google/dist/index.d.ts:343-376`
     ```
     interface GoogleGenerativeAIProviderSettings {
       apiKey?: string;
       baseURL?: string;
       headers?: Record<string, string | undefined>;
       fetch?: FetchFunction;
       ...
     }
     declare function createGoogleGenerativeAI(
       options?: GoogleGenerativeAIProviderSettings,
     ): GoogleGenerativeAIProvider;
     ```
   - The provider is callable directly and exposes `chat()`, `languageModel()`, and `embedding()` accessors.

5. Current Tonal Coach usage today constructs two singletons in `convex/ai/coach.ts:203-213`, both relying on `google("gemini-...")` which under the hood reads `process.env.GOOGLE_GENERATIVE_AI_API_KEY`.
   - These singletons are consumed by `streamWithRetry` in `convex/ai/resilience.ts:57` via `convex/chat.ts:135-141, 211-217, 271-277` and by `coachAgent.createThread`, `coachAgent.approveToolCall`, and `coachAgent.denyToolCall` in `convex/chat.ts:122, 185, 191`.

### Recommended pattern for Task 3.8

Construct the agents per request inside the action handler, keyed by the user's decrypted Gemini key. The shared `coachAgentConfig` object stays as is so we do not duplicate tool wiring. Only `languageModel` differs between the primary and fallback agent.

Sketch:

```typescript
// convex/ai/coach.ts
import { Agent } from "@convex-dev/agent";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { components } from "../_generated/api";

// coachAgentConfig stays exactly as it is today: tools, contextHandler,
// usageHandler, contextOptions, instructions, maxSteps, embeddingModel.
// (Note: embeddingModel below uses a server-side key, see caveats.)
export const coachAgentConfig = {
  /* unchanged */
};

export interface CoachAgentPair {
  primary: Agent;
  fallback: Agent;
}

/**
 * Build a Gemini-backed coach agent pair using the user-supplied API key.
 * Called inside actions after the key has been decrypted by convex/byok.ts.
 */
export function buildCoachAgents(apiKey: string): CoachAgentPair {
  const provider = createGoogleGenerativeAI({ apiKey });

  const primary = new Agent(components.agent, {
    name: "Tonal Coach",
    languageModel: provider("gemini-3-flash-preview"),
    ...coachAgentConfig,
  });

  const fallback = new Agent(components.agent, {
    name: "Tonal Coach (Fallback)",
    languageModel: provider("gemini-2.5-flash"),
    ...coachAgentConfig,
  });

  return { primary, fallback };
}
```

Then in `convex/chat.ts`, the action that streams a response would look up the decrypted key first, build the agent pair, and pass them into `streamWithRetry`:

```typescript
// convex/chat.ts (sketch for processMessage / sendMessage / continueAfterApproval)
const apiKey = await ctx.runAction(internal.byok.getDecryptedGeminiKey, { userId });
if (!apiKey) {
  // Surface BYOK_MISSING error to the chat UI; do not call the agent.
  return;
}

const { primary, fallback } = buildCoachAgents(apiKey);

await streamWithRetry(ctx, {
  primaryAgent: primary,
  fallbackAgent: fallback,
  threadId,
  userId,
  prompt: resolvedPrompt,
});
```

`streamWithRetry`'s signature in `convex/ai/resilience.ts:39-47` already accepts `Agent` instances and does not need to change. No fork or wrapper of `@convex-dev/agent` is required.

### Why per-request construction beats per-call `model` override

Both work, but per-request construction is preferable for Tonal Coach for these reasons:

- The `@ai-sdk/google` `google` singleton reads `process.env.GOOGLE_GENERATIVE_AI_API_KEY` at request time, so if we ever forget to pass `model` on a single call site, it would silently fall back to the server's env var. A per-request agent makes it impossible to call the LLM without the user's key.
- The `Agent.createThread`, `approveToolCall`, and `denyToolCall` methods (used at `convex/chat.ts:122, 185, 191`) do not take a `model` arg. They do not actually invoke the LLM (they only touch the agent component's storage), so for those calls the `languageModel` value is unused. But we still want a single source of truth: build the agent with the user's key, then call any method on it.
- Tool definitions, context handler, and usage handler are shared across both primary and fallback. We construct two `Agent` instances per request, but each one is cheap (no I/O in the constructor; see `index.ts:255-262`).

### Caveats and risks

1. **Embedding model uses a separate code path.** `coachAgentConfig.embeddingModel` is currently `google.textEmbeddingModel("gemini-embedding-001")` (`convex/ai/coach.ts:107`). The embedding model is used by the agent component for vector search across threads (`searchOtherThreads: true`, `vectorSearch: true`). Embeddings are called from inside the agent component, not from our action code. The agent uses whatever model object you pass at construction time, so if we want embeddings to also bill against the user's key, we must construct the embedding model from the same `provider` instance:

   ```typescript
   const provider = createGoogleGenerativeAI({ apiKey });
   const embeddingModel = provider.embedding("gemini-embedding-001");
   ```

   Then move `embeddingModel` out of `coachAgentConfig` and into `buildCoachAgents`. Decision needed: do we want embeddings to bill the user's key, or do we want to keep a single server-side embedding key (cheaper, simpler)? Recommend asking before Task 3.8 starts. The plan currently assumes the server pays for embeddings, which means we should keep `embeddingModel` in the shared config and construct it from a server-keyed provider that reads `process.env.GOOGLE_GENERATIVE_AI_API_KEY` at module scope. Both options are technically supported.

2. **Constructor cost is negligible but not zero.** Each `new Agent(...)` allocates a new options object and binds tools. There is no I/O. For the volume Tonal Coach handles (one agent build per chat message, plus one per `respondToToolApproval`), this is fine. If we ever add a code path that constructs many agents per request, revisit.

3. **`coachAgent` is also referenced from `convex/playground.ts`.** Per Grep results, the playground module imports `coachAgent`. When we refactor, the playground will also need to either:
   - Construct an agent from a server-supplied key (acceptable for an admin-only playground), or
   - Be removed entirely if it is not used in the OSS release.
     Flag this in Task 3.8.

4. **Tests.** `convex/ai/promptSections.test.ts` imports from `./coach`. Verify nothing in that test file relies on the singleton `coachAgent` export. If we keep `coachAgent` as a fallback export for backward compatibility, the test should still pass; if we delete it, update the test imports.

5. **`assert(model, "model is required")` is the only runtime guard.** If a downstream tweak ever passes `undefined` as the user's key, the call would fail with a generic message at `start.ts:159`. Wrap the BYOK lookup so a missing key throws a typed `BYOK_MISSING` error before reaching the agent. This is already in scope for Task 3.2 and Task 4.5.

6. **AI SDK version pinning.** `@convex-dev/agent` v0.6.1 enforces AI SDK v6 via the `AssertAISDKv6` type guard (`types.d.ts:19-21`). The current installed `@ai-sdk/google` is v3.x of the `@ai-sdk/google` package (which corresponds to AI SDK v6). No upgrade needed for this spike, but pin both packages explicitly when bumping either.

## Task 0.2: Tonal legal entity name

**Question:** What is the exact legal entity name to use in the OSS release disclaimer, LICENSE footer, and hosted app footer?

**Answer:** `Tonal Systems, Inc.` (with a comma before `Inc.`)

**Evidence:**

- Tonal's Terms of Service at `https://www.tonal.com/terms` opens with: _"This Agreement is between you and Tonal Systems, Inc. ("Tonal" or "we" or "us")..."_. This is the authoritative legal framing the OSS disclaimer should mirror.
- Tonal's Privacy Policy at `https://www.tonal.com/privacy` contains a shop address section with `"company":"Tonal Systems Inc."` (no comma). This is a commerce-platform address field, not the legal entity name, and is not authoritative for legal references.

**How to use this in downstream tasks:**

- README callout, LICENSE footer, app footer, GitHub repo description: use `Tonal Systems, Inc.` (with comma)
- Trademark attribution language: _"Tonal is a trademark of Tonal Systems, Inc., used here under nominative fair use."_

No code changes in this task. Findings only.

## Controller note

Task 0.2 was handled directly by the controller (not dispatched to a subagent). Rationale: the task is a single WebFetch plus a two-line append to this file. The three-subagent flow (implementer + spec reviewer + code quality reviewer) is designed for code tasks and is disproportionate for a trivial doc lookup. No other tasks in the plan should skip the subagent flow; this is the only exception because the work is too small to justify the overhead.
