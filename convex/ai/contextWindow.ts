/**
 * Message processing pipeline for the coach agent's context handler.
 * Cleans, merges, and windows conversation history before sending to the LLM.
 */

import type { ModelMessage, UserContent } from "ai";

// ---------------------------------------------------------------------------
// Merge consecutive same-role messages
// ---------------------------------------------------------------------------

export function mergeConsecutiveSameRole(messages: ModelMessage[]): ModelMessage[] {
  if (messages.length <= 1) return messages;

  const result: ModelMessage[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prev = result[result.length - 1];
    const curr = messages[i];

    // Never merge system messages; the provider extracts them separately.
    if (prev.role !== curr.role || prev.role === "system") {
      result.push(curr);
      continue;
    }

    const toParts = (c: ModelMessage["content"]): Array<Record<string, unknown>> =>
      typeof c === "string" ? [{ type: "text", text: c }] : (c as Array<Record<string, unknown>>);

    const merged = [...toParts(prev.content), ...toParts(curr.content)];
    result[result.length - 1] = { ...prev, content: merged } as ModelMessage;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Strip orphaned tool calls
// ---------------------------------------------------------------------------

export function stripOrphanedToolCalls(messages: ModelMessage[]): ModelMessage[] {
  const approvalIdToToolCallId = new Map<string, string>();
  const toolCallIdsWithApprovalRequests = new Set<string>();
  const resolvedToolCallIds = new Set<string>();
  for (const msg of messages) {
    if (typeof msg.content === "string" || !Array.isArray(msg.content)) continue;
    for (const part of msg.content as Array<{
      type: string;
      approvalId?: string;
      toolCallId?: string;
    }>) {
      if (part.type === "tool-approval-request" && part.approvalId && part.toolCallId) {
        approvalIdToToolCallId.set(part.approvalId, part.toolCallId);
        toolCallIdsWithApprovalRequests.add(part.toolCallId);
      }
      if (part.type === "tool-result" && part.toolCallId) {
        resolvedToolCallIds.add(part.toolCallId);
      }
    }
  }

  for (const msg of messages) {
    if (typeof msg.content === "string" || !Array.isArray(msg.content)) continue;
    for (const part of msg.content as Array<{ type: string; approvalId?: string }>) {
      if (part.type === "tool-approval-response" && part.approvalId) {
        const toolCallId = approvalIdToToolCallId.get(part.approvalId);
        if (toolCallId) {
          resolvedToolCallIds.add(toolCallId);
        }
      }
    }
  }

  // Build the set of tool-call ids that survive the assistant-message filter
  // below. Any `tool` role message whose tool-result references a non-kept
  // call is orphaned (typically from a partially-persisted failed stream)
  // and must be dropped — Gemini rejects history where a tool turn doesn't
  // immediately follow its originating user/function-response turn.
  const keptAssistantToolCallIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    if (typeof msg.content === "string" || !Array.isArray(msg.content)) continue;
    for (const part of msg.content as Array<{ type: string; toolCallId?: string }>) {
      if (part.type !== "tool-call" || !part.toolCallId) continue;
      if (
        resolvedToolCallIds.has(part.toolCallId) ||
        toolCallIdsWithApprovalRequests.has(part.toolCallId)
      ) {
        keptAssistantToolCallIds.add(part.toolCallId);
      }
    }
  }

  return messages
    .map((msg) => {
      if (msg.role === "assistant") {
        if (typeof msg.content === "string" || !Array.isArray(msg.content)) return msg;

        const parts = msg.content as Array<{ type: string; toolCallId?: string }>;
        const hasToolCalls = parts.some((p) => p.type === "tool-call");
        if (!hasToolCalls) return msg;

        const filtered = parts.filter(
          (p) =>
            p.type !== "tool-call" ||
            (p.toolCallId &&
              (resolvedToolCallIds.has(p.toolCallId) ||
                toolCallIdsWithApprovalRequests.has(p.toolCallId))),
        );

        if (filtered.length === 0) return null;
        return { ...msg, content: filtered } as ModelMessage;
      }

      if (msg.role === "tool") {
        if (typeof msg.content === "string" || !Array.isArray(msg.content)) return msg;

        const parts = msg.content as Array<{ type: string; toolCallId?: string }>;
        // tool-approval-response parts are keyed by approvalId, not toolCallId,
        // so preserve them regardless of the kept-call set.
        const filtered = parts.filter(
          (p) =>
            p.type === "tool-approval-response" ||
            (p.toolCallId !== undefined && keptAssistantToolCallIds.has(p.toolCallId)),
        );

        if (filtered.length === 0) return null;
        return { ...msg, content: filtered } as ModelMessage;
      }

      return msg;
    })
    .filter((msg): msg is ModelMessage => msg !== null);
}

// ---------------------------------------------------------------------------
// Strip images from older messages
// ---------------------------------------------------------------------------

/**
 * Remove image parts from all messages except the most recent user message.
 * Images stored in older messages cause unbounded memory growth when loaded
 * via recentMessages, leading to 64 MB OOM on Convex actions.
 */
export function stripImagesFromOlderMessages(messages: ModelMessage[]): ModelMessage[] {
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  return messages.map((msg, idx) => {
    if (idx === lastUserIdx) return msg;
    if (msg.role !== "user") return msg;
    if (typeof msg.content === "string") return msg;
    if (!Array.isArray(msg.content)) return msg;

    const filtered = (msg.content as Array<{ type: string }>).filter(
      (part) => part.type !== "image",
    );
    if (filtered.length === 0) {
      return { ...msg, content: "[image message]" };
    }
    return { ...msg, content: filtered as UserContent };
  });
}

// ---------------------------------------------------------------------------
// Turn-aware context windowing
// ---------------------------------------------------------------------------

/** ~4 chars per token is a conservative estimate for mixed English + JSON. */
function estimateTokens(content: ModelMessage["content"]): number {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return Math.ceil(text.length / 4);
}

/**
 * Select the most recent complete conversation turns that fit within a
 * token budget. A "turn" starts at a user message and includes every
 * following message until the next user message. This guarantees:
 *
 * 1. Context always starts with a user message (Gemini requirement)
 * 2. Tool-call / tool-result chains are never broken
 * 3. Older context is dropped cleanly at turn boundaries
 *
 * Semantic search (searchOtherThreads) already recovers relevant older
 * context, so dropping full turns is safe.
 */
const CONTEXT_TOKEN_BUDGET = 30_000;

export function buildContextWindow(
  messages: ModelMessage[],
  tokenBudget: number = CONTEXT_TOKEN_BUDGET,
): ModelMessage[] {
  if (messages.length === 0) return [];

  // Find every user-message index (turn boundaries)
  const userIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "user") userIndices.push(i);
  }

  if (userIndices.length === 0) return [];

  // Always include from the last user message to the end
  let startIdx = userIndices[userIndices.length - 1];
  let tokenCount = 0;
  for (let i = startIdx; i < messages.length; i++) {
    tokenCount += estimateTokens(messages[i].content);
  }

  // Walk backward through earlier turns, adding if budget allows
  for (let u = userIndices.length - 2; u >= 0; u--) {
    const turnStart = userIndices[u];
    const turnEnd = userIndices[u + 1];
    let turnTokens = 0;
    for (let i = turnStart; i < turnEnd; i++) {
      turnTokens += estimateTokens(messages[i].content);
    }
    if (tokenCount + turnTokens > tokenBudget) break;
    tokenCount += turnTokens;
    startIdx = turnStart;
  }

  return messages.slice(startIdx);
}
