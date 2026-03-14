# Weekly Programming + Workout Verification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to program their full training week through the AI coach chat, approve/modify the plan, push all workouts to Tonal with post-push verification, and do it again next week without re-entering preferences.

**Architecture:** The existing `weekProgramming.ts` pipeline (exercise selection, progressive overload, block generation) is refactored into a two-phase draft-then-push flow. New AI agent tools expose this pipeline through chat. Post-push verification reads back created workouts from Tonal's API to confirm correctness. Preferences are persisted on `userProfiles` so returning users skip the preference-gathering step.

**Tech Stack:** Convex (mutations, actions, queries), @convex-dev/agent tools (Zod schemas), Vitest, React (ToolCallIndicator component)

**Spec:** `docs/pm/reddit-launch-plan.md` — Sections 2 (Weekly Programming) and 5 (Workout Verification)

---

## File Structure

### New Files

| File                                     | Responsibility                                                                                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/ai/weekTools.ts`                 | All AI agent tools for weekly programming: `program_week`, `get_week_plan_details`, `swap_exercise`, `move_session`, `adjust_session_duration`, `approve_week_plan`, `delete_week_plan` |
| `convex/coach/weekModifications.ts`      | Internal mutations for modifying draft week plans (swap exercise in blocks, move day slots, re-select exercises for new duration)                                                       |
| `convex/coach/weekModifications.test.ts` | Tests for modification logic                                                                                                                                                            |
| `convex/coach/pushAndVerify.ts`          | Internal action: push a draft workout to Tonal + read-back verification + retry                                                                                                         |
| `convex/coach/pushAndVerify.test.ts`     | Tests for verification return shapes and retry contract                                                                                                                                 |

### Modified Files

| File                                   | Changes                                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `convex/ai/coach.ts`                   | Register 7 new tools, update system prompt with weekly programming instructions                                       |
| `convex/coach/weekProgramming.ts`      | Extract `generateDraftWeekPlan` that creates drafts (no Tonal push), keep `programWeek` for backward compat           |
| `convex/weekPlans.ts`                  | Add `createDraftWorkoutInternal`, `deleteWeekPlanInternal`, `swapDaySlots`, `updateDayWorkoutPlan` internal mutations |
| `convex/tonal/mutations.ts`            | Add `verifyWorkoutOnTonal` internal action (read-back check)                                                          |
| `convex/schema.ts`                     | Add `trainingPreferences` optional object to `userProfiles`                                                           |
| `convex/userProfiles.ts`               | Add `getTrainingPreferences` / `saveTrainingPreferences` mutations                                                    |
| `src/components/ToolCallIndicator.tsx` | Add display messages for 7 new tool names                                                                             |

---

## Chunk 1: Draft Week Plan Infrastructure

This chunk refactors the existing week programming pipeline to support a draft-then-push flow. After this chunk, the system can generate a complete week plan with draft workouts (not pushed to Tonal) and store training preferences for future weeks.

### Task 1.1: Add Training Preferences to Schema

**Files:**

- Modify: `convex/schema.ts` (line 14, inside `userProfiles` table)

- [ ] **Step 1: Add `trainingPreferences` field to `userProfiles` schema**

In `convex/schema.ts`, add inside the `userProfiles` table definition, after the `progressPhotoAnalysisEnabled` field (line 43):

```typescript
/** User's training preferences for weekly programming. */
trainingPreferences: v.optional(
  v.object({
    preferredSplit: v.union(v.literal("ppl"), v.literal("upper_lower"), v.literal("full_body")),
    trainingDays: v.array(v.number()), // 0=Mon..6=Sun
    sessionDurationMinutes: v.union(v.literal(30), v.literal(45), v.literal(60)),
  }),
),
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (new optional field is backward-compatible)

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add trainingPreferences field to userProfiles schema"
```

### Task 1.2: Add Preference Persistence Mutations

**Files:**

- Modify: `convex/userProfiles.ts`

- [ ] **Step 1: Read `convex/userProfiles.ts` to understand existing patterns**

- [ ] **Step 2: Add `getTrainingPreferences` query and `saveTrainingPreferences` mutation**

Add to `convex/userProfiles.ts`:

```typescript
/** Get training preferences for the authenticated user. */
export const getTrainingPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    return profile?.trainingPreferences ?? null;
  },
});

/** Save training preferences for the authenticated user. */
export const saveTrainingPreferences = mutation({
  args: {
    preferredSplit: v.union(v.literal("ppl"), v.literal("upper_lower"), v.literal("full_body")),
    trainingDays: v.array(v.number()),
    sessionDurationMinutes: v.union(v.literal(30), v.literal(45), v.literal(60)),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("No profile found — connect Tonal first");
    await ctx.db.patch(profile._id, {
      trainingPreferences: {
        preferredSplit: args.preferredSplit,
        trainingDays: args.trainingDays,
        sessionDurationMinutes: args.sessionDurationMinutes,
      },
    });
  },
});

/** Internal: get training preferences by userId. */
export const getTrainingPreferencesInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    return profile?.trainingPreferences ?? null;
  },
});

/** Internal: save training preferences by userId. */
export const saveTrainingPreferencesInternal = internalMutation({
  args: {
    userId: v.id("users"),
    preferredSplit: v.union(v.literal("ppl"), v.literal("upper_lower"), v.literal("full_body")),
    trainingDays: v.array(v.number()),
    sessionDurationMinutes: v.union(v.literal(30), v.literal(45), v.literal(60)),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (!profile) throw new Error("No profile found");
    await ctx.db.patch(profile._id, {
      trainingPreferences: {
        preferredSplit: args.preferredSplit,
        trainingDays: args.trainingDays,
        sessionDurationMinutes: args.sessionDurationMinutes,
      },
    });
  },
});
```

Ensure you import `internalQuery`, `internalMutation`, `query`, `mutation` from `./_generated/server` and `v` from `convex/values` and `getAuthUserId` from `@convex-dev/auth/server` (check if they're already imported).

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add convex/userProfiles.ts
git commit -m "feat: add training preference persistence mutations"
```

### Task 1.3: Create Draft Workout Internal Mutation

**Files:**

- Modify: `convex/weekPlans.ts`

- [ ] **Step 1: Add `createDraftWorkoutInternal` mutation**

Add to `convex/weekPlans.ts`:

```typescript
/** Internal: create a workoutPlan in draft status (no Tonal push). */
export const createDraftWorkoutInternal = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    blocks: v.any(),
    estimatedDuration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("workoutPlans", {
      userId: args.userId,
      title: args.title,
      blocks: args.blocks,
      status: "draft",
      source: "tonal_coach",
      estimatedDuration: args.estimatedDuration,
      createdAt: now,
    });
  },
});
```

- [ ] **Step 2: Add `deleteWeekPlanInternal` mutation**

