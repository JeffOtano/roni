# Agent SDK Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maximize usage of `@convex-dev/agent@0.6.0-alpha.1` across 6 features: usage tracking, cross-thread memory, tool approval gates, optimistic messages, smooth text, structured output, and playground API.

**Architecture:** Each feature is an independent task that touches the shared agent config (`convex/ai/coach.ts`) and extends either the backend (`convex/`) or frontend (`src/components/`). Tasks are ordered so each produces a committable, type-safe increment.

**Tech Stack:** Convex, @convex-dev/agent 0.6.0-alpha.1, @ai-sdk/google, React 19, TypeScript, Tailwind CSS, Zod

**Spec:** `docs/superpowers/specs/2026-03-15-agent-sdk-enhancements-design.md`

---

## Chunk 1: Backend Infrastructure

### Task 1: Usage Tracking

**Files:**

- Create: `convex/aiUsage.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/ai/coach.ts`

- [ ] **Step 1: Add `aiUsage` table to schema**

In `convex/schema.ts`, add before the closing `});`:

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
  })
    .index("by_userId", ["userId"])
    .index("by_createdAt", ["createdAt"]),
```

- [ ] **Step 2: Create `convex/aiUsage.ts`**

```ts
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const record = internalMutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiUsage", { ...args, createdAt: Date.now() });
  },
});
```

- [ ] **Step 3: Add `usageHandler` to agent config**

In `convex/ai/coach.ts`, add import and usageHandler to the agent config:

```ts
// Add to imports:
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// Add inside new Agent({ ... }), after maxSteps:
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

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/aiUsage.ts convex/ai/coach.ts
git commit -m "feat: add AI usage tracking with per-request token logging"
```

---

### Task 2: Cross-Thread Memory (Embeddings + Semantic Search)

**Files:**

- Modify: `convex/ai/coach.ts`

- [ ] **Step 1: Add embedding model and context options**

In `convex/ai/coach.ts`, update the agent config. The `google` import already exists. Add `embeddingModel` and `contextOptions`:

```ts
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

  // ... instructions, tools, maxSteps, usageHandler unchanged
```

- [ ] **Step 2: Update contextHandler to use `args.allMessages`**

Replace the existing `contextHandler` in the agent config:

Old:

```ts
  contextHandler: async (ctx, args) => {
    if (!args.userId) return [...args.recent, ...args.inputPrompt];

    const snapshot = await buildTrainingSnapshot(ctx, args.userId);
    const snapshotMessage = {
      role: "system" as const,
      content: snapshot,
    };
    return [snapshotMessage, ...args.recent, ...args.inputPrompt];
  },
```

New:

```ts
  contextHandler: async (ctx, args) => {
    if (!args.userId) return [...args.allMessages];

    const snapshot = await buildTrainingSnapshot(ctx, args.userId);
    const snapshotMessage = {
      role: "system" as const,
      content: snapshot,
    };
    return [snapshotMessage, ...args.allMessages];
  },
```

Note: `args.allMessages` already includes search results + recent + inputMessages + inputPrompt in the SDK's default order when `contextOptions` is configured with search.

- [ ] **Step 3: Add MEMORY section to system instructions**

In the `instructions` string in the agent config, add after the MISSED SESSIONS section:

```
MEMORY:
- You have access to the user's conversation history across all past sessions.
- When relevant context from a previous conversation appears, reference it naturally.
- If the user mentioned preferences, dislikes, or constraints in a past session, honor them without being asked.
- Example: if they said "I don't like Bulgarian split squats" weeks ago, don't program them.
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/ai/coach.ts
git commit -m "feat: enable cross-thread memory with embeddings and semantic search"
```

---

### Task 3: Tool Approval Gates (Backend)

**Files:**

- Modify: `convex/ai/tools.ts`
- Modify: `convex/ai/weekTools.ts`
- Modify: `convex/chat.ts`

- [ ] **Step 1: Add `needsApproval: true` to destructive tools in `convex/ai/tools.ts`**

Add `needsApproval: true` to `createWorkoutTool` (line 175) and `deleteWorkoutTool` (line 221):

For `createWorkoutTool`, add after the `inputSchema` definition (before `execute`):

```ts
  needsApproval: true,
