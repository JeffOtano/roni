import type { ModelMessage, Tool, ToolSet } from "ai";

// Anthropic caches every block up to and including a marked one. Marking the
// last tool lets tool-defs cache independently of STATIC_INSTRUCTIONS, so a
// prompt-version bump doesn't invalidate the tool cache. Gemini/OpenAI ignore
// Anthropic-namespaced provider options, so this is a no-op for them.
export function withAnthropicToolCache<T extends ToolSet>(tools: T): T {
  const keys = Object.keys(tools);
  if (keys.length === 0) return tools;
  const lastKey = keys[keys.length - 1];
  const lastTool = tools[lastKey] as Tool;
  const annotated: Tool = {
    ...lastTool,
    providerOptions: {
      ...lastTool.providerOptions,
      anthropic: {
        ...lastTool.providerOptions?.anthropic,
        cacheControl: { type: "ephemeral" },
      },
    },
  };
  return { ...tools, [lastKey]: annotated };
}

// Marks the last assistant turn in a message list with cacheControl so
// Anthropic can cache through it. Only meaningful when everything between the
// cached prefix and this marker is byte-stable across calls -- i.e. when no
// dynamic content (like the training snapshot) sits in that window.
export function withAnthropicHistoryCache(messages: ModelMessage[]): ModelMessage[] {
  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistantIdx = i;
      break;
    }
  }
  if (lastAssistantIdx === -1) return messages;
  return messages.map((m, i) => {
    if (i !== lastAssistantIdx) return m;
    return {
      ...m,
      providerOptions: {
        ...m.providerOptions,
        anthropic: {
          ...m.providerOptions?.anthropic,
          cacheControl: { type: "ephemeral" },
        },
      },
    };
  });
}
