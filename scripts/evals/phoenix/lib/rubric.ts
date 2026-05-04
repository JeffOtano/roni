import type { Rubric } from "../../../../convex/ai/evalScenarios";
import { BANNED_PHRASES, DEFAULT_MAX_RESPONSE_CHARS } from "./thresholds";

const REASONING_BLOCK_PATTERN =
  /\*\*(?:Thinking Process|Tool Calls|Reasoning):\*\*[\s\S]*?(?=\n{2,}|```|\*\*(?:Answer|Final Answer):\*\*|(?:^|\n)(?:Answer|Final Answer):)/gi;

export function normalizeEvalText(raw: string, toolNames: string): string {
  const response = raw.replace(REASONING_BLOCK_PATTERN, "").trim();
  return [response, toolNames.trim()].filter(Boolean).join("\n");
}

export function checkRubric(text: string, rubric: Rubric): string[] {
  const notes: string[] = [];
  const lower = text.toLowerCase();
  for (const term of rubric.mustContain ?? []) {
    if (!lower.includes(term.toLowerCase())) notes.push(`missing term: "${term}"`);
  }
  for (const term of rubric.mustNotContain ?? []) {
    if (lower.includes(term.toLowerCase())) notes.push(`forbidden term present: "${term}"`);
  }
  for (const pattern of rubric.patterns ?? []) {
    if (!pattern.test(text)) notes.push(`pattern missing: ${pattern}`);
  }
  const maxLen = rubric.maxLength ?? DEFAULT_MAX_RESPONSE_CHARS;
  if (text.length > maxLen) notes.push(`response too long: ${text.length} > ${maxLen}`);
  return notes;
}

export function checkBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((phrase) => lower.includes(phrase)).map(
    (phrase) => `banned phrase present: "${phrase}"`,
  );
}
