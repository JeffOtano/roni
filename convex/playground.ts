import { definePlaygroundAPI } from "@convex-dev/agent";
import { components } from "./_generated/api";
import { coachAgent } from "./ai/coach";

export const {
  isApiKeyValid,
  listUsers,
  listThreads,
  listMessages,
  listAgents,
  createThread,
  generateText,
  fetchPromptContext,
} = definePlaygroundAPI(components.agent, {
  agents: [coachAgent],
});
