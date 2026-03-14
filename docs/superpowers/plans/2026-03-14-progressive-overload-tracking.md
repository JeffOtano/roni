# Progressive Overload Tracking Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI coach aware of per-exercise performance trends so it can celebrate PRs, detect plateaus, and present post-workout summaries with specific numbers.

**Architecture:** Extends the existing `progressiveOverload.ts` module with PR detection and workout performance analysis. Adds a new AI tool (`get_workout_performance`) and enhances the training snapshot context with recent performance highlights. System prompt updated to instruct the AI on when and how to present overload data.

**Tech Stack:** Convex (actions, queries), @convex-dev/agent tools, Vitest

**Spec:** `docs/pm/reddit-launch-plan.md` — Section 4 (Progressive Overload Tracking)

---

## File Structure

### New Files

| File                               | Responsibility                                                   |
| ---------------------------------- | ---------------------------------------------------------------- |
| `convex/coach/prDetection.ts`      | Pure functions for PR detection and workout performance analysis |
| `convex/coach/prDetection.test.ts` | Tests for PR detection logic                                     |

### Modified Files

| File                                   | Changes                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `convex/progressiveOverload.ts`        | Add `getWorkoutPerformanceSummary` internal action                 |
| `convex/ai/weekTools.ts`               | Add `getWorkoutPerformanceTool`                                    |
| `convex/ai/coach.ts`                   | Register new tool, update system prompt with overload instructions |
| `convex/ai/context.ts`                 | Enhance training snapshot with recent PR/performance highlights    |
| `src/components/ToolCallIndicator.tsx` | Add display message for new tool                                   |

---

## Chunk 1: PR Detection Logic

### Task 1.1: Create PR Detection Module

Create `convex/coach/prDetection.ts` with pure functions:

- `detectPRs(history: PerMovementHistoryEntry[], latestActivityMovementIds: string[])` — For each movement in the latest activity, compare its most recent session's avgWeightLbs to all previous sessions. Return PRs with: movementId, newWeight, previousBest, improvementPct.

- `generatePerformanceSummary(history: PerMovementHistoryEntry[], movementNames: Map<string, string>)` — For the most recent session of each movement, generate: PRs, plateaus (reuse detectPlateau from progressiveOverload), regressions (>10% below recent average), and steady progressions.

### Task 1.2: Test PR Detection

Create `convex/coach/prDetection.test.ts` with tests for:

- PR detected when latest weight exceeds all previous
- No PR when latest matches previous best
- No PR when no weight data available
- Multiple PRs across different exercises
- Regression detection (significant drop)
- Performance summary groups exercises correctly

---

## Chunk 2: Workout Performance Tool

### Task 2.1: Add getWorkoutPerformanceSummary Action

Add to `convex/progressiveOverload.ts`:

An internal action that:

1. Fetches per-movement history via `getPerMovementHistory`
2. Gets movement names from catalog cache
3. Runs PR detection and performance analysis
4. Returns structured summary with PRs, plateaus, regressions, and progressions

### Task 2.2: Add AI Tool and Register

Add `getWorkoutPerformanceTool` to `convex/ai/weekTools.ts`:

- Description: "Get performance summary for the user's most recent workout. Shows PRs, plateaus, regressions, and progression trends per exercise."
- No args needed — analyzes the most recent workout
- Calls the internal action from 2.1

Register in `convex/ai/coach.ts` and add display message to ToolCallIndicator.

---

## Chunk 3: Context Enhancement + System Prompt

### Task 3.1: Enhance Training Snapshot

Update `convex/ai/context.ts` `buildTrainingSnapshot` to include a "PERFORMANCE HIGHLIGHTS" section when recent workout data is available. Keep it concise — 2-3 lines max:

- Any PRs from the most recent workout
- Any plateaus detected (3+ flat sessions)
- Overall trend direction

This ensures the AI automatically knows about PRs without the user asking.

### Task 3.2: Update System Prompt

Add progressive overload instructions to the system prompt in `convex/ai/coach.ts`:

```
PROGRESSIVE OVERLOAD:
- When presenting weekly plans, always include last-time performance and target for each exercise.
- After a user completes a workout, acknowledge notable performance: PRs, plateaus, regressions.
- Celebrate PRs with specific numbers: "New PR on Bench Press — 73 avg per rep, up from 69. That's 5.8%."
- For plateaus (3+ flat sessions), present options: add a set, increase weight, or rotate the exercise. Ask before changing.
- For regressions, be curious not judgmental: "Bench was down from 69 to 61. Off day or something going on?"
- Use get_workout_performance to analyze the most recent workout when the user asks about their progress or when you notice they completed a session.
```