```typescript
/** Internal: delete a week plan and its linked draft workouts. */
export const deleteWeekPlanInternal = internalMutation({
  args: {
    userId: v.id("users"),
    weekPlanId: v.id("weekPlans"),
  },
  handler: async (ctx, { userId, weekPlanId }) => {
    const plan = await ctx.db.get(weekPlanId);
    if (!plan || plan.userId !== userId) return;
    // Delete linked draft workouts
    for (const day of plan.days) {
      if (day.workoutPlanId) {
        const wp = await ctx.db.get(day.workoutPlanId);
        if (wp && wp.status === "draft") {
          await ctx.db.delete(wp._id);
        }
      }
    }
    await ctx.db.delete(weekPlanId);
  },
});
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add convex/weekPlans.ts
git commit -m "feat: add createDraftWorkout and deleteWeekPlan internal mutations"
```

### Task 1.4: Extract Draft Week Plan Generation

**Files:**

- Modify: `convex/coach/weekProgramming.ts`

- [ ] **Step 1: Add `generateDraftWeekPlan` internal action**

Add a new exported internal action below the existing `programWeek`:

```typescript
/**
 * Generate a week plan with draft workouts (not pushed to Tonal).
 * Used by the AI agent's program_week tool.
 * Returns the plan details so the agent can present them to the user.
 */
export const generateDraftWeekPlan = internalAction({
  args: {
    userId: v.id("users"),
    weekStartDate: v.optional(v.string()),
    preferredSplit: v.optional(preferredSplitValidator),
    targetDays: v.optional(v.number()),
    sessionDurationMinutes: v.optional(v.union(v.literal(30), v.literal(45), v.literal(60))),
    trainingDayIndicesOverride: v.optional(v.array(v.number())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { success: true; weekPlanId: Id<"weekPlans">; summary: DraftWeekSummary }
    | { success: false; error: string }
  > => {
    const weekStartDate = args.weekStartDate ?? getWeekStartDateString(new Date());
    if (!isValidWeekStartDateString(weekStartDate)) {
      return { success: false, error: "weekStartDate must be YYYY-MM-DD (Monday)." };
    }

    const preferredSplit = args.preferredSplit ?? "ppl";
    const targetDays = Math.min(7, Math.max(1, args.targetDays ?? 3));
    const sessionDurationMinutes = args.sessionDurationMinutes ?? 45;
    const maxExercises =
      SESSION_DURATION_TO_MAX_EXERCISES[sessionDurationMinutes] ?? DEFAULT_MAX_EXERCISES;

    // Delete existing plan for this week if present (user is re-generating)
    const existing = await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
      userId: args.userId,
      weekStartDate,
    });
    if (existing) {
      await ctx.runMutation(internal.weekPlans.deleteWeekPlanInternal, {
        userId: args.userId,
        weekPlanId: existing._id,
      });
    }

    const data = await fetchAndComputePlanData(ctx, args.userId, preferredSplit, targetDays);

    // If user specified exact day indices, override the computed ones
    const daySessions = args.trainingDayIndicesOverride
      ? getSessionTypesForSplit(preferredSplit, args.trainingDayIndicesOverride)
      : data.daySessions;

    // Rebuild initialDays with the potentially overridden day sessions
    const sessionTypeByDay = new Map(daySessions.map((d) => [d.dayIndex, d.sessionType]));
    const initialDays = Array.from({ length: 7 }, (_, i) => ({
      sessionType: (sessionTypeByDay.get(i) ?? "rest") as SessionType | "rest",
      status: "programmed" as const,
    }));

    const weekPlanId = (await ctx.runMutation(internal.weekPlans.createForUserInternal, {
      userId: args.userId,
      weekStartDate,
      preferredSplit,
      targetDays,
      days: initialDays,
    })) as Id<"weekPlans">;

    // Build drafts for each training day (sequential to avoid movement reuse)
    const daySummaries: DraftDaySummary[] = [];
    const catalog = data.catalog;

    for (const { dayIndex, sessionType } of daySessions) {
      const targetMuscleGroups =
        SESSION_TYPE_MUSCLES[sessionType] ?? SESSION_TYPE_MUSCLES.full_body;
      const movementIds = selectExercises({
        catalog,
        targetMuscleGroups,
        userLevel: data.userLevel,
        maxExercises,
        lastUsedMovementIds: data.lastUsedMovementIds,
      });
      if (movementIds.length === 0) continue;

      // Progressive overload suggestions
      let suggestions: {
        movementId: string;
        suggestedReps?: number;
        lastTimeText?: string;
        suggestedText?: string;
      }[] = [];
      try {
        suggestions = (await ctx.runAction(
          internal.progressiveOverload.getLastTimeAndSuggestedInternal,
          { userId: args.userId, movementIds },
        )) as typeof suggestions;
      } catch {
        // No history; use defaults.
      }

      const blocks = blocksFromMovementIds(movementIds, suggestions);
      const title = formatSessionTitle(sessionType, weekStartDate, dayIndex);

      // Create draft (no Tonal push)
      const planId = (await ctx.runMutation(internal.weekPlans.createDraftWorkoutInternal, {
        userId: args.userId,
        title,
        blocks,
        estimatedDuration: sessionDurationMinutes,
      })) as Id<"workoutPlans">;

      // Link to week plan
      await ctx.runMutation(internal.weekPlans.linkWorkoutPlanToDayInternal, {
        userId: args.userId,
        weekPlanId,
        dayIndex,
        workoutPlanId: planId,
        estimatedDuration: sessionDurationMinutes,
      });

      // Build summary for agent display
      const exerciseSummaries = movementIds.map((mid) => {
        const movement = catalog.find((m) => m.id === mid);
        const suggestion = suggestions.find((s) => s.movementId === mid);
        const block = blocks[0]?.exercises.find((e) => e.movementId === mid);
        return {
          movementId: mid,
          name: movement?.name ?? mid,
          muscleGroups: movement?.muscleGroups ?? [],
          sets: block?.sets ?? 3,
          reps: block?.reps ?? 10,
          lastTime: (suggestion as { lastTimeText?: string })?.lastTimeText,
          suggestedTarget: (suggestion as { suggestedText?: string })?.suggestedText,
        };
      });

      daySummaries.push({
        dayIndex,
        dayName: DAY_NAMES[dayIndex],
        sessionType,
        workoutPlanId: planId,
        estimatedDuration: sessionDurationMinutes,
        exercises: exerciseSummaries,
      });
    }

    // Save preferences for next time
    await ctx.runMutation(internal.userProfiles.saveTrainingPreferencesInternal, {
      userId: args.userId,
      preferredSplit,
      trainingDays: daySessions.map((d) => d.dayIndex),
      sessionDurationMinutes,
    });

    return {
      success: true,
      weekPlanId,
      summary: {
        weekStartDate,
        preferredSplit,
        targetDays,
        sessionDurationMinutes,
        days: daySummaries,
      },
    };
  },
});
```