```

For `deleteWorkoutTool`, add after the `inputSchema` definition (before `execute`):

```ts
  needsApproval: true,
```

- [ ] **Step 2: Add `needsApproval: true` to destructive tools in `convex/ai/weekTools.ts`**

Add `needsApproval: true` to `approveWeekPlanTool` (line 282) and `deleteWeekPlanTool` (line 231):

For `deleteWeekPlanTool`, add after the `inputSchema` line (before `execute`):

```ts
  needsApproval: true,
```

For `approveWeekPlanTool`, add after the `inputSchema` line (before `execute`):

```ts
  needsApproval: true,
```

- [ ] **Step 3: Add approval mutations and continuation action to `convex/chat.ts`**

Add these exports to `convex/chat.ts`:

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

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/ai/tools.ts convex/ai/weekTools.ts convex/chat.ts
git commit -m "feat: add SDK-level tool approval gates for destructive operations"
```

---

### Task 4: Split sendMessage for Optimistic Updates (Backend)

**Files:**

- Modify: `convex/chat.ts`

- [ ] **Step 1: Add `sendMessageMutation` and `processMessage` to `convex/chat.ts`**

Add `internalAction` to the import from `"./_generated/server"`:

```ts
import { action, mutation, query, internalAction } from "./_generated/server";
```

Add the `internal` import if not already present (it was added in Task 1).

Add these new exports. Keep the existing `sendMessage` action for backward compatibility during the transition (will be removed in the frontend task):

```ts
export const sendMessageMutation = mutation({
  args: {
    prompt: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, { prompt, threadId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await rateLimiter.limit(ctx, "sendMessage", {
      key: userId,
      throws: true,
    });

    // Schedule the agent processing
    await ctx.scheduler.runAfter(0, internal.chat.processMessage, {
      threadId,
      userId,
      prompt,
    });

    return { threadId };
  },
});

export const processMessage = internalAction({
  args: {
    threadId: v.string(),
    userId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, userId, prompt }) => {
    const { thread } = await coachAgent.continueThread(ctx, {
      threadId,
      userId,
    });

    await thread.streamText(
      { prompt },
      { saveStreamDeltas: { chunking: "word", throttleMs: 100 } },
    );
  },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/chat.ts
git commit -m "feat: add mutation-based sendMessage for optimistic update support"
```

---

### Task 5: Playground API

**Files:**

- Create: `convex/playground.ts`

- [ ] **Step 1: Create `convex/playground.ts`**

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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

Note: The playground requires `AGENT_PLAYGROUND_API_KEY` env var in the Convex dashboard. Set it in dev only.

- [ ] **Step 3: Commit**

```bash
git add convex/playground.ts
git commit -m "feat: add agent playground API for interactive debugging"
```

---

## Chunk 2: Frontend

### Task 6: Tool Approval UI

**Files:**

- Create: `src/components/ToolApprovalCard.tsx`
- Modify: `src/components/ChatMessage.tsx`

- [ ] **Step 1: Create `src/components/ToolApprovalCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Check, Loader2, X } from "lucide-react";

const TOOL_LABELS: Record<string, string> = {
  approve_week_plan: "Push workouts to your Tonal",
  create_workout: "Create workout on Tonal",
  delete_workout: "Delete workout from Tonal",
  delete_week_plan: "Delete current week plan",
};

interface ToolApprovalCardProps {
  toolName: string;
  input?: unknown;
  approvalId: string;
  threadId: string;
}

export function ToolApprovalCard({ toolName, approvalId, threadId }: ToolApprovalCardProps) {
  const [status, setStatus] = useState<"pending" | "approving" | "denying" | "done">("pending");
  const respond = useMutation(api.chat.respondToToolApproval);
  const continueAgent = useAction(api.chat.continueAfterApproval);

  const label = TOOL_LABELS[toolName] ?? toolName;

  const handleResponse = async (approved: boolean) => {
    setStatus(approved ? "approving" : "denying");
    try {
      const { messageId } = await respond({ threadId, approvalId, approved });
      await continueAgent({ threadId, messageId });
      setStatus("done");
    } catch (err) {
      console.error("Approval failed:", err);
      setStatus("pending");
    }
  };

  if (status === "done") return null;

  return (
    <div className="my-2 rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => handleResponse(true)}
          disabled={status !== "pending"}
          className="gap-1.5"
        >
          {status === "approving" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleResponse(false)}
          disabled={status !== "pending"}
          className="gap-1.5"
        >
          {status === "denying" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <X className="size-3.5" />
          )}
          Deny
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `ChatMessage.tsx` to handle approval request parts**

In `src/components/ChatMessage.tsx`, add the import and update the parts rendering:

Add import:

```tsx
import { ToolApprovalCard } from "@/components/ToolApprovalCard";
```

The `ChatMessage` component currently receives a `message` prop but not `threadId`. We need to add `threadId` to the props. Update the interface:

```tsx
interface ChatMessageProps {
  message: UIMessage;
  userInitial?: string;
  isGrouped?: boolean;
  threadId: string;
}

