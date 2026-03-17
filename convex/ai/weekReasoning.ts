/**
 * Two-pass week programming: reasoning pass (natural language) before structuring.
 * Research: LLMs produce better structured output when reasoning freely first.
 *
 * Pure functions only — no database access, no side effects.
 */

const SPLIT_NAMES: Record<string, string> = {
  ppl: "Push/Pull/Legs",
  upper_lower: "Upper/Lower",
  full_body: "Full Body",
};

export interface ReasoningContext {
  split: string;
  targetDays: number;
  sessionDuration: number;
  muscleReadiness: Record<string, number>;
  recentWorkouts: string[];
  activeInjuries: string[];
  recentFeedback: { avgRpe: number; avgRating: number } | null;
  isDeload: boolean;
}

export interface DayReasoning {
  dayLabel: string;
  reasoning: string;
}

export function buildReasoningPrompt(ctx: ReasoningContext): string {
  const splitName = SPLIT_NAMES[ctx.split] ?? ctx.split;
  const lines: string[] = [
    `Plan a ${splitName} training week: ${ctx.targetDays} training days, ${ctx.sessionDuration} minutes per session.`,
    "",
  ];

  if (ctx.isDeload) {
    lines.push("DELOAD WEEK: Reduce volume (2 sets instead of 3) and intensity (RPE 5-6).");
    lines.push("");
  }

  if (Object.keys(ctx.muscleReadiness).length > 0) {
    lines.push("Muscle readiness (0-100):");
    for (const [muscle, score] of Object.entries(ctx.muscleReadiness)) {
      const status = score < 50 ? "fatigued" : score < 70 ? "moderate" : "ready";
      lines.push(`  ${muscle}: ${score} (${status})`);
    }
    lines.push("");
  }

  if (ctx.recentWorkouts.length > 0) {
    lines.push("Recent sessions (for rotation — avoid repeating same exercises):");
    for (const w of ctx.recentWorkouts) {
      lines.push(`  - ${w}`);
    }
    lines.push("");
  }

  if (ctx.activeInjuries.length > 0) {
    lines.push("Active injuries/restrictions:");
    for (const inj of ctx.activeInjuries) {
      lines.push(`  - ${inj}`);
    }
    lines.push("");
  }

  if (ctx.recentFeedback) {
    lines.push(
      `Recent feedback: RPE ${ctx.recentFeedback.avgRpe.toFixed(1)}, Rating ${ctx.recentFeedback.avgRating.toFixed(1)}/5`,
    );
    if (ctx.recentFeedback.avgRpe >= 8) {
      lines.push("  -> High RPE — consider reducing volume or intensity.");
    }
    lines.push("");
  }

  lines.push("For EACH training day, explain:");
  lines.push("1. Which muscles to prioritize and why (based on readiness and rotation)");
  lines.push("2. What compound movements to lead with");
  lines.push("3. What isolation work to include");
  lines.push("4. Any volume/intensity adjustments based on fatigue or feedback");
  lines.push("5. Injury-related exercise modifications");
  lines.push("");
  lines.push("Format each day as: ## Day N: SessionType (Target Muscles)");

  return lines.join("\n");
}

const DAY_HEADER_REGEX = /^## Day \d+:\s*(\S+)/;

export function parseReasoningOutput(text: string): DayReasoning[] {
  const lines = text.split("\n");
  const days: DayReasoning[] = [];
  let currentLabel: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(DAY_HEADER_REGEX);
    if (match) {
      if (currentLabel) {
        days.push({
          dayLabel: currentLabel,
          reasoning: currentLines.join("\n").trim(),
        });
      }
      currentLabel = match[1];
      currentLines = [];
    } else if (currentLabel) {
      currentLines.push(line);
    }
  }

  if (currentLabel) {
    days.push({
      dayLabel: currentLabel,
      reasoning: currentLines.join("\n").trim(),
    });
  }

  return days;
}