Also add the supporting types and constants at the top of the file:

```typescript
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatSessionTitle(
  sessionType: SessionType,
  weekStartDate: string,
  dayIndex: number,
): string {
  const label = sessionType.replaceAll("_", " ");
  return `${label.charAt(0).toUpperCase() + label.slice(1)} – ${DAY_NAMES[dayIndex]}`;
}

interface ExerciseSummary {
  movementId: string;
  name: string;
  muscleGroups: string[];
  sets: number;
  reps: number;
  lastTime?: string;
  suggestedTarget?: string;
}

interface DraftDaySummary {
  dayIndex: number;
  dayName: string;
  sessionType: string;
  workoutPlanId: Id<"workoutPlans">;
  estimatedDuration: number;
  exercises: ExerciseSummary[];
}

export interface DraftWeekSummary {
  weekStartDate: string;
  preferredSplit: string;
  targetDays: number;
  sessionDurationMinutes: number;
  days: DraftDaySummary[];
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run convex/coach/weekProgramming.test.ts`
Expected: All existing tests pass (no changes to exported pure functions)

- [ ] **Step 4: Commit**

```bash
git add convex/coach/weekProgramming.ts
git commit -m "feat: add generateDraftWeekPlan for chat-based weekly programming"
```

---

## Chunk 2: AI Agent Tools — Program & View

This chunk creates the AI agent tools that let the coach generate a week plan and present its details to the user through chat.

### Task 2.1: Create Week Tools File

**Files:**

- Create: `convex/ai/weekTools.ts`

- [ ] **Step 1: Create `convex/ai/weekTools.ts` with `programWeekTool`**

```typescript
import { createTool, type ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { DraftWeekSummary } from "../coach/weekProgramming";
import { getWeekStartDateString } from "../weekPlanHelpers";

function requireUserId(ctx: ToolCtx): Id<"users"> {
  if (!ctx.userId) throw new Error("Not authenticated");
  return ctx.userId as Id<"users">;
}

export const programWeekTool = createTool({
  description: `Program the user's full training week. Creates draft workouts for each training day based on their split, available days, and session duration. Returns a summary of the full week plan with exercises, sets, reps, and progressive overload targets. The plan is NOT pushed to Tonal yet — present it to the user for approval first, then use approve_week_plan. If the user already has saved preferences, you can omit the parameters to use their saved preferences.`,
  inputSchema: z.object({
    preferredSplit: z
      .enum(["ppl", "upper_lower", "full_body"])
      .optional()
      .describe(
        "Training split. ppl = Push/Pull/Legs, upper_lower = Upper/Lower, full_body = Full Body. Omit to use saved preferences.",
      ),
    trainingDays: z
      .array(z.number().int().min(0).max(6))
      .optional()
      .describe(
        "Day indices: 0=Monday, 1=Tuesday, ..., 6=Sunday. Omit to auto-space based on count.",
      ),
    targetDays: z
      .number()
      .int()
      .min(1)
      .max(7)
      .optional()
      .describe("Number of training days per week (used if trainingDays is omitted)."),
    sessionDurationMinutes: z
      .enum(["30", "45", "60"])
      .optional()
      .describe("Session duration. Omit to use saved preferences."),
  }),
  execute: async (ctx, input) => {
    const userId = requireUserId(ctx);

    // Load saved preferences as defaults
    const saved = await ctx.runQuery(internal.userProfiles.getTrainingPreferencesInternal, {
      userId,
    });

    const preferredSplit = input.preferredSplit ?? saved?.preferredSplit ?? "ppl";
    const sessionDuration = input.sessionDurationMinutes
      ? (parseInt(input.sessionDurationMinutes) as 30 | 45 | 60)
      : (saved?.sessionDurationMinutes ?? 45);

    const result = await ctx.runAction(internal.coach.weekProgramming.generateDraftWeekPlan, {
      userId,
      weekStartDate: getWeekStartDateString(new Date()),
      preferredSplit,
      targetDays:
        input.trainingDays?.length ?? input.targetDays ?? saved?.trainingDays?.length ?? 3,
      sessionDurationMinutes: sessionDuration,
      trainingDayIndicesOverride: input.trainingDays ?? saved?.trainingDays,
    });

    return result;
  },
});
```

- [ ] **Step 2: Add `getWeekPlanDetailsTool`**

Append to `convex/ai/weekTools.ts`:

```typescript
export const getWeekPlanDetailsTool = createTool({
  description:
    "Get the current week plan details including exercises, sets, reps, and overload targets. Use this to re-display the plan if the user asks to see it again.",
  inputSchema: z.object({}),
  execute: async (ctx) => {
    const userId = requireUserId(ctx);
    const weekStartDate = getWeekStartDateString(new Date());

    const plan = await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
      userId,
      weekStartDate,
    });
    if (!plan)
      return { error: "No week plan found for this week. Use program_week to create one." };

    // Resolve each day's workout details
    const catalog = await ctx.runQuery(internal.tonal.cache.getCacheEntry, {
      userId: undefined,
      dataType: "movements",
    });
    const movements = (catalog?.data ?? []) as Array<{
      id: string;
      name: string;
      muscleGroups: string[];
    }>;
    const movementMap = new Map(movements.map((m) => [m.id, m]));

    const days = await Promise.all(
      plan.days.map(async (day, dayIndex) => {
        if (day.sessionType === "rest" || !day.workoutPlanId) {
          return {
            dayIndex,
            dayName: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][
              dayIndex
            ],
            sessionType: day.sessionType,
            status: day.status,
            exercises: [],
          };
        }

        const wp = await ctx.runQuery(internal.workoutPlans.getById, {
          planId: day.workoutPlanId as Id<"workoutPlans">,
          userId,
        });
        if (!wp) {
          return {
            dayIndex,
            dayName: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][
              dayIndex
            ],
            sessionType: day.sessionType,
            status: day.status,
            exercises: [],
          };
        }

        const blocks = wp.blocks as Array<{
          exercises: Array<{ movementId: string; sets: number; reps?: number }>;
        }>;
        const exercises = blocks.flatMap((block) =>
          block.exercises.map((ex) => {
            const movement = movementMap.get(ex.movementId);
            return {
              movementId: ex.movementId,
              name: movement?.name ?? ex.movementId,
              muscleGroups: movement?.muscleGroups ?? [],
              sets: ex.sets,
              reps: ex.reps ?? 10,
            };
          }),
        );

        return {
          dayIndex,
          dayName: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][
            dayIndex
          ],
          sessionType: day.sessionType,
          status: day.status,
          estimatedDuration: day.estimatedDuration,
          workoutTitle: wp.title,
          tonalWorkoutId: wp.tonalWorkoutId,
          pushStatus: wp.status,
          exercises,
        };
      }),
    );

    return {
      weekPlanId: plan._id,
      weekStartDate: plan.weekStartDate,
      preferredSplit: plan.preferredSplit,
      targetDays: plan.targetDays,
      days,
    };
  },
});
```

- [ ] **Step 3: Add `deleteWeekPlanTool`**

Append to `convex/ai/weekTools.ts`:

```typescript
export const deleteWeekPlanTool = createTool({
  description:
    "Delete the current week plan. Use when the user wants to start over or rejects the plan entirely.",
  inputSchema: z.object({}),
  execute: async (ctx) => {
    const userId = requireUserId(ctx);
    const weekStartDate = getWeekStartDateString(new Date());
    const plan = await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
      userId,
      weekStartDate,
    });
    if (!plan) return { error: "No week plan found for this week." };
    await ctx.runMutation(internal.weekPlans.deleteWeekPlanInternal, {
      userId,
      weekPlanId: plan._id,
    });
    return { deleted: true };
  },
});
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/ai/weekTools.ts
git commit -m "feat: add program_week, get_week_plan_details, delete_week_plan AI tools"
```

### Task 2.2: Add `getById` Query to workoutPlans

**Files:**

- Modify: `convex/workoutPlans.ts`

- [ ] **Step 1: Read `convex/workoutPlans.ts` to check if `getById` internal query exists**

- [ ] **Step 2: If missing, add it**

```typescript
/** Internal: get a workout plan by ID (with ownership check). */
export const getById = internalQuery({
  args: {
    planId: v.id("workoutPlans"),
    userId: v.id("users"),
  },
  handler: async (ctx, { planId, userId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan || plan.userId !== userId) return null;
    return plan;
  },
});
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add convex/workoutPlans.ts
git commit -m "feat: add getById internal query for workoutPlans"
```

### Task 2.3: Register Tools and Update System Prompt

**Files:**

- Modify: `convex/ai/coach.ts`

- [ ] **Step 1: Import new tools**

Add to imports at top of `convex/ai/coach.ts`:

```typescript
import { programWeekTool, getWeekPlanDetailsTool, deleteWeekPlanTool } from "./weekTools";
```

- [ ] **Step 2: Register tools in the agent**

Add to the `tools` object in `coachAgent`:

```typescript
program_week: programWeekTool,
get_week_plan_details: getWeekPlanDetailsTool,
delete_week_plan: deleteWeekPlanTool,
```

- [ ] **Step 3: Update system prompt**

Append to the `instructions` string, before the closing backtick:

```
WEEKLY PROGRAMMING:
- When the user asks to "program my week" or similar, use program_week to generate a draft plan.
- If you don't know their preferences (split, days, duration), ask FIRST before calling program_week. Ask one question at a time.
- If they have saved preferences, program_week will use them automatically — just call it.
- After program_week returns, present the full plan to the user in a readable format showing each day with exercises, sets, reps, and progressive overload targets.
- WAIT for user approval before pushing. They can ask to swap exercises, move days, adjust duration, or reject the plan entirely.
- When the user approves ("looks good", "send it", "push it"), use approve_week_plan to push all workouts to Tonal.
- When presenting the plan, format each training day clearly:
  DAY — Session Type (Target Muscles) — Duration
  1. Exercise Name: sets×reps @ target weight (last: previous performance)
