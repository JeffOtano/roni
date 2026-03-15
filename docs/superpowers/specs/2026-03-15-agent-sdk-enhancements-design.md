# Agent SDK Enhancements Design

Maximize usage of `@convex-dev/agent@0.6.0-alpha.1` capabilities across 7 features grouped by impact.

## Decisions Made

- **Embedding model:** `text-embedding-004` from `@ai-sdk/google` (same ecosystem as Gemini 2.5 Pro, already in deps)
- **Approval gate strategy:** SDK-level `needsApproval` on destructive tools, with UI approval buttons rendered inline
- **Structured output:** `generateObject` for weekly plan summaries rendered as rich UI cards
- **Workflow dependency:** Not adding `@convex-dev/workflow` — the approve flow is simple enough without it (single action that pushes N workouts). If partial failures become a problem, add later.
- **Playground:** Gated behind `AGENT_PLAYGROUND_API_KEY` env var, dev-only

---

## Feature 1: Cross-Thread Memory (Embeddings + Semantic Search)

### Problem

Every 24 hours the coach starts a fresh thread and loses all conversational history. It cannot recall that a user said "I hate lunges" last week or "my shoulder felt off on overhead press" three sessions ago.

### Design

**Agent config changes** in `convex/ai/coach.ts`:

```ts
import { google } from "@ai-sdk/google";

export const coachAgent = new Agent(components.agent, {
  name: "Tonal Coach",
  languageModel: google("gemini-2.5-pro"),
  embeddingModel: google.textEmbeddingModel("text-embedding-004"),

  contextOptions: {
    recentMessages: 100,
    searchOtherThreads: true,
    searchOptions: {
      limit: 10,
      vectorSearch: true,
      textSearch: true,
      vectorScoreThreshold: 0.3,
      messageRange: { before: 2, after: 1 },
    },
  },

  contextHandler: async (ctx, args) => {
    // Training snapshot is injected as system message (not stored in thread)
    const userId = args.userId;
    if (!userId) return [...args.allMessages, ...args.inputPrompt];

    const snapshot = await buildTrainingSnapshot(ctx, userId);
    const snapshotMessage = { role: "system" as const, content: snapshot };

    // Use SDK's default ordering (search + recent + input) and prepend snapshot
    return [snapshotMessage, ...args.allMessages];
  },

  // ... rest unchanged
});
```

**Key behavior:**

- `args.allMessages` now includes semantically relevant messages from older threads (via vector + text search)
- `args.search` contains just the search results if the handler needs to inspect them separately
- The SDK automatically generates embeddings for new messages when `embeddingModel` is set
- `vectorScoreThreshold: 0.3` filters out low-relevance matches
- `messageRange: { before: 2, after: 1 }` includes surrounding context for each search hit

**No schema changes.** The agent component manages its own embedding storage internally.

**System prompt addition** to coach instructions:

```
MEMORY:
- You have access to the user's conversation history across all past sessions.
- When relevant context from a previous conversation appears, reference it naturally.
- If the user mentioned preferences, dislikes, or constraints in a past session, honor them without being asked.
- Example: if they said "I don't like Bulgarian split squats" weeks ago, don't program them.
```

---

## Feature 2: Human-in-the-Loop Tool Approval Gates

### Problem

Destructive tools (push workouts to Tonal, delete plans) rely on the LLM verbally asking for confirmation. The model can skip this, hallucinate approval, or misinterpret "looks good" as approval for the wrong action.

### Design

**Tools that get `needsApproval: true`:**

- `approve_week_plan` — pushes all draft workouts to Tonal hardware
- `create_workout` — creates a single workout on Tonal
- `delete_workout` — removes a workout from Tonal
- `delete_week_plan` — deletes the current draft plan and all draft workouts

**Tool changes** (example for `approveWeekPlanTool`):

```ts
export const approveWeekPlanTool = createTool({
  description: "...",
  inputSchema: z.object({ ... }),
  needsApproval: true,  // <-- add this
  execute: async (ctx, input) => { ... },
});
```

**Backend: approval/denial mutations** in `convex/chat.ts`:

```ts
export const respondToToolApproval = mutation({
  args: {
    threadId: v.string(),
    approvalId: v.string(),
    approved: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, approvalId, approved, reason }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    let messageId: string;
    if (approved) {
      ({ messageId } = await coachAgent.approveToolCall(ctx, {
        threadId,
        approvalId,
        reason,
      }));
    } else {
      ({ messageId } = await coachAgent.denyToolCall(ctx, {
        threadId,
        approvalId,
        reason,
      }));
    }
    return { messageId };
  },
});

// After approval/denial, continue the agent generation
export const continueAfterApproval = action({
  args: {
    threadId: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, { threadId, messageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { thread } = await coachAgent.continueThread(ctx, {
      threadId,
      userId,
    });

    await thread.streamText(
      { promptMessageId: messageId },
      { saveStreamDeltas: { chunking: "word", throttleMs: 100 } },
    );
  },
});
```

