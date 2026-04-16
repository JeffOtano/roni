"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "./JsonViewer";

interface ToolCall {
  toolName: string;
  toolCallId: string;
  args: unknown;
}

interface ToolResult {
  toolName: string;
  toolCallId: string;
  result: unknown;
  isError: boolean;
}

interface MessagePart {
  type: string;
  text?: string;
  toolName?: string;
  toolCallId?: string;
  args?: unknown;
  input?: unknown;
  result?: unknown;
  isError?: boolean;
  output?: unknown;
}

interface MessageDoc {
  _id: string;
  _creationTime: number;
  message?: {
    role: string;
    content: string | MessagePart[];
  };
  text?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    cachedInputTokens?: number;
    totalTokens: number;
  };
  finishReason?: string;
  model?: string;
  provider?: string;
  tool: boolean;
}

function extractToolCalls(content: MessagePart[]): {
  calls: ToolCall[];
  results: ToolResult[];
} {
  const calls: ToolCall[] = [];
  const results: ToolResult[] = [];

  for (const part of content) {
    if (part.type === "tool-call") {
      calls.push({
        toolName: part.toolName ?? "unknown",
        toolCallId: part.toolCallId ?? "",
        args: part.args ?? part.input,
      });
    }
    if (part.type === "tool-result") {
      results.push({
        toolName: part.toolName ?? "unknown",
        toolCallId: part.toolCallId ?? "",
        result: part.result ?? part.output,
        isError: part.isError ?? false,
      });
    }
  }

  return { calls, results };
}

function MessageRow({ msg }: { msg: MessageDoc }) {
  const [expanded, setExpanded] = useState(false);
  const role = msg.message?.role ?? "unknown";
  const content = msg.message?.content;
  const isAssistant = role === "assistant";
  const isTool = role === "tool" || msg.tool;

  const hasToolData =
    Array.isArray(content) &&
    content.some((p: MessagePart) => p.type === "tool-call" || p.type === "tool-result");

  const { calls, results } = Array.isArray(content)
    ? extractToolCalls(content as MessagePart[])
    : { calls: [], results: [] };

  const textContent =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? (content as MessagePart[])
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("")
        : (msg.text ?? "");

  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Badge
          variant={isAssistant ? "default" : isTool ? "secondary" : "outline"}
          className="text-xs"
        >
          {role}
        </Badge>

        {hasToolData && (
          <Badge variant="outline" className="text-xs">
            {calls.length} tool call{calls.length !== 1 ? "s" : ""}
          </Badge>
        )}

        <span className="flex-1 truncate text-xs text-muted-foreground">
          {textContent.slice(0, 100) ||
            (hasToolData ? `[${calls.map((c) => c.toolName).join(", ")}]` : "[no text]")}
        </span>

        <span className="text-xs text-muted-foreground">
          {new Date(msg._creationTime).toLocaleTimeString()}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-border p-3">
          {msg.usage && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>Prompt: {msg.usage.promptTokens}</span>
              <span>Completion: {msg.usage.completionTokens}</span>
              {msg.usage.cachedInputTokens != null && (
                <span>Cached: {msg.usage.cachedInputTokens}</span>
              )}
              <span>Total: {msg.usage.totalTokens}</span>
            </div>
          )}

          {msg.finishReason && (
            <div className="text-xs text-muted-foreground">
              Finish: {msg.finishReason}
              {msg.model && ` | Model: ${msg.model}`}
              {msg.provider && ` | Provider: ${msg.provider}`}
            </div>
          )}

          {calls.map((call) => {
            const matchingResult = results.find((r) => r.toolCallId === call.toolCallId);
            return (
              <div key={call.toolCallId} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {call.toolName}
                  </Badge>
                  {matchingResult?.isError && (
                    <Badge variant="destructive" className="text-xs">
                      error
                    </Badge>
                  )}
                </div>
                <JsonViewer data={call.args} label="Args" />
                {matchingResult && <JsonViewer data={matchingResult.result} label="Result" />}
              </div>
            );
          })}

          {isTool && results.length > 0 && calls.length === 0 && (
            <>
              {results.map((r) => (
                <div key={r.toolCallId} className="space-y-1">
                  <Badge variant="outline" className="font-mono text-xs">
                    {r.toolName}
                  </Badge>
                  <JsonViewer data={r.result} label="Result" />
                </div>
              ))}
            </>
          )}

          {textContent && <div className="whitespace-pre-wrap text-xs">{textContent}</div>}
        </div>
      )}
    </div>
  );
}

export function AgentToolTrace() {
  const threads = useQuery(api.devTools.listUserThreads, {});
  const [selectedThread, setSelectedThread] = useState<string | null>(null);

  const messages = useQuery(
    api.devTools.listThreadMessages,
    selectedThread ? { threadId: selectedThread } : "skip",
  );

  if (threads === undefined) {
    return <div className="py-4 text-sm text-muted-foreground">Loading threads...</div>;
  }

  return (
    <div className="space-y-3">
      <div>
        <select
          value={selectedThread ?? ""}
          onChange={(e) => setSelectedThread(e.target.value || null)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select a thread...</option>
          {threads.map((t) => (
            <option key={t.threadId} value={t.threadId}>
              Thread {t.threadId.slice(-8)} - {new Date(t.createdAt).toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {selectedThread && messages === undefined && (
        <div className="py-4 text-sm text-muted-foreground">Loading messages...</div>
      )}

      {messages && messages.length === 0 && (
        <div className="py-4 text-sm text-muted-foreground">No messages in this thread</div>
      )}

      {messages && (
        <div className="space-y-1">
          {(messages as unknown as MessageDoc[]).map((msg) => (
            <MessageRow key={msg._id} msg={msg} />
          ))}
        </div>
      )}
    </div>
  );
}