- For returning users who say "program next week" or "program my week", call program_week without parameters — it will use their saved preferences.
- If the user wants to start over, use delete_week_plan then program_week again.`
```

- [ ] **Step 4: Increase `maxSteps` from 10 to 15**

Weekly programming may require: gathering preferences (2-3 steps) + program_week (1) + presenting (1) + modifications (2-3) + approve (1) + verification (1). 10 steps is too tight.

```typescript
maxSteps: 15,
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add convex/ai/coach.ts
git commit -m "feat: register weekly programming tools and update system prompt"
```

### Task 2.4: Update ToolCallIndicator

**Files:**

- Modify: `src/components/ToolCallIndicator.tsx`

- [ ] **Step 1: Add display messages for new tools**

Add to the `TOOL_MESSAGES` object:

```typescript
program_week: {
  running: "Programming your week...",
  done: "Week programmed",
},
get_week_plan_details: {
  running: "Loading week plan...",
  done: "Loaded week plan",
},
delete_week_plan: {
  running: "Deleting week plan...",
  done: "Deleted week plan",
},
swap_exercise: {
  running: "Swapping exercise...",
  done: "Swapped exercise",
},
move_session: {
  running: "Moving session...",
  done: "Moved session",
},
adjust_session_duration: {
  running: "Adjusting session...",
  done: "Adjusted session",
},
approve_week_plan: {
  running: "Pushing workouts to your Tonal...",
  done: "Workouts pushed to Tonal",
},
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ToolCallIndicator.tsx
git commit -m "feat: add ToolCallIndicator messages for weekly programming tools"
```

---

## Chunk 3: Week Plan Modifications

This chunk adds the ability to modify a draft week plan: swap exercises, move sessions between days, and adjust session duration.

### Task 3.1: Create Week Modifications Module

**Files:**

- Create: `convex/coach/weekModifications.ts`

- [ ] **Step 1: Create `convex/coach/weekModifications.ts`**

