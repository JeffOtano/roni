# AI Coaching Improvements — Phased Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve AI coaching quality through six sequenced enhancements: conversation flow control, time-aware context, biometric check-ins, two-pass workout generation, procedural memory, and intent routing.

**Architecture:** Each phase is independently deployable and builds on existing `@convex-dev/agent` infrastructure. Phases 1-3 modify existing files with minimal risk. Phases 4-6 introduce new patterns. All changes maintain backward compatibility — no breaking changes to the chat interface.

**Tech Stack:** Convex, @convex-dev/agent v0.6.0-alpha.1, @ai-sdk/google (Gemini 2.5 Pro/Flash), Vitest, Zod

---

## File Map

| Phase | Action | File                              | Responsibility                                  |
| ----- | ------ | --------------------------------- | ----------------------------------------------- |
| 1     | Modify | `convex/ai/coach.ts`              | Add multi-turn conversation pacing instructions |
| 2     | Modify | `convex/ai/context.ts`            | Add time-decay weighting and recency labels     |
| 2     | Modify | `convex/ai/context.test.ts`       | Test time-decay logic                           |
| 3     | Modify | `convex/checkIns/content.ts`      | Add new trigger types and messages              |
| 3     | Modify | `convex/checkIns/content.test.ts` | Test new trigger messages                       |
| 3     | Modify | `convex/checkIns/triggers.ts`     | Add recovery load and streak evaluation         |
| 3     | Modify | `convex/schema.ts`                | Add new trigger literals to checkIns table      |
| 4     | Create | `convex/ai/weekReasoning.ts`      | Two-pass reasoning + structuring for week plans |
| 4     | Create | `convex/ai/weekReasoning.test.ts` | Test reasoning prompt construction and parsing  |
| 4     | Modify | `convex/ai/weekTools.ts`          | Wire two-pass into programWeekTool              |
| 5     | Modify | `convex/schema.ts`                | Add coachingNotes table                         |
| 5     | Create | `convex/ai/memory.ts`             | Procedural memory: save, query, extract         |
| 5     | Create | `convex/ai/memory.test.ts`        | Test note extraction and relevance scoring      |
| 5     | Modify | `convex/ai/coach.ts`              | Inject coaching notes into context              |
| 6     | Create | `convex/ai/router.ts`             | Intent classification and agent dispatch        |
| 6     | Create | `convex/ai/router.test.ts`        | Test intent classification accuracy             |
| 6     | Create | `convex/ai/agents/programming.ts` | Programming specialist agent config             |
| 6     | Create | `convex/ai/agents/recovery.ts`    | Recovery/data specialist agent config           |
| 6     | Create | `convex/ai/agents/coaching.ts`    | Coaching specialist agent config                |
| 6     | Modify | `convex/ai/resilience.ts`         | Support routed agent selection                  |
| 6     | Modify | `convex/chat.ts`                  | Wire router into message flow                   |

---

## Phase 1: Conversation Flow Control

**Why:** LLMs treat each message as potentially the last, causing premature conversation endings. Multi-step workflows (onboarding, week programming, injury assessment) need explicit pacing. Research from Bod.Coach confirms this pattern.

**Risk:** Low. System prompt text changes only. No schema or function signature changes.

### Task 1.1: Add Conversation Pacing Instructions

**Files:**

- Modify: `convex/ai/coach.ts:63-229` (instructions string)

- [ ] **Step 1: Read the current system prompt**

Read `convex/ai/coach.ts` lines 63-229 to understand the full instructions.

- [ ] **Step 2: Add pacing section to the system prompt**

Add the following section after the ACTIVATION FLOW section (line 205) and before the MEMORY section (line 207):

```typescript
CONVERSATION PACING:
- When starting a multi-step workflow (onboarding, week programming, injury assessment, goal setting), count the information you still need before you can act.
- Ask ONE question at a time. Never combine questions like "What's your split preference and how many days?"
- After each user response, acknowledge what you learned, then state what's left: "Got it — PPL split. I still need your training days and session length."
- If the user gives partial info, use what they gave and ask for the rest. Don't re-ask what they already answered.
- Never end a programming conversation without either: (a) presenting a plan for approval, or (b) explicitly confirming the user wants to stop.
- If the user's message is ambiguous between a question and a request, treat it as a request. "What about legs?" means "program legs", not "tell me about leg exercises."
- When the user says "sounds good" or similar after seeing a plan, that's approval — call approve_week_plan immediately. Don't ask "are you sure?"
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (text-only change in template literal)

- [ ] **Step 4: Run existing tests**

Run: `npm test`
Expected: All existing tests pass (no behavioral changes)

- [ ] **Step 5: Commit**

```bash
git add convex/ai/coach.ts
git commit -m "feat: add conversation pacing instructions to AI coach"
```

---

## Phase 2: Time-Decay Context

**Why:** A workout from yesterday is far more relevant than one from 3 weeks ago, but `buildTrainingSnapshot` currently treats them equally. Anthropic's context engineering guidance says to maximize signal per token. Time-decay labeling helps the AI prioritize recent data without consuming extra token budget.

**Risk:** Low. Modifies pure functions in `context.ts`. Existing tests + new tests cover changes.

### Task 2.1: Add Time-Decay Helpers

**Files:**

- Modify: `convex/ai/context.ts` (add helper functions before `buildTrainingSnapshot`)
- Test: `convex/ai/context.test.ts`

- [ ] **Step 1: Write the failing tests for recency labeling**

Add to `convex/ai/context.test.ts`:

```typescript
import { getRecencyLabel } from "./context";