**Frontend: approval UI** in `ToolCallIndicator.tsx`:

The SDK emits message parts with `type: "tool-approval-request"` containing `{ approvalId, toolCallId }`. Note: the approval request part does NOT contain `toolName` or `input` — these must be resolved by correlating `toolCallId` with the sibling `dynamic-tool` part on the same message.

```tsx
// In ChatMessage.tsx, handle approval request parts:
// First, build a lookup from toolCallId -> { toolName, input } using dynamic-tool parts
const toolLookup = new Map(
  message.parts
    .filter((p) => p.type === "dynamic-tool")
    .map((p) => [p.toolCallId, { toolName: p.toolName, input: p.input }]),
);

// Then render approval requests with resolved tool info
if (part.type === "tool-approval-request") {
  const toolInfo = toolLookup.get(part.toolCallId);
  return (
    <ToolApprovalCard
      key={part.approvalId}
      toolName={toolInfo?.toolName ?? "unknown"}
      input={toolInfo?.input}
      approvalId={part.approvalId}
      threadId={threadId}
    />
  );
}
```

New component `ToolApprovalCard.tsx`:

- Shows what tool wants to run and with what input (resolved via toolCallId correlation)
- Renders "Approve" (primary) and "Deny" (ghost) buttons
- Calls `respondToToolApproval` mutation, then `continueAfterApproval` action
- Disables buttons after click, shows loading state
- For `approve_week_plan`: shows a summary of what will be pushed (N workouts to Tonal)

**Approved/denied states:** After response, the part transitions to either `tool-approval-response` with `approved: true/false`. UI shows a static badge: "Approved" or "Denied".

### Tools NOT getting approval gates

- `program_week` — creates drafts only, no Tonal push
- `swap_exercise`, `move_session`, `adjust_session_duration` — modify drafts only
- Read-only tools (search, scores, history) — no side effects

---

## Feature 3: Structured Output for Week Plan Presentation

### Problem

After `program_week` runs, the agent writes a markdown summary of the plan. This is fragile (formatting varies), not interactive, and can't be rendered as a rich card.

### Design

**New Zod schema** for structured plan output in `convex/ai/schemas.ts`:

```ts
import { z } from "zod";

export const weekPlanPresentationSchema = z.object({
  weekStartDate: z.string(),
  split: z.enum(["ppl", "upper_lower", "full_body"]),
  days: z.array(
    z.object({
      dayName: z.string(), // "Monday", "Wednesday", etc.
      sessionType: z.string(), // "Push", "Pull", "Legs", etc.
      targetMuscles: z.string(), // "Chest, Triceps, Shoulders"
      durationMinutes: z.number(),
      exercises: z.array(
        z.object({
          name: z.string(),
          sets: z.number(),
          reps: z.number(),
          targetWeight: z.number().optional(),
          lastWeight: z.number().optional(),
          lastReps: z.number().optional(),
          note: z.string().optional(), // "PR target", "Plateau - consider swapping"
        }),
      ),
    }),
  ),
  summary: z.string(), // Brief natural language summary
});

export type WeekPlanPresentation = z.infer<typeof weekPlanPresentationSchema>;
```

**Usage in `sendMessage`:**

After `program_week` returns, the agent currently writes markdown. Instead, we add a system instruction telling the agent to use structured output when presenting weekly plans:

```
WEEKLY PLAN PRESENTATION:
- After calling program_week, present the results using a structured format.
- Include each day's exercises with sets, reps, target weight, and last performance.
- Add notes for PRs, plateaus, or regressions on specific exercises.
- End with a brief summary noting key programming decisions.
```

The structured output is NOT a separate tool call — it's the agent's text response formatted as a JSON block that the UI detects and renders as a `WeekPlanCard` component. This approach avoids adding complexity to the tool layer while still enabling rich rendering.

**Frontend: `WeekPlanCard.tsx`**

- Detects JSON blocks in assistant messages matching the schema
- Renders as a tabbed card with one tab per training day
- Each day shows exercises in a table: name, sets x reps, target weight, last performance
- Progressive overload targets highlighted in green, regressions in amber
- Summary shown below the card

**Alternative considered:** Using `thread.generateObject()` after the tool call. Rejected because it would require a two-step generation (text + object) and the structured JSON in markdown approach is simpler and keeps the conversational flow natural.

