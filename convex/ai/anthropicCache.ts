import type { Tool, ToolSet } from "ai";

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