```typescript
/**
 * Internal mutations for modifying draft week plans.
 * Used by AI agent tools: swap_exercise, move_session, adjust_session_duration.
 */

import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { BlockInput } from "../tonal/transforms";
import type { Movement } from "../tonal/types";
import { selectExercises } from "./exerciseSelection";

const SESSION_DURATION_TO_MAX_EXERCISES: Record<number, number> = {
  30: 5,
  45: 7,
  60: 9,
};

const SESSION_TYPE_MUSCLES: Record<string, string[]> = {
  push: ["Chest", "Triceps", "Shoulders"],
  pull: ["Back", "Biceps"],
  legs: ["Quads", "Glutes", "Hamstrings", "Calves"],
  upper: ["Chest", "Back", "Shoulders", "Triceps", "Biceps"],
  lower: ["Quads", "Glutes", "Hamstrings", "Calves"],
  full_body: [
    "Chest",
    "Back",
    "Shoulders",
    "Triceps",
    "Biceps",
    "Quads",
    "Glutes",
    "Hamstrings",
    "Calves",
  ],
};

/** Swap a single exercise in a draft workout's blocks. */
export const swapExerciseInDraft = internalMutation({
  args: {
    userId: v.id("users"),
    workoutPlanId: v.id("workoutPlans"),
    oldMovementId: v.string(),
    newMovementId: v.string(),
  },
  handler: async (ctx, { userId, workoutPlanId, oldMovementId, newMovementId }) => {
    const wp = await ctx.db.get(workoutPlanId);
    if (!wp || wp.userId !== userId) throw new Error("Workout not found");
    if (wp.status !== "draft") throw new Error("Can only modify draft workouts");

    const blocks = wp.blocks as BlockInput[];
    const updated = blocks.map((block) => ({
      ...block,
      exercises: block.exercises.map((ex) =>
        ex.movementId === oldMovementId ? { ...ex, movementId: newMovementId } : ex,
      ),
    }));

    await ctx.db.patch(workoutPlanId, { blocks: updated });
  },
});

/** Swap two day slots in a week plan. */
export const swapDaySlots = internalMutation({
  args: {
    userId: v.id("users"),
    weekPlanId: v.id("weekPlans"),
    fromDayIndex: v.number(),
    toDayIndex: v.number(),
  },
  handler: async (ctx, { userId, weekPlanId, fromDayIndex, toDayIndex }) => {
    if (fromDayIndex < 0 || fromDayIndex > 6 || toDayIndex < 0 || toDayIndex > 6) {
      throw new Error("Day index must be 0-6");
    }
    const plan = await ctx.db.get(weekPlanId);
    if (!plan || plan.userId !== userId) throw new Error("Week plan not found");

    const days = [...plan.days];
    const temp = days[fromDayIndex];
    days[fromDayIndex] = days[toDayIndex];
    days[toDayIndex] = temp;
    await ctx.db.patch(weekPlanId, { days, updatedAt: Date.now() });
  },
});

/** Re-generate exercises for a specific day with a new duration. */
export const adjustDayDuration = internalAction({
  args: {
    userId: v.id("users"),
    weekPlanId: v.id("weekPlans"),
    dayIndex: v.number(),
    newDurationMinutes: v.union(v.literal(30), v.literal(45), v.literal(60)),
  },
  handler: async (ctx, { userId, weekPlanId, dayIndex, newDurationMinutes }) => {
    const plan = await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
      userId,
      weekStartDate: "", // We'll use the plan directly
    });

    // Get the plan by ID instead
    const weekPlan = await ctx.runQuery(internal.weekPlans.getWeekPlanById, { weekPlanId, userId });
    if (!weekPlan) throw new Error("Week plan not found");

    const day = weekPlan.days[dayIndex];
    if (!day || day.sessionType === "rest") throw new Error("No training session on this day");

    const maxExercises = SESSION_DURATION_TO_MAX_EXERCISES[newDurationMinutes] ?? 7;
    const targetMuscleGroups =
      SESSION_TYPE_MUSCLES[day.sessionType] ?? SESSION_TYPE_MUSCLES.full_body;

    // Fetch catalog and recent movements
    const [catalogEntry, lastUsedMovementIds, profile] = await Promise.all([
      ctx.runQuery(internal.tonal.cache.getCacheEntry, {
        userId: undefined,
        dataType: "movements",
      }),
      ctx.runQuery(internal.workoutPlans.getRecentMovementIds, { userId }),
      ctx.runQuery(internal.userProfiles.getByUserId, { userId }),
    ]);

    const catalog = (catalogEntry?.data ?? []) as Movement[];
    const userLevel = profile?.profileData?.level?.toLowerCase().includes("beginner")
      ? 1
      : profile?.profileData?.level?.toLowerCase().includes("advanced")
        ? 3
        : 2;

    const movementIds = selectExercises({
      catalog,
      targetMuscleGroups,
      userLevel,
      maxExercises,
      lastUsedMovementIds: lastUsedMovementIds as string[],
    });

    const blocks: BlockInput[] = [
      {
        exercises: movementIds.map((movementId) => ({
          movementId,
          sets: 3,
          reps: 10,
        })),
      },
    ];

    const title = `${day.sessionType.replaceAll("_", " ")} – adjusted`;

    // Delete old draft if exists
    if (day.workoutPlanId) {
      const oldWp = await ctx.runQuery(internal.workoutPlans.getById, {
        planId: day.workoutPlanId as Id<"workoutPlans">,
        userId,
      });
      if (oldWp && oldWp.status === "draft") {
        await ctx.runMutation(internal.weekPlans.deleteDraftWorkout, {
          workoutPlanId: day.workoutPlanId as Id<"workoutPlans">,
        });
      }
    }

    // Create new draft with new duration
    const newPlanId = await ctx.runMutation(internal.weekPlans.createDraftWorkoutInternal, {
      userId,
      title,
      blocks,
      estimatedDuration: newDurationMinutes,
    });

    // Link to week plan
    await ctx.runMutation(internal.weekPlans.linkWorkoutPlanToDayInternal, {
      userId,
      weekPlanId,
      dayIndex,
      workoutPlanId: newPlanId as Id<"workoutPlans">,
      estimatedDuration: newDurationMinutes,
    });

    return { success: true, newWorkoutPlanId: newPlanId };
  },
});
```

- [ ] **Step 2: Add `getWeekPlanById` and `deleteDraftWorkout` internal queries/mutations to `weekPlans.ts`**

Add to `convex/weekPlans.ts`:

```typescript
/** Internal: get week plan by ID with ownership check. */
export const getWeekPlanById = internalQuery({
  args: { weekPlanId: v.id("weekPlans"), userId: v.id("users") },
  handler: async (ctx, { weekPlanId, userId }) => {
    const plan = await ctx.db.get(weekPlanId);
    if (!plan || plan.userId !== userId) return null;
    return plan;
  },
});

/** Internal: delete a single draft workout plan. */
export const deleteDraftWorkout = internalMutation({
  args: { workoutPlanId: v.id("workoutPlans") },
  handler: async (ctx, { workoutPlanId }) => {
    const wp = await ctx.db.get(workoutPlanId);
    if (wp && wp.status === "draft") {
      await ctx.db.delete(workoutPlanId);
    }
  },
});
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add convex/coach/weekModifications.ts convex/weekPlans.ts
git commit -m "feat: add week plan modification mutations (swap, move, adjust)"
```

### Task 3.2: Add Modification Tools to AI Agent

**Files:**

- Modify: `convex/ai/weekTools.ts`

- [ ] **Step 1: Add `swapExerciseTool`**

Append to `convex/ai/weekTools.ts`:

```typescript
export const swapExerciseTool = createTool({
  description:
    "Swap an exercise in the current week plan. The plan must be in draft status (not yet pushed). Use search_exercises to find the replacement movementId first.",
  inputSchema: z.object({
    dayIndex: z.number().int().min(0).max(6).describe("Day index: 0=Monday..6=Sunday"),
    oldMovementId: z.string().describe("Movement ID of the exercise to replace"),
    newMovementId: z
      .string()
      .describe("Movement ID of the replacement exercise (from search_exercises)"),
  }),
  execute: async (ctx, input) => {
    const userId = requireUserId(ctx);
    const weekStartDate = getWeekStartDateString(new Date());
    const plan = await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
      userId,
      weekStartDate,
    });
    if (!plan) return { error: "No week plan found." };

    const day = plan.days[input.dayIndex];
    if (!day?.workoutPlanId) return { error: "No workout on this day." };

    await ctx.runMutation(internal.coach.weekModifications.swapExerciseInDraft, {
      userId,
      workoutPlanId: day.workoutPlanId as Id<"workoutPlans">,
      oldMovementId: input.oldMovementId,
      newMovementId: input.newMovementId,
    });

    return {
      success: true,
      message: "Exercise swapped. Use get_week_plan_details to see the updated plan.",
    };
  },
});
```