---

## Feature 4: Usage Tracking

### Problem

No visibility into AI token costs per user, per conversation, or per tool invocation.

### Design

**Schema addition** in `convex/schema.ts`:

```ts
aiUsage: defineTable({
  userId: v.optional(v.id("users")),
  threadId: v.optional(v.string()),
  agentName: v.optional(v.string()),
  model: v.string(),
  provider: v.string(),
  inputTokens: v.number(),
  outputTokens: v.number(),
  totalTokens: v.number(),
  cacheReadTokens: v.optional(v.number()),
  cacheWriteTokens: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_userId", ["userId"])
  .index("by_createdAt", ["createdAt"]),
```

**Agent config** in `convex/ai/coach.ts`:

```ts
usageHandler: async (ctx, { userId, threadId, agentName, usage, model, provider }) => {
  await ctx.runMutation(internal.aiUsage.record, {
    userId: userId as Id<"users"> | undefined,
    threadId,
    agentName,
    model,
    provider,
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
    cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? undefined,
    cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? undefined,
  });
},
```

**Mutation** `convex/aiUsage.ts`:

```ts
export const record = internalMutation({
  args: { ... },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiUsage", { ...args, createdAt: Date.now() });
  },
});
```

No UI for now — this is infrastructure. Query via Convex dashboard or add admin page later.

---

## Feature 5: Smooth Text + Optimistic Messages

### Problem

1. Text appears in chunks (word-level) which can feel stuttery
2. After sending a message, there's a delay before it appears in the thread (round-trip to server)

### Design

**5a. Smooth Text** — `useSmoothText` in `ChatMessage.tsx`:

```tsx
import { useSmoothText } from "@convex-dev/agent/react";

// Inside ChatMessage, for streaming assistant text:
const [smoothText, { isStreaming: isSmoothStreaming }] = useSmoothText(part.text, {
  charsPerSec: 60,
  startStreaming: isStreaming,
});

// Use smoothText instead of part.text for display
const displayText = isStreaming ? smoothText + "\u258D" : part.text;
```

This gives a typewriter effect that smooths out the chunked delivery. `charsPerSec: 60` is a comfortable reading pace.

**5b. Optimistic Messages** — `optimisticallySendMessage` in `ChatInput.tsx`:

```tsx
import { useMutation } from "convex/react";
import { optimisticallySendMessage } from "@convex-dev/agent/react";

// Replace useAction with useMutation for optimistic update support
// This requires changing sendMessage from action to mutation+action pattern

// Option A: Keep action, add optimistic update to the query
const sendMessage = useAction(api.chat.sendMessage);
// Can't use optimistic updates with actions directly.

// Option B: Create a thin mutation that immediately saves the user message,
// then schedules the action for agent response.
```

**Decision:** Option B — split `sendMessage` into:

1. `sendMessageMutation` (mutation): resolves/creates thread, schedules agent action, returns threadId
2. `processMessage` (action): continues agent thread with the saved prompt

**First-message edge case:** When `threadId` is not yet known (first message), the optimistic update cannot run because `optimisticallySendMessage` requires `threadId: string`. Solution: the chat page always creates a thread on mount (via existing `createThread` mutation), so `threadId` is always available by the time the user can type. The `ChatInput` receives `threadId` as a required prop.

This enables `optimisticallySendMessage` on the mutation:

```tsx
const sendMessage = useMutation(api.chat.sendMessageMutation).withOptimisticUpdate(
  optimisticallySendMessage(api.chat.listMessages),
);
```

Note: The mutation does NOT save the user message to the thread — the SDK's `thread.streamText({ prompt })` in `processMessage` handles saving both the user prompt and the agent response. The optimistic update shows the message instantly on the client; the real message appears when the action runs.

**Backend change** in `convex/chat.ts`:

```ts
export const sendMessageMutation = mutation({
  args: { prompt: v.string(), threadId: v.optional(v.string()) },
  handler: async (ctx, { prompt, threadId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Rate limit check
    await rateLimiter.limit(ctx, "sendMessage", { key: userId, throws: true });

    // Resolve or create thread
    let targetThreadId = threadId;
    if (!targetThreadId) {
      // ... same stale thread logic, but using mutation-compatible queries
    }

    // Schedule the agent processing
    await ctx.scheduler.runAfter(0, internal.chat.processMessage, {
      threadId: targetThreadId,
      userId,
      prompt,
    });

    return { threadId: targetThreadId };
  },
});

export const processMessage = internalAction({
  args: { threadId: v.string(), userId: v.string(), prompt: v.string() },
  handler: async (ctx, { threadId, userId, prompt }) => {
    const { thread } = await coachAgent.continueThread(ctx, { threadId, userId });
    await thread.streamText(
      { prompt },
      { saveStreamDeltas: { chunking: "word", throttleMs: 100 } },
    );
  },
});
```