export function ChatMessage({ message, userInitial = "U", isGrouped, threadId }: ChatMessageProps) {
```

Inside the parts rendering, add handling for approval request parts. Build a tool lookup from dynamic-tool parts, then check for approval requests. Add this inside the `message.parts.map` block, before the `return null;`:

```tsx
if (part.type === "tool-approval-request") {
  // Resolve tool info by correlating toolCallId with dynamic-tool parts
  const toolPart = message.parts.find(
    (p) => p.type === "dynamic-tool" && p.toolCallId === part.toolCallId,
  );
  return (
    <ToolApprovalCard
      key={part.approvalId}
      toolName={toolPart && "toolName" in toolPart ? (toolPart.toolName as string) : "unknown"}
      input={toolPart && "input" in toolPart ? toolPart.input : undefined}
      approvalId={part.approvalId}
      threadId={threadId}
    />
  );
}
```

- [ ] **Step 3: Update `MessageList.tsx` to pass `threadId` to `ChatMessage`**

In `src/components/MessageList.tsx`, add `threadId` to props and pass through:

```tsx
export function MessageList({
  messages,
  userInitial,
  threadId,
}: {
  messages: UIMessage[];
  userInitial?: string;
  threadId: string;
}) {
```

And update the `<ChatMessage>` render call:

```tsx
<ChatMessage
  message={message}
  userInitial={userInitial}
  isGrouped={isGrouped}
  threadId={threadId}
/>
```

- [ ] **Step 4: Update `ChatThread.tsx` to pass `threadId` to `MessageList`**

In `src/components/ChatThread.tsx`, pass `threadId` to `<MessageList>`:

```tsx
<MessageList messages={allMessages} userInitial={userInitial} threadId={threadId} />
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ToolApprovalCard.tsx src/components/ChatMessage.tsx src/components/MessageList.tsx src/components/ChatThread.tsx
git commit -m "feat: add tool approval UI with approve/deny buttons for destructive operations"
```

---

### Task 7: Optimistic Messages (Frontend)

**Files:**

- Modify: `src/components/ChatInput.tsx`
- Modify: `src/app/(app)/chat/page.tsx`

- [ ] **Step 1: Update `ChatInput.tsx` to accept `threadId` and use mutation with optimistic update**

Replace the entire `ChatInput` component:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { optimisticallySendMessage } from "@convex-dev/agent/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Loader2, SendHorizontal } from "lucide-react";

const MAX_TEXTAREA_HEIGHT = 160;

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
}

interface ChatInputProps {
  threadId: string;
  disabled?: boolean;
}

export function ChatInput({ threadId, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = useMutation(api.chat.sendMessageMutation).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listMessages),
  );

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    try {
      await sendMessage({ prompt: trimmed, threadId });
    } catch (err) {
      setInput(trimmed);
      console.error("Failed to send message:", err);
      const message = err instanceof Error ? err.message.toLowerCase() : "";
      if (message.includes("rate") || message.includes("limit")) {
        setError("Sending too fast. Please wait a moment.");
      } else {
        setError("Message failed to send. Please try again.");
      }
    } finally {
      setSending(false);
    }
  }, [input, sending, sendMessage, threadId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = disabled || sending;
  const hasInput = input.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {error && (
        <div
          role="alert"
          className="mb-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
        >
          {error}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition-colors duration-200 focus-within:border-primary/40 focus-within:shadow-md focus-within:shadow-primary/5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoGrow(e.target);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask your coach..."
          disabled={isDisabled}
          rows={1}
          aria-label="Message input"
          className="flex-1 resize-none rounded-xl bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ height: "auto", maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={isDisabled || !hasInput}
          aria-label={sending ? "Sending message" : "Send message"}
          className="mb-0.5 min-h-[44px] min-w-[44px] rounded-xl"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizontal className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update chat page to pass `threadId` to `ChatInput`**

In `src/app/(app)/chat/page.tsx`, the welcome screen renders `<ChatInput />` without threadId. For the welcome state, we need to handle the case where no thread exists yet. Two approaches:

**Option A (simpler):** In the welcome state, use the old `sendMessage` action (which creates threads). In the thread state, `ChatThread` already contains `ChatInput` — update it to pass `threadId`.

Update the welcome screen's `ChatInput` usage. Since the welcome screen doesn't have a threadId, keep using the action-based approach there by keeping the old `sendMessage` action as a fallback. But the `ChatInput` now requires `threadId`.

**Better approach:** In the welcome state, the suggestion buttons and input should use `useAction(api.chat.sendMessage)` directly (the old action), since we don't have a threadId yet. The `ChatInput` with optimistic updates is only used inside `ChatThread` where `threadId` is available.

So: keep the welcome screen's input as a simpler inline form (or create a `WelcomeChatInput` that uses the action), and have the `ChatThread`'s `ChatInput` use the new optimistic mutation.

Update `src/components/ChatThread.tsx` to pass `threadId` to `ChatInput`:

```tsx
<ChatInput threadId={threadId} disabled={isStreaming} />
```

For the welcome screen in `src/app/(app)/chat/page.tsx`, replace `<ChatInput />` with a version that uses the action. Since `ChatInput` now requires `threadId`, create a thread on first send:

```tsx
// In the welcome state section of ChatPageInner, replace:
<ChatInput />

// With a simple inline input that uses the old action:
<WelcomeInput sendMessage={sendMessage} />
```

Add a `WelcomeInput` component at the bottom of the page file (or inline it). This is a lightweight version that uses the action:

```tsx
function WelcomeInput({
  sendMessage,
}: {
  sendMessage: (args: { prompt: string }) => Promise<{ threadId: string }>;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setInput("");
    try {
      await sendMessage({ prompt: trimmed });
    } catch {
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask your coach..."
          disabled={sending}
          rows={1}
          className="flex-1 resize-none rounded-xl bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="mb-0.5 min-h-[44px] min-w-[44px] rounded-xl"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizontal className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
```

Update imports in `src/app/(app)/chat/page.tsx`:

```tsx
// Change this:
import { Suspense, useEffect, useRef } from "react";
// To:
import { Suspense, useEffect, useRef, useState } from "react";

// Add this import:
import { Button } from "@/components/ui/button";

// Add SendHorizontal to existing lucide-react import:
import {
  Activity,
  Dumbbell,
  Loader2,
  SendHorizontal,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

// Remove the ChatInput import (no longer used on this page):
// import { ChatInput } from "@/components/ChatInput";
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatInput.tsx src/components/ChatThread.tsx src/app/\(app\)/chat/page.tsx
git commit -m "feat: add optimistic message display with mutation-based send"
```

---

### Task 8: Smooth Text Streaming

**Files:**

- Modify: `src/components/ChatMessage.tsx`

- [ ] **Step 1: Add `useSmoothText` to assistant text rendering**

The `useSmoothText` hook must be called at the component level (React rules of hooks — can't call inside `.map()`). We need to extract the text part rendering into its own component.

Create a new component inside `ChatMessage.tsx` (not a separate file — it's tightly coupled):

```tsx
import { useSmoothText } from "@convex-dev/agent/react";

function SmoothAssistantText({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [smoothText] = useSmoothText(text, {
    charsPerSec: 60,
    startStreaming: isStreaming,
  });

  const displayText = isStreaming ? smoothText + "\u258D" : text;
  return <MarkdownContent content={displayText} />;
}
```

Then in the main `ChatMessage` component, replace the coach text rendering:

Old:

```tsx
// Coach: render with markdown
const displayText = isStreaming ? text + "\u258D" : text;
return <MarkdownContent key={i} content={displayText} />;
```

New:

```tsx
// Coach: render with smooth streaming
return <SmoothAssistantText key={i} text={text} isStreaming={isStreaming} />;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatMessage.tsx
git commit -m "feat: add smooth text streaming with typewriter effect"
```

---

### Task 9: Structured Week Plan Card

**Files:**

- Create: `convex/ai/schemas.ts`
- Create: `src/components/WeekPlanCard.tsx`
- Modify: `convex/ai/coach.ts` (instructions update)
- Modify: `src/components/ChatMessage.tsx`

- [ ] **Step 1: Create `convex/ai/schemas.ts`**

```ts
import { z } from "zod";

export const weekPlanPresentationSchema = z.object({
  weekStartDate: z.string(),
  split: z.enum(["ppl", "upper_lower", "full_body"]),
  days: z.array(
    z.object({
      dayName: z.string(),
      sessionType: z.string(),
      targetMuscles: z.string(),
      durationMinutes: z.number(),
      exercises: z.array(
        z.object({
          name: z.string(),
          sets: z.number(),
          reps: z.number(),
          targetWeight: z.number().optional(),
          lastWeight: z.number().optional(),
          lastReps: z.number().optional(),
          note: z.string().optional(),
        }),
      ),
    }),
  ),
  summary: z.string(),
});

export type WeekPlanPresentation = z.infer<typeof weekPlanPresentationSchema>;
```

- [ ] **Step 2: Create `src/components/WeekPlanCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { WeekPlanPresentation } from "../../convex/ai/schemas";

const SPLIT_LABELS: Record<string, string> = {
  ppl: "Push/Pull/Legs",
  upper_lower: "Upper/Lower",
  full_body: "Full Body",
};

interface WeekPlanCardProps {
  plan: WeekPlanPresentation;
}

export function WeekPlanCard({ plan }: WeekPlanCardProps) {
  const [activeDay, setActiveDay] = useState(0);
  const day = plan.days[activeDay];

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="border-b border-border bg-muted/30 px-4 py-2.5">
        <p className="text-sm font-semibold text-foreground">
          Week of {plan.weekStartDate} &middot; {SPLIT_LABELS[plan.split] ?? plan.split}
        </p>
      </div>

      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-1.5">
        {plan.days.map((d, i) => (
          <button
            key={i}
            onClick={() => setActiveDay(i)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              i === activeDay
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {d.dayName}
          </button>
        ))}
      </div>

      {/* Active day exercises */}
      {day && (
        <div className="p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {day.sessionType} &middot; {day.targetMuscles} &middot; {day.durationMinutes}min
          </p>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Exercise</th>
                <th className="pb-2 text-center font-medium">Sets x Reps</th>
                <th className="pb-2 text-right font-medium">Target</th>
                <th className="pb-2 text-right font-medium">Last</th>
              </tr>
            </thead>
            <tbody>
              {day.exercises.map((ex, j) => (
                <tr key={j} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-2">
                    <span className="font-medium text-foreground">{ex.name}</span>
                    {ex.note && (
                      <span
                        className={`ml-2 text-xs ${
                          ex.note.toLowerCase().includes("pr")
                            ? "text-green-600 dark:text-green-400"
                            : ex.note.toLowerCase().includes("plateau")
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {ex.note}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-center text-muted-foreground">
                    {ex.sets}x{ex.reps}
                  </td>
                  <td className="py-2 text-right font-medium text-foreground">
                    {ex.targetWeight ? `${ex.targetWeight} lbs` : "—"}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    {ex.lastWeight ? `${ex.lastWeight} lbs` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      <div className="border-t border-border bg-muted/20 px-4 py-2.5">
        <p className="text-xs leading-relaxed text-muted-foreground">{plan.summary}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add structured output instruction to coach**

In `convex/ai/coach.ts`, add to the `instructions` string after the MEMORY section:

```
WEEKLY PLAN PRESENTATION:
- After calling program_week, present the results as a JSON code block with the tag \`\`\`week-plan followed by a JSON object.
- The JSON object must have these fields: weekStartDate, split, days (array of {dayName, sessionType, targetMuscles, durationMinutes, exercises}), summary.
- Each exercise has: name, sets, reps, targetWeight (optional), lastWeight (optional), lastReps (optional), note (optional).
- After the JSON block, add a brief conversational message asking if the plan looks good.
- Example format:
  \`\`\`week-plan
  {"weekStartDate":"2026-03-16","split":"ppl","days":[...],"summary":"..."}
  \`\`\`
  How does this look? Want me to swap any exercises or adjust the days?
```

- [ ] **Step 4: Update `ChatMessage.tsx` to detect and render week plan cards**

In `src/components/ChatMessage.tsx`, add import:

```tsx
import { WeekPlanCard } from "@/components/WeekPlanCard";
import { weekPlanPresentationSchema } from "../../convex/ai/schemas";
```

Add a helper function to parse week plan JSON from text:

````tsx
function extractWeekPlan(text: string) {
  const match = text.match(/```week-plan\s*\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return weekPlanPresentationSchema.parse(parsed);
  } catch {
    return null;
  }
}
````

In the text part rendering for coach messages, check for week plan data:

````tsx
// Coach: check for structured week plan
const plan = extractWeekPlan(text);
if (plan && !isStreaming) {
  const remainingText = text.replace(/```week-plan\s*\n[\s\S]*?\n```/, "").trim();
  return (
    <div key={i}>
      <WeekPlanCard plan={plan} />
      {remainingText && <MarkdownContent content={remainingText} />}
    </div>
  );
}

// Coach: render with smooth streaming
return <SmoothAssistantText key={i} text={text} isStreaming={isStreaming} />;
````

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add convex/ai/schemas.ts src/components/WeekPlanCard.tsx convex/ai/coach.ts src/components/ChatMessage.tsx
git commit -m "feat: add structured week plan cards with rich exercise table rendering"
```

---

## Chunk 3: Cleanup and Verification

### Task 10: Cleanup, Approval Response Badges, and Verification

**Files:**

- Modify: `convex/chat.ts` (add deprecation comment)
- Modify: `src/components/ChatMessage.tsx` (approval response badges)

- [ ] **Step 1: Add deprecation comment to old `sendMessage` action**

The old `sendMessage` action in `convex/chat.ts` is retained for the welcome flow where no `threadId` exists (suggestion buttons, `?prompt=` auto-send). Add a JSDoc comment:

```ts
/** @deprecated Use sendMessageMutation for in-thread messages. Retained for welcome flow (no threadId). */
export const sendMessage = action({
```

- [ ] **Step 2: Add approval response badge rendering in `ChatMessage.tsx`**

After the `tool-approval-request` handling in `ChatMessage.tsx`, add handling for `tool-approval-response` parts:

```tsx
if (part.type === "tool-approval-response") {
  const approved = "approved" in part && part.approved;
  return (
    <span
      key={`approval-response-${i}`}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ${
        approved
          ? "bg-green-500/10 text-green-600 dark:text-green-400"
          : "bg-destructive/10 text-destructive"
      }`}
    >
      {approved ? "\u2713 Approved" : "\u2717 Denied"}
    </span>
  );
}
```

- [ ] **Step 3: Final type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All existing tests pass. No new tests break.

- [ ] **Step 4: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore: cleanup after agent SDK enhancements"
```

---

## Summary

| Task | Feature                        | Files   | Estimated Steps |
| ---- | ------------------------------ | ------- | --------------- |
| 1    | Usage Tracking                 | 3 files | 5               |
| 2    | Cross-Thread Memory            | 1 file  | 5               |
| 3    | Tool Approval Gates (Backend)  | 3 files | 5               |
| 4    | Optimistic Messages (Backend)  | 1 file  | 3               |
| 5    | Playground API                 | 1 file  | 3               |
| 6    | Tool Approval UI (Frontend)    | 4 files | 6               |
| 7    | Optimistic Messages (Frontend) | 3 files | 4               |
| 8    | Smooth Text                    | 1 file  | 3               |
| 9    | Structured Output              | 4 files | 6               |
| 10   | Cleanup & Verification         | 2 files | 4               |