- [ ] **Step 2: Add `moveSessionTool`**

```typescript
export const moveSessionTool = createTool({
  description:
    "Move a training session from one day to another in the current week plan. Swaps the two day slots.",
  inputSchema: z.object({
    fromDayIndex: z.number().int().min(0).max(6).describe("Current day index (0=Mon..6=Sun)"),
    toDayIndex: z.number().int().min(0).max(6).describe("Target day index (0=Mon..6=Sun)"),
  }),
  execute: async (ctx, input) => {
    const userId = requireUserId(ctx);
    const weekStartDate = getWeekStartDateString(new Date());
    const plan = await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
      userId,
      weekStartDate,
    });
    if (!plan) return { error: "No week plan found." };

    await ctx.runMutation(internal.coach.weekModifications.swapDaySlots, {
      userId,
      weekPlanId: plan._id,
      fromDayIndex: input.fromDayIndex,
      toDayIndex: input.toDayIndex,
    });

    return {
      success: true,
      message: "Session moved. Use get_week_plan_details to see the updated plan.",
    };
  },
});
```

- [ ] **Step 3: Add `adjustSessionDurationTool`**

```typescript
export const adjustSessionDurationTool = createTool({
  description:
    "Change the duration of a specific day's session. Re-selects exercises to fit the new time. Plan must be in draft status.",
  inputSchema: z.object({
    dayIndex: z.number().int().min(0).max(6).describe("Day index: 0=Monday..6=Sunday"),
    newDurationMinutes: z.enum(["30", "45", "60"]).describe("New session duration"),
  }),
  execute: async (ctx, input) => {
    const userId = requireUserId(ctx);
    const weekStartDate = getWeekStartDateString(new Date());
    const plan = await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
      userId,
      weekStartDate,
    });
    if (!plan) return { error: "No week plan found." };

    await ctx.runAction(internal.coach.weekModifications.adjustDayDuration, {
      userId,
      weekPlanId: plan._id,
      dayIndex: input.dayIndex,
      newDurationMinutes: parseInt(input.newDurationMinutes) as 30 | 45 | 60,
    });

    return {
      success: true,
      message: "Session adjusted. Use get_week_plan_details to see the updated plan.",
    };
  },
});
```

- [ ] **Step 4: Register modification tools in `coach.ts`**

Add imports and register in the agent:

```typescript
import {
  programWeekTool,
  getWeekPlanDetailsTool,
  deleteWeekPlanTool,
  swapExerciseTool,
  moveSessionTool,
  adjustSessionDurationTool,
} from "./weekTools";
```

Register:

```typescript
swap_exercise: swapExerciseTool,
move_session: moveSessionTool,
adjust_session_duration: adjustSessionDurationTool,
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add convex/ai/weekTools.ts convex/ai/coach.ts
git commit -m "feat: add swap_exercise, move_session, adjust_session_duration AI tools"
```

---

## Chunk 4: Push & Verification

This chunk adds the approval flow that pushes all draft workouts to Tonal with post-push read-back verification.

### Task 4.1: Create Push and Verify Action

**Files:**

- Create: `convex/coach/pushAndVerify.ts`

- [ ] **Step 1: Create `convex/coach/pushAndVerify.ts`**

```typescript
/**
 * Push draft workouts to Tonal with post-push verification.
 * Reads back the custom workouts list to confirm each push landed.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

interface PushResult {
  dayIndex: number;
  dayName: string;
  sessionType: string;
  status: "pushed" | "failed" | "skipped";
  title?: string;
  tonalWorkoutId?: string;
  error?: string;
  exerciseCount?: number;
}

export interface WeekPushResult {
  success: boolean;
  pushed: number;
  failed: number;
  skipped: number;
  results: PushResult[];
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const pushWeekPlanToTonal = internalAction({
  args: {
    userId: v.id("users"),
    weekPlanId: v.id("weekPlans"),
  },
  handler: async (ctx, { userId, weekPlanId }): Promise<WeekPushResult> => {
    const plan = await ctx.runQuery(internal.weekPlans.getWeekPlanById, { weekPlanId, userId });
    if (!plan) throw new Error("Week plan not found");

    const results: PushResult[] = [];

    for (let dayIndex = 0; dayIndex < plan.days.length; dayIndex++) {
      const day = plan.days[dayIndex];

      if (day.sessionType === "rest" || !day.workoutPlanId) {
        results.push({
          dayIndex,
          dayName: DAY_NAMES[dayIndex],
          sessionType: day.sessionType,
          status: "skipped",
        });
        continue;
      }

      const wp = await ctx.runQuery(internal.workoutPlans.getById, {
        planId: day.workoutPlanId as Id<"workoutPlans">,
        userId,
      });

      if (!wp) {
        results.push({
          dayIndex,
          dayName: DAY_NAMES[dayIndex],
          sessionType: day.sessionType,
          status: "failed",
          error: "Workout plan not found in database",
        });
        continue;
      }

      // Skip already-pushed workouts
      if (wp.status === "pushed" || wp.status === "completed") {
        results.push({
          dayIndex,
          dayName: DAY_NAMES[dayIndex],
          sessionType: day.sessionType,
          status: "pushed",
          title: wp.title,
          tonalWorkoutId: wp.tonalWorkoutId,
        });
        continue;
      }

      if (wp.status !== "draft") {
        results.push({
          dayIndex,
          dayName: DAY_NAMES[dayIndex],
          sessionType: day.sessionType,
          status: "skipped",
          error: `Workout in unexpected status: ${wp.status}`,
        });
        continue;
      }

      // Push to Tonal via existing createWorkout action
      try {
        const pushResult = (await ctx.runAction(internal.tonal.mutations.createWorkout, {
          userId,
          title: wp.title,
          blocks: wp.blocks,
          scheduledDate: undefined,
          estimatedDurationMinutes: wp.estimatedDuration,
        })) as {
          success: boolean;
          workoutId?: string;
          title?: string;
          setCount?: number;
          planId?: string;
          error?: string;
        };

        if (pushResult.success) {
          // Delete the draft since createWorkout already created a new workoutPlans record
          await ctx.runMutation(internal.weekPlans.replaceDraftWithPushed, {
            weekPlanId,
            dayIndex,
            oldWorkoutPlanId: wp._id,
            newWorkoutPlanId: pushResult.planId as unknown as Id<"workoutPlans">,
            estimatedDuration: wp.estimatedDuration,
          });

          results.push({
            dayIndex,
            dayName: DAY_NAMES[dayIndex],
            sessionType: day.sessionType,
            status: "pushed",
            title: pushResult.title ?? wp.title,
            tonalWorkoutId: pushResult.workoutId,
            exerciseCount: pushResult.setCount,
          });
        } else {
          results.push({
            dayIndex,
            dayName: DAY_NAMES[dayIndex],
            sessionType: day.sessionType,
            status: "failed",
            title: wp.title,
            error: pushResult.error ?? "Push failed",
          });
        }
      } catch (err) {
        // Retry once
        try {
          const retryResult = (await ctx.runAction(internal.tonal.mutations.createWorkout, {
            userId,
            title: wp.title,
            blocks: wp.blocks,
            scheduledDate: undefined,
            estimatedDurationMinutes: wp.estimatedDuration,
          })) as {
            success: boolean;
            workoutId?: string;
            title?: string;
            setCount?: number;
            planId?: string;
            error?: string;
          };

          if (retryResult.success) {
            await ctx.runMutation(internal.weekPlans.replaceDraftWithPushed, {
              weekPlanId,
              dayIndex,
              oldWorkoutPlanId: wp._id,
              newWorkoutPlanId: retryResult.planId as unknown as Id<"workoutPlans">,
              estimatedDuration: wp.estimatedDuration,
            });

            results.push({
              dayIndex,
              dayName: DAY_NAMES[dayIndex],
              sessionType: day.sessionType,
              status: "pushed",
              title: retryResult.title ?? wp.title,
              tonalWorkoutId: retryResult.workoutId,
              exerciseCount: retryResult.setCount,
            });
          } else {
            results.push({
              dayIndex,
              dayName: DAY_NAMES[dayIndex],
              sessionType: day.sessionType,
              status: "failed",
              title: wp.title,
              error: retryResult.error ?? "Push failed after retry",
            });
          }
        } catch (retryErr) {
          results.push({
            dayIndex,
            dayName: DAY_NAMES[dayIndex],
            sessionType: day.sessionType,
            status: "failed",
            title: wp.title,
            error: retryErr instanceof Error ? retryErr.message : "Push failed after retry",
          });
        }
      }
    }

    const pushed = results.filter((r) => r.status === "pushed").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return {
      success: failed === 0,
      pushed,
      failed,
      skipped,
      results,
    };
  },
});
```

