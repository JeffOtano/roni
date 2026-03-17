export type Intent = "programming" | "data" | "coaching" | "general";

const PROGRAMMING_KEYWORDS = [
  "program",
  "plan",
  "schedule",
  "workout",
  "session",
  "swap",
  "move",
  "adjust",
  "replace",
  "switch",
  "push day",
  "pull day",
  "leg day",
  "upper",
  "lower",
  "full body",
  "approve",
  "send it",
  "push it",
  "looks good",
  "create workout",
  "delete workout",
  "exercise",
];

const DATA_KEYWORDS = [
  "strength score",
  "muscle readiness",
  "workout history",
  "history",
  "progress",
  "stats",
  "numbers",
  "data",
  "performance",
  "what did i do",
  "show me",
  "how much",
  "volume",
  "frequency",
  "training frequency",
  "last week",
  "last session",
  "pr",
  "personal record",
  "plateau",
];

const COACHING_KEYWORDS = [
  "hurt",
  "pain",
  "injury",
  "sore",
  "shoulder",
  "knee",
  "back",
  "rpe",
  "rate",
  "feedback",
  "felt",
  "feeling",
  "goal",
  "target",
  "deadline",
  "deload",
  "recovery",
  "rest",
  "break",
  "vacation",
  "tired",
  "fatigued",
  "exhausted",
  "overtraining",
];

function matchesKeyword(text: string, keyword: string): boolean {
  // Multi-word phrases use substring matching (low false-positive risk)
  if (keyword.includes(" ")) return text.includes(keyword);
  // Single words use word-boundary matching to avoid "pr" matching "program"
  const pattern = new RegExp(`\\b${keyword}\\b`);
  return pattern.test(text);
}

function scoreIntent(text: string, keywords: readonly string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((score, kw) => score + (matchesKeyword(lower, kw) ? 1 : 0), 0);
}

export function classifyIntent(message: string): Intent {
  const scores: Record<Intent, number> = {
    programming: scoreIntent(message, PROGRAMMING_KEYWORDS),
    data: scoreIntent(message, DATA_KEYWORDS),
    coaching: scoreIntent(message, COACHING_KEYWORDS),
    general: 0,
  };

  const maxScore = Math.max(scores.programming, scores.data, scores.coaching);
  if (maxScore === 0) return "general";

  // Data wins ties with programming to avoid misrouting data queries
  if (scores.data >= scores.programming && scores.data >= scores.coaching) return "data";
  if (scores.programming >= scores.coaching) return "programming";
  return "coaching";
}