---

## Feature 6: Playground API

### Problem

No way to test/debug the agent interactively without going through the full app flow.

### Design

**New file** `convex/playground.ts`:

```ts
import { definePlaygroundAPI } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { coachAgent } from "./ai/coach";

export const {
  isApiKeyValid,
  listUsers,
  listThreads,
  listMessages,
  streamText,
  fetchContextMessages,
  listAgents,
} = definePlaygroundAPI(components.agent, {
  agents: [coachAgent],
});
```

**Environment variable:** `AGENT_PLAYGROUND_API_KEY` set in Convex dashboard (dev only).

**Access:** Via the Convex Agent Playground UI (hosted by Convex) or via API calls. No custom UI needed.

---

## Feature 7: Workflow Integration — Deferred

After analysis, `@convex-dev/workflow` adds complexity without proportional benefit for the current use case. The `approve_week_plan` action pushes N workouts sequentially and handles partial failures with status tracking (`pushing` → `pushed` / `failed`). The existing error handling is sufficient.

**Revisit when:** We add multi-step flows that span multiple agent calls or need durable execution guarantees (e.g., scheduled weekly auto-programming).

---

## Files to Create/Modify

### Create

| File                                  | Purpose                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `convex/ai/schemas.ts`                | Zod schemas for structured output (WeekPlanPresentation) |
| `convex/aiUsage.ts`                   | Usage tracking mutation                                  |
| `convex/playground.ts`                | Playground API definition                                |
| `src/components/ToolApprovalCard.tsx` | Approve/deny UI for tool gates                           |
| `src/components/WeekPlanCard.tsx`     | Rich card for structured week plan display               |

### Modify

| File                                   | Change                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `convex/ai/coach.ts`                   | Add embeddingModel, contextOptions, usageHandler, update contextHandler and instructions                     |
| `convex/ai/tools.ts`                   | Add `needsApproval: true` to `createWorkoutTool`, `deleteWorkoutTool`                                        |
| `convex/ai/weekTools.ts`               | Add `needsApproval: true` to `approveWeekPlanTool`, `deleteWeekPlanTool`                                     |
| `convex/chat.ts`                       | Add `respondToToolApproval` mutation, `continueAfterApproval` action, split sendMessage into mutation+action |
| `convex/schema.ts`                     | Add `aiUsage` table                                                                                          |
| `src/components/ChatMessage.tsx`       | Handle `tool-approval-request` parts, integrate `useSmoothText`                                              |
| `src/components/ChatInput.tsx`         | Switch to mutation with optimistic update, accept `threadId` as required prop                                |
| `src/components/ToolCallIndicator.tsx` | Handle approval states                                                                                       |

### No Changes Needed

| File                                 | Reason                                                             |
| ------------------------------------ | ------------------------------------------------------------------ |
| `convex/ai/weekModificationTools.ts` | Draft-only tools, no approval needed                               |
| `convex/ai/context.ts`               | Already works, just called differently from updated contextHandler |
| `convex/threads.ts`                  | Thread management unchanged                                        |
| `src/components/ChatThread.tsx`      | Message rendering unchanged (parts-based)                          |

---

## Implementation Order

1. **Usage tracking** (schema + mutation + agent config) — smallest, no dependencies
2. **Cross-thread memory** (embedding model + context options + instructions) — agent config only, no UI
3. **Tool approval gates** (tool changes + mutations + UI component) — requires backend + frontend
4. **Optimistic messages** (sendMessage split + mutation + ChatInput) — requires backend refactor
5. **Smooth text** (ChatMessage hook change) — frontend only, independent
6. **Structured output** (schema + instructions + WeekPlanCard) — frontend + prompt engineering
7. **Playground API** (new file) — independent, can be done anytime

---

## Testing Strategy

- **Usage tracking:** Unit test for `aiUsage.record` mutation. Verify handler is called via agent integration test.
- **Cross-thread memory:** Integration test: create thread A with message, create thread B, verify thread B's context includes relevant messages from A.
- **Tool approval:** Integration test: trigger tool with `needsApproval`, verify approval request part in messages, approve/deny, verify continuation.
- **Optimistic messages:** Manual testing — verify message appears instantly in UI before server confirms.
- **Smooth text:** Manual testing — verify smooth character-by-character display.
- **Structured output:** Unit test for schema validation. Manual testing for card rendering.
- **Playground:** Manual testing via Convex playground UI.