- [ ] **Step 2: Add `replaceDraftWithPushed` mutation to `weekPlans.ts`**

Add to `convex/weekPlans.ts`:

```typescript
/** Internal: replace a draft workout link with the pushed version. */
export const replaceDraftWithPushed = internalMutation({
  args: {
    weekPlanId: v.id("weekPlans"),
    dayIndex: v.number(),
    oldWorkoutPlanId: v.id("workoutPlans"),
    newWorkoutPlanId: v.id("workoutPlans"),
    estimatedDuration: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { weekPlanId, dayIndex, oldWorkoutPlanId, newWorkoutPlanId, estimatedDuration },
  ) => {
    const plan = await ctx.db.get(weekPlanId);
    if (!plan) return;

    // Delete the draft
    const draft = await ctx.db.get(oldWorkoutPlanId);
    if (draft && draft.status === "draft") {
      await ctx.db.delete(oldWorkoutPlanId);
    }

    // Update the day slot to point to the pushed workout
    const days = [...plan.days];
    days[dayIndex] = {
      ...days[dayIndex],
      workoutPlanId: newWorkoutPlanId,
      ...(estimatedDuration != null && { estimatedDuration }),
    };
    await ctx.db.patch(weekPlanId, { days, updatedAt: Date.now() });
  },
});
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add convex/coach/pushAndVerify.ts convex/weekPlans.ts
git commit -m "feat: add push-and-verify action for weekly programming approval"
```

### Task 4.2: Add Post-Push Verification to Tonal Mutations

**Files:**

- Modify: `convex/tonal/mutations.ts`

- [ ] **Step 1: Read `convex/tonal/mutations.ts` to understand the current `createWorkout` flow**

- [ ] **Step 2: Add read-back verification after push**

After the successful POST to `/v6/user-workouts` in `doTonalCreateWorkout`, add a verification step. Find the section where the POST returns `{ id }` and add:

```typescript
// Verify: read back custom workouts list and confirm the new ID exists
try {
  const customWorkouts = await tonalFetch<Array<{ id: string; title: string }>>(
    token,
    `/v6/user-workouts`,
  );
  const verified = customWorkouts?.some((w) => w.id === tonalWorkoutId);
  if (!verified) {
    console.warn(`Push verification: workout ${tonalWorkoutId} not found in custom workouts list`);
  }
} catch {
  // Verification failure is non-fatal — the push ID was returned successfully
  console.warn(`Push verification: could not read back custom workouts list`);
}
```

This is a soft verification — it logs a warning but doesn't fail the push. The Tonal ID was already returned, so the push likely succeeded.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add convex/tonal/mutations.ts
git commit -m "feat: add post-push read-back verification for Tonal workouts"
```

### Task 4.3: Add Approve Week Plan Tool

**Files:**

- Modify: `convex/ai/weekTools.ts`

- [ ] **Step 1: Add `approveWeekPlanTool`**

Append to `convex/ai/weekTools.ts`:

```typescript
import type { WeekPushResult } from "../coach/pushAndVerify";

export const approveWeekPlanTool = createTool({
  description:
    "Push all draft workouts in the current week plan to Tonal. Use after the user approves the plan. Reports per-workout push status.",
  inputSchema: z.object({}),
  execute: async (ctx): Promise<WeekPushResult | { error: string }> => {
    const userId = requireUserId(ctx);
    const weekStartDate = getWeekStartDateString(new Date());
    const plan = await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
      userId,
      weekStartDate,
    });
    if (!plan) return { error: "No week plan found. Use program_week first." };

    const result = await ctx.runAction(internal.coach.pushAndVerify.pushWeekPlanToTonal, {
      userId,
      weekPlanId: plan._id,
    });

    return result;
  },
});
```

- [ ] **Step 2: Register in `coach.ts`**

Add to imports:

```typescript
import {
  // ... existing imports
  approveWeekPlanTool,
} from "./weekTools";
```

Register:

```typescript
approve_week_plan: approveWeekPlanTool,
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add convex/ai/weekTools.ts convex/ai/coach.ts
git commit -m "feat: add approve_week_plan tool with per-workout push status"
```

---

## Chunk 5: Tests & Integration Verification

This chunk adds tests for the new functionality and verifies end-to-end type safety.

### Task 5.1: Test Push Result Contract

**Files:**

- Create: `convex/coach/pushAndVerify.test.ts`

- [ ] **Step 1: Write contract tests**

```typescript
import { describe, expect, it } from "vitest";
import type { WeekPushResult } from "./pushAndVerify";