describe("getRecencyLabel", () => {
  it("returns 'today' for same-day timestamps", () => {
    const now = new Date("2026-03-16T15:00:00Z");
    expect(getRecencyLabel("2026-03-16T08:00:00Z", now)).toBe("today");
  });

  it("returns 'yesterday' for previous day", () => {
    const now = new Date("2026-03-16T15:00:00Z");
    expect(getRecencyLabel("2026-03-15T20:00:00Z", now)).toBe("yesterday");
  });

  it("returns 'this week' for 3 days ago", () => {
    const now = new Date("2026-03-16T15:00:00Z");
    expect(getRecencyLabel("2026-03-13T10:00:00Z", now)).toBe("this week");
  });

  it("returns 'last week' for 10 days ago", () => {
    const now = new Date("2026-03-16T15:00:00Z");
    expect(getRecencyLabel("2026-03-06T10:00:00Z", now)).toBe("last week");
  });

  it("returns 'older' for 20+ days ago", () => {
    const now = new Date("2026-03-16T15:00:00Z");
    expect(getRecencyLabel("2026-02-20T10:00:00Z", now)).toBe("older");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run convex/ai/context.test.ts`
Expected: FAIL — `getRecencyLabel` is not exported

- [ ] **Step 3: Implement recency label function**

Add to `convex/ai/context.ts` after the external activity helpers (after line 75):

```typescript
export function getRecencyLabel(
  isoTimestamp: string,
  now: Date = new Date(),
): "today" | "yesterday" | "this week" | "last week" | "older" {
  const ts = new Date(isoTimestamp);
  const diffMs = now.getTime() - ts.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1 && ts.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) {
    return "today";
  }
  if (diffDays < 2) return "yesterday";
  if (diffDays < 7) return "this week";
  if (diffDays < 14) return "last week";
  return "older";
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run convex/ai/context.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/ai/context.ts convex/ai/context.test.ts
git commit -m "feat: add recency labeling for time-decay context"
```

### Task 2.2: Apply Time-Decay to Workout History in Snapshot

**Files:**

- Modify: `convex/ai/context.ts:280-290` (Priority 9: Recent workouts section)

- [ ] **Step 1: Modify workout history formatting to include recency labels**

Replace the Priority 9 section (lines 280-290) in `buildTrainingSnapshot`:

```typescript
// Priority 9: Recent workouts (time-decay: recent = more detail)
if ((activities as Activity[]).length > 0) {
  const now = new Date();
  const workoutLines: string[] = [`Recent Workouts:`];
  for (const a of activities as Activity[]) {
    const wp = a.workoutPreview;
    const recency = getRecencyLabel(a.activityTime, now);
    const date = a.activityTime.split("T")[0];

    if (recency === "today" || recency === "yesterday") {
      // Full detail for very recent workouts
      workoutLines.push(
        `  [${recency.toUpperCase()}] ${date} | ${wp.workoutTitle} | ${wp.targetArea} | ${wp.totalVolume}lbs vol | ${Math.round(wp.totalDuration / 60)}min`,
      );
    } else if (recency === "this week") {
      workoutLines.push(
        `  ${date} | ${wp.workoutTitle} | ${wp.targetArea} | ${wp.totalVolume}lbs vol`,
      );
    } else {
      // Older workouts: compact
      workoutLines.push(`  ${date} | ${wp.workoutTitle} | ${wp.targetArea}`);
    }
  }
  sections.push({ priority: 9, lines: workoutLines });
}
```

- [ ] **Step 2: Apply time-decay to external activities**

Replace the Priority 10 section (lines 292-308):

```typescript
// Priority 10: External activities (time-decay: highlight recent high-intensity)
const extActivities = externalActivities as ExternalActivity[];
if (extActivities.length > 0) {
  const now = new Date();
  const extLines: string[] = [`External Activities (non-Tonal):`];
  for (const ext of extActivities) {
    const recency = getRecencyLabel(ext.beginTime, now);
    const prefix =
      recency === "today" || recency === "yesterday" ? `  [${recency.toUpperCase()}] ` : "  ";
    extLines.push(prefix + formatExternalActivityLine(ext).trimStart());
  }
  const recentVigorous = extActivities.filter((e) => {
    const recency = getRecencyLabel(e.beginTime, now);
    return (
      (recency === "today" || recency === "yesterday" || recency === "this week") &&
      getHrIntensityLabel(e.averageHeartRate) === "vigorous"
    );
  });
  if (recentVigorous.length > 0) {
    extLines.push(
      `  → ${recentVigorous.length} vigorous session(s) this week. Factor into recovery and volume decisions.`,
    );
  }
  sections.push({ priority: 10, lines: extLines });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS (existing snapshot tests may need minor adjustments if they check exact output format)

- [ ] **Step 5: Commit**

```bash
git add convex/ai/context.ts
git commit -m "feat: apply time-decay weighting to training snapshot"
```

---

## Phase 3: Biometric Check-In Triggers

**Why:** Research shows post-event triggers (right after something happens) have the highest engagement impact. Adding recovery-based and positive-pattern triggers extends the existing 6-trigger system to catch more high-value moments.

**Risk:** Medium. Schema change required (new trigger literals). Follows established patterns exactly.

### Task 3.1: Add New Trigger Types

**Files:**

- Modify: `convex/checkIns/content.ts`
- Test: `convex/checkIns/content.test.ts`
- Modify: `convex/schema.ts:106-113`

- [ ] **Step 1: Write the failing test for new trigger messages**

Add to `convex/checkIns/content.test.ts`:

```typescript
it("returns message for high_external_load trigger", () => {
  expect(getMessageForTrigger("high_external_load")).toBeTruthy();
});

it("returns message for consistency_streak trigger", () => {
  expect(getMessageForTrigger("consistency_streak")).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run convex/checkIns/content.test.ts`
Expected: FAIL — new trigger types not in the union

- [ ] **Step 3: Add new trigger types and messages**

In `convex/checkIns/content.ts`, update the type and messages:

```typescript
export type CheckInTrigger =
  | "missed_session"
  | "gap_3_days"
  | "tough_session_completed"
  | "weekly_recap"
  | "strength_milestone"
  | "plateau"
  | "high_external_load"
  | "consistency_streak";

export const CHECK_IN_MESSAGES: Record<CheckInTrigger, string> = {
  missed_session:
    "No worries — life happens. Ready to get back to it? I can adjust your week so you don't miss a beat.",
  gap_3_days:
    "It's been a few days since your last session. When you're ready, I can suggest a quick session that fits your day.",
  tough_session_completed:
    "That was a solid session. Your body's adapting. Rest up and we'll keep building.",
  weekly_recap:
    "Here's your week at a glance. Next week's plan is ready when you are — let me know if you want to tweak anything.",
  strength_milestone:
    "Your strength numbers are moving in the right direction. That's real progress.",
  plateau:
    "You've been at this weight for a few sessions. Options: add a set, bump weight slightly, or swap the exercise for a few weeks. Your call.",
  high_external_load:
    "You've had several intense sessions outside of Tonal recently. Your body might benefit from a lighter Tonal session or extra recovery today.",
  consistency_streak:
    "You've hit every programmed session for 3 weeks straight. That consistency is what drives real results. Keep it going.",
};
```

- [ ] **Step 4: Update the schema to include new trigger literals**

In `convex/schema.ts`, update the `checkIns` table trigger field (lines 106-113):

```typescript
checkIns: defineTable({
  userId: v.id("users"),
  trigger: v.union(
    v.literal("missed_session"),
    v.literal("gap_3_days"),
    v.literal("tough_session_completed"),
    v.literal("weekly_recap"),
    v.literal("strength_milestone"),
    v.literal("plateau"),
    v.literal("high_external_load"),
    v.literal("consistency_streak"),
  ),
  message: v.string(),
  readAt: v.optional(v.number()),
  createdAt: v.number(),
  triggerContext: v.optional(v.string()),
});
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run convex/checkIns/content.test.ts`
Expected: PASS

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add convex/checkIns/content.ts convex/checkIns/content.test.ts convex/schema.ts
git commit -m "feat: add high_external_load and consistency_streak check-in triggers"
```

### Task 3.2: Implement Trigger Evaluation Functions

**Files:**

- Modify: `convex/checkIns/triggers.ts`

- [ ] **Step 1: Add cooldown constants**

Add after line 26 in `convex/checkIns/triggers.ts`:

```typescript
const HIGH_EXTERNAL_LOAD_COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000;
const CONSISTENCY_STREAK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const VIGOROUS_HR_THRESHOLD = 130;
```

- [ ] **Step 2: Implement high external load trigger**

Add before `evaluateTriggersForUser` (before line 180):

```typescript
async function evaluateHighExternalLoad(
  ctx: ActionCtx,
  userId: Id<"users">,
  now: number,
): Promise<TriggerResult | null> {
  const externals = (await ctx.runAction(internal.tonal.proxy.fetchExternalActivities, {
    userId,
    limit: 20,
  })) as ExternalActivity[];

  // Count vigorous sessions in the last 72 hours
  const seventyTwoHoursAgo = now - 3 * 24 * 60 * 60 * 1000;
  const recentVigorous = externals.filter((e) => {
    const ts = new Date(e.beginTime).getTime();
    return ts > seventyTwoHoursAgo && e.averageHeartRate >= VIGOROUS_HR_THRESHOLD;
  });

  if (recentVigorous.length < 3) return null;

  const hasRecent = await ctx.runQuery(internal.checkIns.hasRecentCheckIn, {
    userId,
    trigger: "high_external_load",
    since: now - HIGH_EXTERNAL_LOAD_COOLDOWN_MS,
  });
  if (hasRecent) return null;

  return {
    trigger: "high_external_load",
    triggerContext: `${recentVigorous.length} vigorous sessions in 72h`,
  };
}
```

- [ ] **Step 3: Implement consistency streak trigger**

Add after the high external load function:

```typescript
async function evaluateConsistencyStreak(
  ctx: ActionCtx,
  userId: Id<"users">,
  now: number,
): Promise<TriggerResult | null> {
  // Check last 3 week plans — all programmed sessions completed?
  const today = new Date(now);
  const threeWeeksAgo = new Date(now - 21 * 24 * 60 * 60 * 1000);

  const activities = (await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
    userId,
    limit: 30,
  })) as Activity[];

  // Count weeks with at least the target number of sessions
  const weekCounts = new Map<string, number>();
  for (const a of activities) {
    const actDate = new Date(a.activityTime);
    if (actDate < threeWeeksAgo) continue;
    const weekKey = getWeekStartDateString(actDate);
    weekCounts.set(weekKey, (weekCounts.get(weekKey) ?? 0) + 1);
  }

  // Need at least 3 complete weeks with 3+ sessions each
  const completeWeeks = [...weekCounts.values()].filter((count) => count >= 3).length;
  if (completeWeeks < 3) return null;

  const hasRecent = await ctx.runQuery(internal.checkIns.hasRecentCheckIn, {
    userId,
    trigger: "consistency_streak",
    since: now - CONSISTENCY_STREAK_COOLDOWN_MS,
  });
  if (hasRecent) return null;

  return {
    trigger: "consistency_streak",
    triggerContext: `${completeWeeks} consecutive weeks with 3+ sessions`,
  };
}
```

- [ ] **Step 4: Wire new triggers into evaluateTriggersForUser**

Update the existing import from `"../tonal/types"` at line 13 to include `ExternalActivity`:

```typescript
import type { Activity, ExternalActivity } from "../tonal/types";
```

Add inside the `evaluateTriggersForUser` handler, after the plateau evaluation (before `return triggers;`):

```typescript
const externalLoad = await evaluateHighExternalLoad(ctx, userId, now);
if (externalLoad) triggers.push(externalLoad);

const streak = await evaluateConsistencyStreak(ctx, userId, now);
if (streak) triggers.push(streak);
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add convex/checkIns/triggers.ts
git commit -m "feat: implement high_external_load and consistency_streak trigger evaluation"
```

---

## Phase 4: Two-Pass Workout Generation

**Why:** Bod.Coach's key finding: LLMs produce better structured output when they generate detailed reasoning first, then structure it in a second pass. Currently `programWeekTool` generates a structured week plan in one shot. Adding a reasoning pass should improve exercise selection quality.

**Risk:** Medium. Adds a new internal action but doesn't change the external API. The existing `programWeekTool` gains an optional reasoning pre-step.

### Task 4.1: Create Week Reasoning Module

**Files:**

- Create: `convex/ai/weekReasoning.ts`
- Create: `convex/ai/weekReasoning.test.ts`

- [ ] **Step 1: Write the failing test for reasoning prompt construction**

Create `convex/ai/weekReasoning.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildReasoningPrompt, parseReasoningOutput } from "./weekReasoning";

describe("buildReasoningPrompt", () => {
  it("includes all context sections in the prompt", () => {
    const prompt = buildReasoningPrompt({
      split: "ppl",
      targetDays: 3,
      sessionDuration: 45,
      muscleReadiness: { Chest: 85, Back: 60, Legs: 90 },
      recentWorkouts: ["Push — Chest/Shoulders/Triceps", "Pull — Back/Biceps"],
      activeInjuries: ["left shoulder — avoid overhead pressing"],
      recentFeedback: { avgRpe: 7.5, avgRating: 4.2 },
      isDeload: false,
    });

    expect(prompt).toContain("Push/Pull/Legs");
    expect(prompt).toContain("3 training days");
    expect(prompt).toContain("45 minutes");
    expect(prompt).toContain("Back: 60");
    expect(prompt).toContain("left shoulder");
    expect(prompt).toContain("RPE 7.5");
  });

  it("flags deload week in prompt", () => {
    const prompt = buildReasoningPrompt({
      split: "ppl",
      targetDays: 3,
      sessionDuration: 45,
      muscleReadiness: {},
      recentWorkouts: [],
      activeInjuries: [],
      recentFeedback: null,
      isDeload: true,
    });

    expect(prompt).toContain("DELOAD");
  });
});

describe("parseReasoningOutput", () => {
  it("extracts day-by-day reasoning from structured text", () => {
    const text = `
## Day 1: Push (Chest, Shoulders, Triceps)
Focus on chest since readiness is high (85). Start with bench press for compound strength.
Include shoulder work but avoid overhead pressing due to injury.

## Day 2: Pull (Back, Biceps)
Back readiness is lower (60) — reduce volume. Prioritize rows over heavy deadlifts.

## Day 3: Legs (Quads, Glutes, Hamstrings)
Full volume — readiness is excellent (90). Include squat variation.
    `.trim();

    const result = parseReasoningOutput(text);
    expect(result).toHaveLength(3);
    expect(result[0].dayLabel).toBe("Push");
    expect(result[0].reasoning).toContain("bench press");
    expect(result[1].dayLabel).toBe("Pull");
    expect(result[2].dayLabel).toBe("Legs");
  });

  it("returns empty array for unparseable text", () => {
    expect(parseReasoningOutput("Random unstructured text")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run convex/ai/weekReasoning.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the reasoning module**

Create `convex/ai/weekReasoning.ts`:

```typescript
/**
 * Two-pass week programming: reasoning pass (natural language) before structuring.
 * Research: LLMs produce better structured output when reasoning freely first.
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
    lines.push("⚠️ DELOAD WEEK: Reduce volume (2 sets instead of 3) and intensity (RPE 5-6).");
    lines.push("");
  }

  if (Object.keys(ctx.muscleReadiness).length > 0) {
    lines.push("Muscle readiness (0-100):");
    for (const [muscle, score] of Object.entries(ctx.muscleReadiness)) {
      const status = score < 50 ? "⚠️ fatigued" : score < 70 ? "moderate" : "ready";
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
      lines.push("  → High RPE — consider reducing volume or intensity.");
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
        days.push({ dayLabel: currentLabel, reasoning: currentLines.join("\n").trim() });
      }
      currentLabel = match[1];
      currentLines = [];
    } else if (currentLabel) {
      currentLines.push(line);
    }
  }

  if (currentLabel) {
    days.push({ dayLabel: currentLabel, reasoning: currentLines.join("\n").trim() });
  }

  return days;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run convex/ai/weekReasoning.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add convex/ai/weekReasoning.ts convex/ai/weekReasoning.test.ts
git commit -m "feat: add two-pass week reasoning module"
```

### Task 4.2: Wire Two-Pass Reasoning into Week Programming

**Files:**

- Modify: `convex/ai/weekTools.ts` (programWeekTool)
- Modify: `convex/ai/coach.ts` (update system prompt to mention reasoning)

- [ ] **Step 1: Update programWeekTool to include reasoning context**

In `convex/ai/weekTools.ts`, the `programWeekTool` currently calls `internal.coach.weekProgramming.generateDraftWeekPlan`. Modify it to also pass a `reasoningHints` field built from `buildReasoningPrompt`.

Add import at top:

```typescript
import { buildReasoningPrompt } from "./weekReasoning";
import type { ReasoningContext } from "./weekReasoning";
```

The `programWeekTool` currently calls `generateDraftWeekPlan` which is a rule-based algorithm (not LLM-based), so the reasoning prompt should be returned alongside the draft plan for the AI agent to reference when presenting the plan.

Inside the `programWeekTool` execute function, **add data fetches** after resolving preferences and before calling `generateDraftWeekPlan`. These variables are NOT currently in scope — you must add them:

```typescript
// Fetch data needed for reasoning context (not currently available in this tool)
const [readiness, recentActivities, activeInjuries, recentFeedback, activeBlock] =
  await Promise.all([
    ctx.runAction(internal.tonal.proxy.fetchMuscleReadiness, { userId }).catch(() => null),
    ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, { userId, limit: 5 }).catch(() => []),
    ctx.runQuery(internal.injuries.getActiveInternal, { userId }).catch(() => []),
    ctx.runQuery(internal.workoutFeedback.getRecentInternal, { userId, limit: 5 }).catch(() => []),
    ctx.runQuery(internal.coach.periodization.getActiveBlock, { userId }).catch(() => null),
  ]);

// Build reasoning context for two-pass generation
const reasoningCtx: ReasoningContext = {
  split: preferredSplit,
  targetDays: targetDays,
  sessionDuration: sessionDuration,
  muscleReadiness: readiness
    ? Object.fromEntries(
        Object.entries(readiness as Record<string, number>).map(([k, v]) => [k, v]),
      )
    : {},
  recentWorkouts: (recentActivities as Activity[]).map(
    (a) => `${a.workoutPreview.workoutTitle} — ${a.workoutPreview.targetArea}`,
  ),
  activeInjuries: (activeInjuries as { area: string; avoidance: string }[]).map(
    (inj) => `${inj.area} — avoid ${inj.avoidance}`,
  ),
  recentFeedback:
    (recentFeedback as { rpe: number; rating: number }[]).length > 0
      ? {
          avgRpe:
            (recentFeedback as { rpe: number }[]).reduce((s, f) => s + f.rpe, 0) /
            (recentFeedback as { rpe: number }[]).length,
          avgRating:
            (recentFeedback as { rating: number }[]).reduce((s, f) => s + f.rating, 0) /
            (recentFeedback as { rating: number }[]).length,
        }
      : null,
  isDeload: (activeBlock as { blockType: string } | null)?.blockType === "deload",
};
const reasoningPrompt = buildReasoningPrompt(reasoningCtx);
```

Then pass `reasoningPrompt` to `generateDraftWeekPlan` as an optional field. Add `reasoningHints?: string` to the internal action's args validator.

**Important:** You also need to add the `Activity` type import at the top of `weekTools.ts`:

```typescript
import type { Activity } from "../tonal/types";
```

- [ ] **Step 2: Add reasoning awareness to system prompt**

In `convex/ai/coach.ts`, add after the WEEKLY PROGRAMMING section:

```typescript
TWO-PASS PROGRAMMING:
- When program_week returns a draft plan, also consider the reasoning context about muscle readiness, recent workouts, and injuries.
- When presenting the plan to the user, briefly explain WHY you chose specific exercises: "Incline bench since readiness is high and we had flat bench last two weeks."
- If the reasoning suggests a fatigued muscle group, explain the accommodation: "Back readiness is lower this week, so I reduced rowing volume and added an extra set of lat pulldowns instead."
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/ai/weekTools.ts convex/ai/coach.ts
git commit -m "feat: wire two-pass reasoning into weekly programming"
```

---

## Phase 5: Procedural Memory

**Why:** The AI coach doesn't currently learn coaching preferences across conversations. Academic research ([arxiv 2510.07925](https://arxiv.org/abs/2510.07925)) shows a three-layer memory system (semantic + episodic + procedural) with 2k tokens outperforms full conversation history. Semantic memory (profile, injuries) and episodic memory (workout history) already exist. Procedural memory (learned coaching behaviors) is missing.

**Risk:** Medium. Requires schema change + new table + new module. Follows existing patterns (injuries, goals).

### Task 5.1: Add Coaching Notes Schema

**Files:**

- Modify: `convex/schema.ts`

- [ ] **Step 1: Add coachingNotes table to schema**

Add before the `emailChangeRequests` table in `convex/schema.ts`:

```typescript
  /** Procedural memory: coaching observations learned across conversations.
   *  Examples: "user prefers data-driven feedback", "user dislikes Bulgarian split squats",
   *  "user responds well to weekly recaps". Extracted by background process after conversations. */
  coachingNotes: defineTable({
    userId: v.id("users"),
    /** The observation itself. Keep concise — these go into the context window. */
    content: v.string(),
    /** Category for retrieval filtering. */
    category: v.union(
      v.literal("preference"),     // "prefers morning workouts"
      v.literal("avoidance"),      // "dislikes Bulgarian split squats"
      v.literal("response_style"), // "responds better to data than encouragement"
      v.literal("pattern"),        // "tends to skip Friday sessions"
      v.literal("insight"),        // "left shoulder bothers them after overhead work"
    ),
    /** Confidence: how certain we are this is a real pattern vs one-off. */
    confidence: v.union(v.literal("observed"), v.literal("confirmed")),
    /** Thread where this was observed, for provenance. */
    sourceThreadId: v.optional(v.string()),
    createdAt: v.number(),
    /** Last time this note was referenced in a conversation (for TTL/cleanup). */
    lastReferencedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_category", ["userId", "category"]),
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add coachingNotes table for procedural memory"
```

### Task 5.2: Create Coaching Memory Module

**Files:**

- Create: `convex/ai/memory.ts`
- Create: `convex/ai/memory.test.ts`

- [ ] **Step 1: Write failing tests for note extraction**

Create `convex/ai/memory.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractCoachingSignals } from "./memory";

describe("extractCoachingSignals", () => {
  it("detects exercise avoidance preference", () => {
    const signals = extractCoachingSignals([
      { role: "user", content: "I really don't like Bulgarian split squats" },
      { role: "assistant", content: "Got it — I'll avoid those in your programming." },
    ]);
    expect(signals).toContainEqual(
      expect.objectContaining({
        category: "avoidance",
        content: expect.stringContaining("Bulgarian split squats"),
      }),
    );
  });

  it("detects feedback style preference", () => {
    const signals = extractCoachingSignals([
      {
        role: "user",
        content: "Can you just give me the numbers? I don't need the motivation stuff.",
      },
    ]);
    expect(signals).toContainEqual(
      expect.objectContaining({
        category: "response_style",
        content: expect.stringContaining("data"),
      }),
    );
  });

  it("returns empty for generic conversation", () => {
    const signals = extractCoachingSignals([
      { role: "user", content: "Program my week" },
      { role: "assistant", content: "Here's your week plan..." },
    ]);
    expect(signals).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run convex/ai/memory.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement coaching memory module**

Create `convex/ai/memory.ts`:

```typescript
/**
 * Procedural memory: extract and store coaching observations from conversations.
 * Runs as background process after conversations end, not during real-time chat.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";

// ---------------------------------------------------------------------------
// Signal extraction (pure, testable)
// ---------------------------------------------------------------------------

interface Message {
  role: string;
  content: string;
}

interface CoachingSignal {
  content: string;
  category: "preference" | "avoidance" | "response_style" | "pattern" | "insight";
}

const AVOIDANCE_PATTERNS = [
  /(?:don'?t like|hate|avoid|skip|no more)\s+(.+?)(?:\.|$)/i,
  /(?:not a fan of|can't stand)\s+(.+?)(?:\.|$)/i,
];

const STYLE_PATTERNS = [
  /(?:just (?:give|show) me (?:the )?(?:numbers|data|stats))/i,
  /(?:don'?t need (?:the )?(?:motivation|encouragement|pep talk))/i,
  /(?:more detail|explain more|break it down)/i,
];

export function extractCoachingSignals(messages: Message[]): CoachingSignal[] {
  const signals: CoachingSignal[] = [];

  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const text = msg.content;

    // Check avoidance patterns
    for (const pattern of AVOIDANCE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        signals.push({
          category: "avoidance",
          content: `User dislikes/avoids: ${match[1].trim()}`,
        });
      }
    }

    // Check style patterns
    for (const pattern of STYLE_PATTERNS) {
      if (pattern.test(text)) {
        signals.push({
          category: "response_style",
          content:
            text.includes("number") || text.includes("data") || text.includes("stats")
              ? "User prefers data-driven feedback over motivational language"
              : text.includes("detail") || text.includes("explain")
                ? "User prefers detailed explanations"
                : "User has specific communication preferences",
        });
        break; // One style signal per message
      }
    }
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Convex mutations/queries
// ---------------------------------------------------------------------------

export const saveNote = internalMutation({
  args: {
    userId: v.id("users"),
    content: v.string(),
    category: v.union(
      v.literal("preference"),
      v.literal("avoidance"),
      v.literal("response_style"),
      v.literal("pattern"),
      v.literal("insight"),
    ),
    confidence: v.union(v.literal("observed"), v.literal("confirmed")),
    sourceThreadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Deduplicate: don't save if an identical note already exists
    const existing = await ctx.db
      .query("coachingNotes")
      .withIndex("by_userId_category", (q) =>
        q.eq("userId", args.userId).eq("category", args.category),
      )
      .collect();

    const isDuplicate = existing.some(
      (note) => note.content.toLowerCase() === args.content.toLowerCase(),
    );
    if (isDuplicate) return null;

    return await ctx.db.insert("coachingNotes", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getNotesForUser = internalQuery({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit }) => {
    const notes = await ctx.db
      .query("coachingNotes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Sort by most recently referenced, then by creation
    notes.sort((a, b) => {
      const aRef = a.lastReferencedAt ?? a.createdAt;
      const bRef = b.lastReferencedAt ?? b.createdAt;
      return bRef - aRef;
    });

    return limit ? notes.slice(0, limit) : notes;
  },
});
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run convex/ai/memory.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add convex/ai/memory.ts convex/ai/memory.test.ts
git commit -m "feat: implement procedural memory extraction and storage"
```

### Task 5.3: Inject Coaching Notes into Context

**Files:**

- Modify: `convex/ai/context.ts` (add coaching notes section)
- Modify: `convex/ai/coach.ts` (update instructions to reference notes)

- [ ] **Step 1: Add coaching notes to buildTrainingSnapshot**

In `convex/ai/context.ts`, add to the parallel fetch block (after `externalActivities` fetch, around line 131):

```typescript
    ctx
      .runQuery(internal.ai.memory.getNotesForUser, { userId: convexUserId, limit: 10 })
      .catch(() => []),
```

Add the destructured variable:

```typescript
    coachingNotes,
```

Add a new priority section after Priority 4 (goals) — insert as Priority 3.5 (between injuries and goals, renumbering isn't required since priorities are relative):

```typescript
// Priority 2.5: Coaching notes (procedural memory — learned preferences)
// Uses 2.5 to sort between equipment (2) and injuries (3) without colliding
const notes = coachingNotes as Doc<"coachingNotes">[];
if (notes.length > 0) {
  const noteLines: string[] = [`Coaching Notes (learned from past conversations):`];
  for (const note of notes) {
    const confidence = note.confidence === "confirmed" ? "✓" : "?";
    noteLines.push(`  [${confidence}] ${note.content}`);
  }
  noteLines.push(`  → Honor these preferences without asking. They came from the user directly.`);
  sections.push({ priority: 2.5, lines: noteLines });
}
```

**Note:** Using priority 2.5 places coaching notes between equipment (2) and injuries (3). The `trimSnapshot` function sorts numerically, so non-integer priorities work correctly. This avoids colliding with the existing priority 3 (active injuries).

- [ ] **Step 2: Update system prompt**

In `convex/ai/coach.ts`, update the MEMORY section (line 207-211):

```typescript
MEMORY:
- You have access to the user's conversation history across all past sessions.
- The training snapshot includes COACHING NOTES — preferences, avoidances, and style observations learned from past conversations. Always honor these without asking.
- When relevant context from a previous conversation appears, reference it naturally.
- If the user mentioned preferences, dislikes, or constraints in a past session, honor them without being asked.
- Example: if they said "I don't like Bulgarian split squats" weeks ago, don't program them.
- If the user contradicts a coaching note (e.g., "actually I want to try split squats again"), update your behavior immediately.
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/ai/context.ts convex/ai/coach.ts
git commit -m "feat: inject procedural memory (coaching notes) into AI context"
```

---

## Phase 6: Intent Router

**Why:** Bod.Coach's key finding: "Giving an LLM too many tools degrades accuracy." Your agent has 27 tools. A lightweight router that classifies intent and dispatches to specialized sub-agents (5-8 tools each) should improve tool selection accuracy. This is the largest architectural change — sequenced last so earlier phases are stable.

**Risk:** High. Changes the core message processing flow. Requires careful fallback to monolithic agent if routing fails.

### Task 6.1: Define Intent Categories and Classification

**Files:**

- Create: `convex/ai/router.ts`
- Create: `convex/ai/router.test.ts`

- [ ] **Step 1: Write failing tests for intent classification**

Create `convex/ai/router.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { classifyIntent } from "./router";

describe("classifyIntent", () => {
  it("classifies workout programming requests", () => {
    expect(classifyIntent("Program my week")).toBe("programming");
    expect(classifyIntent("Can you make me a push day?")).toBe("programming");
    expect(classifyIntent("I want to change Wednesday to a pull day")).toBe("programming");
    expect(classifyIntent("Swap bench press for incline")).toBe("programming");
  });

  it("classifies data and recovery queries", () => {
    expect(classifyIntent("What are my strength scores?")).toBe("data");
    expect(classifyIntent("How's my muscle readiness?")).toBe("data");
    expect(classifyIntent("Show me my workout history")).toBe("data");
    expect(classifyIntent("What did I do in my last session?")).toBe("data");
  });

  it("classifies coaching conversations", () => {
    expect(classifyIntent("I hurt my shoulder")).toBe("coaching");
    expect(classifyIntent("RPE was 9 and I'd rate it 4")).toBe("coaching");
    expect(classifyIntent("Set a goal to bench 100 lbs")).toBe("coaching");
    expect(classifyIntent("Should I take a deload?")).toBe("coaching");
  });

  it("defaults to general for ambiguous messages", () => {
    expect(classifyIntent("Hey")).toBe("general");
    expect(classifyIntent("Thanks")).toBe("general");
    expect(classifyIntent("What do you think?")).toBe("general");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run convex/ai/router.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement keyword-based intent classifier**

Create `convex/ai/router.ts`:

```typescript
/**
 * Intent router: classifies user messages into domains for specialist dispatch.
 *
 * Phase 1: keyword-based classification (fast, deterministic, no LLM call).
 * Phase 2 (future): LLM-based classification for ambiguous cases.
 */

export type Intent = "programming" | "data" | "coaching" | "general";

const PROGRAMMING_KEYWORDS = [
  "program",
  "plan",
  "schedule",
  "workout",
  "session",
  "week",
  "swap",
  "move",
  "adjust",
  "change",
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

function scoreIntent(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((score, kw) => score + (lower.includes(kw) ? 1 : 0), 0);
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

  // Return highest-scoring intent (data wins ties with programming to avoid
  // misrouting data queries that mention "week", "session", etc.)
  if (scores.data >= scores.programming && scores.data >= scores.coaching) {
    return "data";
  }
  if (scores.programming >= scores.coaching) return "programming";
  return "coaching";
}

/**
 * Tool sets per intent domain. Each specialist gets only the tools it needs.
 */
export const TOOL_SETS: Record<Intent, string[]> = {
  programming: [
    "search_exercises",
    "program_week",
    "get_week_plan_details",
    "delete_week_plan",
    "approve_week_plan",
    "get_workout_performance",
    "swap_exercise",
    "move_session",
    "adjust_session_duration",
    "create_workout",
    "delete_workout",
    "estimate_duration",
  ],
  data: [
    "search_exercises",
    "get_strength_scores",
    "get_strength_history",
    "get_muscle_readiness",
    "get_workout_history",
    "get_workout_detail",
    "get_training_frequency",
    "get_weekly_volume",
    "get_workout_performance",
    "list_progress_photos",
    "compare_progress_photos",
  ],
  coaching: [
    "record_feedback",
    "get_recent_feedback",
    "check_deload",
    "start_training_block",
    "advance_training_block",
    "set_goal",
    "update_goal_progress",
    "get_goals",
    "report_injury",
    "resolve_injury",
    "get_injuries",
    "get_weekly_volume",
  ],
  general: [], // Falls through to full agent with all 27 tools
};
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run convex/ai/router.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add convex/ai/router.ts convex/ai/router.test.ts
git commit -m "feat: add keyword-based intent classifier for agent routing"
```

### Task 6.2: Create Specialist Agent Configurations

**Files:**

- Create: `convex/ai/agents/programming.ts`
- Create: `convex/ai/agents/recovery.ts`
- Create: `convex/ai/agents/coaching.ts`

- [ ] **Step 1: Export coachAgentConfig from coach.ts**

In `convex/ai/coach.ts`, line 48, change `const coachAgentConfig` to `export const coachAgentConfig`. This is required for specialist agents to import the shared config.

```typescript
export const coachAgentConfig = {
```

- [ ] **Step 2: Create agents directory**

Run: `mkdir -p convex/ai/agents`

- [ ] **Step 3: Create programming specialist agent**

Create `convex/ai/agents/programming.ts`:

```typescript
/**
 * Programming specialist: weekly plans, workout creation, exercise search, modifications.
 * ~12 tools (vs 27 in the monolithic agent).
 */

import { Agent } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { components } from "../../_generated/api";
import { coachAgentConfig } from "../coach";
import {
  searchExercisesTool,
  createWorkoutTool,
  deleteWorkoutTool,
  estimateDurationTool,
} from "../tools";
import {
  programWeekTool,
  getWeekPlanDetailsTool,
  deleteWeekPlanTool,
  approveWeekPlanTool,
  getWorkoutPerformanceTool,
} from "../weekTools";
import {
  swapExerciseTool,
  moveSessionTool,
  adjustSessionDurationTool,
} from "../weekModificationTools";

export const programmingAgent = new Agent(components.agent, {
  name: "Tonal Coach — Programming",
  languageModel: google("gemini-2.5-pro"),
  embeddingModel: coachAgentConfig.embeddingModel,
  contextOptions: coachAgentConfig.contextOptions,
  instructions: coachAgentConfig.instructions,
  contextHandler: coachAgentConfig.contextHandler,
  usageHandler: coachAgentConfig.usageHandler,
  maxSteps: 25,
  tools: {
    search_exercises: searchExercisesTool,
    create_workout: createWorkoutTool,
    delete_workout: deleteWorkoutTool,
    estimate_duration: estimateDurationTool,
    program_week: programWeekTool,
    get_week_plan_details: getWeekPlanDetailsTool,
    delete_week_plan: deleteWeekPlanTool,
    approve_week_plan: approveWeekPlanTool,
    get_workout_performance: getWorkoutPerformanceTool,
    swap_exercise: swapExerciseTool,
    move_session: moveSessionTool,
    adjust_session_duration: adjustSessionDurationTool,
  },
});

const programmingConfig = {
  embeddingModel: coachAgentConfig.embeddingModel,
  contextOptions: coachAgentConfig.contextOptions,
  instructions: coachAgentConfig.instructions,
  contextHandler: coachAgentConfig.contextHandler,
  usageHandler: coachAgentConfig.usageHandler,
  maxSteps: 25,
  tools: {
    search_exercises: searchExercisesTool,
    create_workout: createWorkoutTool,
    delete_workout: deleteWorkoutTool,
    estimate_duration: estimateDurationTool,
    program_week: programWeekTool,
    get_week_plan_details: getWeekPlanDetailsTool,
    delete_week_plan: deleteWeekPlanTool,
    approve_week_plan: approveWeekPlanTool,
    get_workout_performance: getWorkoutPerformanceTool,
    swap_exercise: swapExerciseTool,
    move_session: moveSessionTool,
    adjust_session_duration: adjustSessionDurationTool,
  },
};

export const programmingAgent = new Agent(components.agent, {
  name: "Tonal Coach — Programming",
  languageModel: google("gemini-2.5-pro"),
  ...programmingConfig,
});

export const programmingAgentFallback = new Agent(components.agent, {
  name: "Tonal Coach — Programming (Fallback)",
  languageModel: google("gemini-2.5-flash"),
  ...programmingConfig,
});
```

- [ ] **Step 3: Create data/recovery specialist agent**

Create `convex/ai/agents/recovery.ts`:

```typescript
/**
 * Data & recovery specialist: strength scores, readiness, history, volume analysis, photos.
 * ~11 tools.
 */

import { Agent } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { components } from "../../_generated/api";
import { coachAgentConfig } from "../coach";
import {
  searchExercisesTool,
  getStrengthScoresTool,
  getStrengthHistoryTool,
  getMuscleReadinessTool,
  getWorkoutHistoryTool,
  getWorkoutDetailTool,
  getTrainingFrequencyTool,
  listProgressPhotosTool,
  compareProgressPhotosTool,
} from "../tools";
import { getWorkoutPerformanceTool } from "../weekTools";
import { getWeeklyVolumeTool } from "../coachingTools";

const recoveryConfig = {
  embeddingModel: coachAgentConfig.embeddingModel,
  contextOptions: coachAgentConfig.contextOptions,
  instructions: coachAgentConfig.instructions,
  contextHandler: coachAgentConfig.contextHandler,
  usageHandler: coachAgentConfig.usageHandler,
  maxSteps: 15,
  tools: {
    search_exercises: searchExercisesTool,
    get_strength_scores: getStrengthScoresTool,
    get_strength_history: getStrengthHistoryTool,
    get_muscle_readiness: getMuscleReadinessTool,
    get_workout_history: getWorkoutHistoryTool,
    get_workout_detail: getWorkoutDetailTool,
    get_training_frequency: getTrainingFrequencyTool,
    get_weekly_volume: getWeeklyVolumeTool,
    get_workout_performance: getWorkoutPerformanceTool,
    list_progress_photos: listProgressPhotosTool,
    compare_progress_photos: compareProgressPhotosTool,
  },
};

export const recoveryAgent = new Agent(components.agent, {
  name: "Tonal Coach — Data & Recovery",
  languageModel: google("gemini-2.5-pro"),
  ...recoveryConfig,
});

export const recoveryAgentFallback = new Agent(components.agent, {
  name: "Tonal Coach — Data & Recovery (Fallback)",
  languageModel: google("gemini-2.5-flash"),
  ...recoveryConfig,
});
```

- [ ] **Step 4: Create coaching specialist agent**

Create `convex/ai/agents/coaching.ts`:

```typescript
/**
 * Coaching specialist: feedback, periodization, goals, injuries, volume.
 * ~12 tools.
 */

import { Agent } from "@convex-dev/agent";
import { google } from "@ai-sdk/google";
import { components } from "../../_generated/api";
import { coachAgentConfig } from "../coach";
import {
  recordFeedbackTool,
  getRecentFeedbackTool,
  checkDeloadTool,
  startTrainingBlockTool,
  advanceTrainingBlockTool,
  setGoalTool,
  updateGoalProgressTool,
  getGoalsTool,
  reportInjuryTool,
  resolveInjuryTool,
  getInjuriesTool,
  getWeeklyVolumeTool,
} from "../coachingTools";

const coachingSpecialistConfig = {
  embeddingModel: coachAgentConfig.embeddingModel,
  contextOptions: coachAgentConfig.contextOptions,
  instructions: coachAgentConfig.instructions,
  contextHandler: coachAgentConfig.contextHandler,
  usageHandler: coachAgentConfig.usageHandler,
  maxSteps: 15,
  tools: {
    record_feedback: recordFeedbackTool,
    get_recent_feedback: getRecentFeedbackTool,
    check_deload: checkDeloadTool,
    start_training_block: startTrainingBlockTool,
    advance_training_block: advanceTrainingBlockTool,
    set_goal: setGoalTool,
    update_goal_progress: updateGoalProgressTool,
    get_goals: getGoalsTool,
    report_injury: reportInjuryTool,
    resolve_injury: resolveInjuryTool,
    get_injuries: getInjuriesTool,
    get_weekly_volume: getWeeklyVolumeTool,
  },
};

export const coachingAgent = new Agent(components.agent, {
  name: "Tonal Coach — Coaching",
  languageModel: google("gemini-2.5-pro"),
  ...coachingSpecialistConfig,
});

export const coachingAgentFallback = new Agent(components.agent, {
  name: "Tonal Coach — Coaching (Fallback)",
  languageModel: google("gemini-2.5-flash"),
  ...coachingSpecialistConfig,
});
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add convex/ai/agents/
git commit -m "feat: create specialist agent configurations for programming, data, and coaching"
```

### Task 6.3: Wire Router into Message Processing

**Files:**

- Modify: `convex/ai/resilience.ts`
- Modify: `convex/chat.ts`

- [ ] **Step 1: Add routed agent selection to streamWithRetry**

In `convex/ai/resilience.ts`, update the `StreamWithRetryArgs` interface to accept an optional routed agent pair:

```typescript
interface StreamWithRetryArgs {
  primaryAgent: Agent;
  fallbackAgent: Agent;
  /** Optional specialist agents selected by the router. Falls back to primary/fallback if not set. */
  routedPrimary?: Agent;
  routedFallback?: Agent;
  threadId: string;
  userId: string;
  prompt?: string;
  promptMessageId?: string;
}
```

Update the `streamWithRetry` function to prefer routed agents when available:

```typescript
export async function streamWithRetry(ctx: ActionCtx, args: StreamWithRetryArgs): Promise<void> {
  const { primaryAgent, fallbackAgent, routedPrimary, routedFallback, threadId, userId } = args;

  // Use routed agents if available, otherwise fall back to monolithic agents
  const primary = routedPrimary ?? primaryAgent;
  const fallback = routedFallback ?? fallbackAgent;

  const promptArgs: PromptArgs =
    args.prompt !== undefined
      ? { prompt: args.prompt, maxOutputTokens: MAX_OUTPUT_TOKENS }
      : { promptMessageId: args.promptMessageId!, maxOutputTokens: MAX_OUTPUT_TOKENS };

  // Attempt 1: primary (or routed specialist)
  try {
    const result = await attemptStream(ctx, primary, threadId, userId, promptArgs);
    await validateWeekPlanIfNeeded(ctx, primary, threadId, userId, result);
    return;
  } catch (error) {
    if (!isTransientError(error)) {
      // If routed agent failed with non-transient error, retry with full monolithic agent
      if (routedPrimary) {
        try {
          const result = await attemptStream(ctx, primaryAgent, threadId, userId, promptArgs);
          await validateWeekPlanIfNeeded(ctx, primaryAgent, threadId, userId, result);
          return;
        } catch (fallbackError) {
          await saveErrorAndNotify(ctx, threadId, userId, fallbackError);
          return;
        }
      }
      await saveErrorAndNotify(ctx, threadId, userId, error);
      return;
    }
  }

  // Attempt 2: retry after delay
  await delay(RETRY_DELAY_MS);
  try {
    const result = await attemptStream(ctx, primary, threadId, userId, promptArgs);
    await validateWeekPlanIfNeeded(ctx, primary, threadId, userId, result);
    return;
  } catch (error) {
    if (!isTransientError(error)) {
      await saveErrorAndNotify(ctx, threadId, userId, error);
      return;
    }
  }

  // Attempt 3: fallback
  try {
    const result = await attemptStream(ctx, fallback, threadId, userId, promptArgs);
    await validateWeekPlanIfNeeded(ctx, fallback, threadId, userId, result);
    return;
  } catch (error) {
    await saveErrorAndNotify(ctx, threadId, userId, error);
  }
}
```

- [ ] **Step 2: Wire router into processMessage**

In `convex/chat.ts`, update the `processMessage` handler:

```typescript
import { classifyIntent } from "./ai/router";
import { programmingAgent, programmingAgentFallback } from "./ai/agents/programming";
import { recoveryAgent, recoveryAgentFallback } from "./ai/agents/recovery";
import {
  coachingAgent as coachingSpecialist,
  coachingAgentFallback as coachingSpecialistFallback,
} from "./ai/agents/coaching";

// Add a function to resolve routed agents:
function getRoutedAgents(prompt: string) {
  const intent = classifyIntent(prompt);
  switch (intent) {
    case "programming":
      return { primary: programmingAgent, fallback: programmingAgentFallback };
    case "data":
      return { primary: recoveryAgent, fallback: recoveryAgentFallback };
    case "coaching":
      return { primary: coachingSpecialist, fallback: coachingSpecialistFallback };
    case "general":
    default:
      return null; // Use monolithic agent
  }
}
```

Update the `processMessage` handler to use routing:

```typescript
export const processMessage = internalAction({
  args: {
    threadId: v.string(),
    userId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, userId, prompt }) => {
    const routed = getRoutedAgents(prompt);
    await streamWithRetry(ctx, {
      primaryAgent: coachAgent,
      fallbackAgent: coachAgentFallback,
      routedPrimary: routed?.primary,
      routedFallback: routed?.fallback,
      threadId,
      userId,
      prompt,
    });
  },
});
```

Also update the `sendMessage` action handler (the deprecated action still used for welcome flow). In `convex/chat.ts`, update the `streamWithRetry` call inside `sendMessage` (around line 68):

```typescript
const routed = getRoutedAgents(prompt);
await streamWithRetry(ctx, {
  primaryAgent: coachAgent,
  fallbackAgent: coachAgentFallback,
  routedPrimary: routed?.primary,
  routedFallback: routed?.fallback,
  threadId: targetThreadId,
  userId,
  prompt,
});
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS (router tests + existing tests)

- [ ] **Step 5: Commit**

```bash
git add convex/ai/resilience.ts convex/chat.ts
git commit -m "feat: wire intent router into message processing with monolithic fallback"
```

### Task 6.4: Add Router Analytics

**Files:**

- Modify: `convex/schema.ts` (optional: add routedIntent to aiToolCalls or aiUsage)
- Modify: `convex/ai/resilience.ts` (log which intent was routed)

- [ ] **Step 1: Add routedIntent field to aiUsage table**

In `convex/schema.ts`, add to the `aiUsage` table (after the `cacheWriteTokens` field):

```typescript
    routedIntent: v.optional(v.string()),
```

- [ ] **Step 2: Create recordRouting mutation in aiUsage.ts**

In `convex/aiUsage.ts`, add a new internal mutation:

```typescript
export const recordRouting = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.string(),
    intent: v.string(),
  },
  handler: async (ctx, { userId, threadId, intent }) => {
    await ctx.db.insert("aiUsage", {
      userId: userId as Id<"users">,
      threadId,
      agentName: `router:${intent}`,
      model: "keyword-classifier",
      provider: "local",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      routedIntent: intent,
      createdAt: Date.now(),
    });
  },
});
```

**Note:** Import `internalMutation` and `Id` if not already imported. Check existing imports in `aiUsage.ts` first.

- [ ] **Step 3: Wire routing logging into processMessage**

In `convex/chat.ts`, inside the `processMessage` handler, after the `getRoutedAgents` call:

```typescript
const routed = getRoutedAgents(prompt);
if (routed) {
  await ctx.runMutation(internal.aiUsage.recordRouting, {
    userId,
    threadId,
    intent: classifyIntent(prompt),
  });
}
```

- [ ] **Step 4: Type-check and test**

Run: `npx tsc --noEmit && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/aiUsage.ts convex/chat.ts
git commit -m "feat: add routing analytics to track intent classification"
```

---

## Verification Checklist

After all phases are complete:

- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes (all existing + new tests)
- [ ] Manual test: send "program my week" → should route to programming specialist
- [ ] Manual test: send "what are my strength scores?" → should route to data specialist
- [ ] Manual test: send "I hurt my shoulder" → should route to coaching specialist
- [ ] Manual test: send "hey" → should fall through to monolithic agent
- [ ] Manual test: conversation pacing works — agent asks one question at a time during onboarding
- [ ] Manual test: recent workouts show [TODAY] / [YESTERDAY] labels in training snapshot
- [ ] Check Convex dashboard for new coachingNotes table
- [ ] Check aiUsage table for routedIntent logging