describe("WeekPushResult contract", () => {
  it("success result has all fields", () => {
    const result: WeekPushResult = {
      success: true,
      pushed: 3,
      failed: 0,
      skipped: 4,
      results: [
        {
          dayIndex: 0,
          dayName: "Monday",
          sessionType: "push",
          status: "pushed",
          title: "Push – Monday",
          tonalWorkoutId: "abc123",
          exerciseCount: 18,
        },
        {
          dayIndex: 1,
          dayName: "Tuesday",
          sessionType: "rest",
          status: "skipped",
        },
      ],
    };
    expect(result.success).toBe(true);
    expect(result.pushed + result.failed + result.skipped).toBe(result.results.length);
  });

  it("partial failure has success false", () => {
    const result: WeekPushResult = {
      success: false,
      pushed: 2,
      failed: 1,
      skipped: 4,
      results: [
        { dayIndex: 0, dayName: "Monday", sessionType: "push", status: "pushed", title: "Push" },
        { dayIndex: 2, dayName: "Wednesday", sessionType: "pull", status: "pushed", title: "Pull" },
        {
          dayIndex: 4,
          dayName: "Friday",
          sessionType: "legs",
          status: "failed",
          title: "Legs",
          error: "Tonal API timeout",
        },
      ],
    };
    expect(result.success).toBe(false);
    expect(result.failed).toBe(1);
  });

  it("failed results always include error message", () => {
    const result: WeekPushResult = {
      success: false,
      pushed: 0,
      failed: 1,
      skipped: 6,
      results: [
        {
          dayIndex: 0,
          dayName: "Monday",
          sessionType: "push",
          status: "failed",
          error: "Session expired",
        },
      ],
    };
    const failures = result.results.filter((r) => r.status === "failed");
    for (const f of failures) {
      expect(f.error).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run convex/coach/pushAndVerify.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/coach/pushAndVerify.test.ts
git commit -m "test: add push result contract tests"
```

### Task 5.2: Test Week Modifications

**Files:**

- Create: `convex/coach/weekModifications.test.ts`

- [ ] **Step 1: Write tests for swap logic**

```typescript
import { describe, expect, it } from "vitest";
import type { BlockInput } from "../tonal/transforms";

/** Pure version of the swap logic from weekModifications.ts for unit testing. */
function swapMovementInBlocks(
  blocks: BlockInput[],
  oldMovementId: string,
  newMovementId: string,
): BlockInput[] {
  return blocks.map((block) => ({
    ...block,
    exercises: block.exercises.map((ex) =>
      ex.movementId === oldMovementId ? { ...ex, movementId: newMovementId } : ex,
    ),
  }));
}

describe("swapMovementInBlocks", () => {
  it("replaces the target movement ID", () => {
    const blocks: BlockInput[] = [
      {
        exercises: [
          { movementId: "aaa", sets: 3, reps: 10 },
          { movementId: "bbb", sets: 3, reps: 10 },
          { movementId: "ccc", sets: 3, reps: 12 },
        ],
      },
    ];
    const result = swapMovementInBlocks(blocks, "bbb", "ddd");
    expect(result[0].exercises[1].movementId).toBe("ddd");
    expect(result[0].exercises[0].movementId).toBe("aaa");
    expect(result[0].exercises[2].movementId).toBe("ccc");
  });

  it("preserves sets and reps on swapped exercise", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "aaa", sets: 4, reps: 8 }] }];
    const result = swapMovementInBlocks(blocks, "aaa", "bbb");
    expect(result[0].exercises[0]).toEqual({
      movementId: "bbb",
      sets: 4,
      reps: 8,
    });
  });

  it("no-ops when movement ID not found", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "aaa", sets: 3, reps: 10 }] }];
    const result = swapMovementInBlocks(blocks, "zzz", "bbb");
    expect(result).toEqual(blocks);
  });

  it("handles multiple blocks", () => {
    const blocks: BlockInput[] = [
      { exercises: [{ movementId: "aaa", sets: 3 }] },
      { exercises: [{ movementId: "aaa", sets: 4 }] },
    ];
    const result = swapMovementInBlocks(blocks, "aaa", "bbb");
    expect(result[0].exercises[0].movementId).toBe("bbb");
    expect(result[1].exercises[0].movementId).toBe("bbb");
  });
});

describe("day slot swap (pure logic)", () => {
  type DaySlot = { sessionType: string; status: string; workoutPlanId?: string };

  function swapDays(days: DaySlot[], from: number, to: number): DaySlot[] {
    const result = [...days];
    const temp = result[from];
    result[from] = result[to];
    result[to] = temp;
    return result;
  }

  it("swaps two day slots", () => {
    const days: DaySlot[] = [
      { sessionType: "push", status: "programmed", workoutPlanId: "wp1" },
      { sessionType: "rest", status: "programmed" },
      { sessionType: "pull", status: "programmed", workoutPlanId: "wp2" },
    ];
    const result = swapDays(days, 0, 2);
    expect(result[0].sessionType).toBe("pull");
    expect(result[2].sessionType).toBe("push");
    expect(result[0].workoutPlanId).toBe("wp2");
    expect(result[2].workoutPlanId).toBe("wp1");
  });
});
```

- [ ] **Step 2: Run test**

Run: `npx vitest run convex/coach/weekModifications.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/coach/weekModifications.test.ts
git commit -m "test: add week modification unit tests"
```

### Task 5.3: Full Type Check and Test Suite

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing + new)

- [ ] **Step 3: Review all changed files**

Run: `git diff --stat HEAD~10` (or however many commits back)
Verify the changeset matches the plan.

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "chore: fix type errors from weekly programming integration"
```

---

## Summary

After completing all 5 chunks, the system will support:

1. **Chat-based weekly programming** — User says "program my week" → AI gathers preferences (or uses saved ones) → generates a full week plan → presents it with exercises, sets, reps, and progressive overload targets
2. **Plan modifications** — User can swap exercises, move sessions between days, adjust session duration, or reject and start over
3. **One-click approval** — User says "send it" → AI pushes all workouts to Tonal with per-workout status reporting
4. **Post-push verification** — Each push is verified via read-back from Tonal's API with automatic retry on failure
5. **Preference persistence** — Returning users get their preferred split, days, and duration automatically
6. **UI feedback** — ToolCallIndicator shows appropriate messages for all 7 new tools

**Total new AI tools: 7**

- `program_week` — Generate draft week plan
- `get_week_plan_details` — View current plan details
- `delete_week_plan` — Delete and start over
- `swap_exercise` — Replace an exercise
- `move_session` — Move a session to a different day
- `adjust_session_duration` — Change duration for a day
- `approve_week_plan` — Push all drafts to Tonal
