# Schedule Resilience & Push Error Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the schedule page resilient to Tonal API failures, and surface actionable error details when workout pushes fail.

**Architecture:** Two independent fixes. Fix 1 wraps the Tonal activity sync in `weekPlanEnriched.ts` with a try/catch so schedule rendering never depends on Tonal uptime. Fix 2 enriches error messages in the workout push pipeline (`mutations.ts`) and adds coach prompt guidance for handling push failures.

**Tech Stack:** Convex actions, Vitest

---

### Task 1: Make `getWeekPlanEnriched` resilient to activity sync failures

**Files:**

- Modify: `convex/weekPlanEnriched.ts:154-158`
- Create: `convex/weekPlanEnriched.test.ts`

- [ ] **Step 1: Write the failing test**

Create `convex/weekPlanEnriched.test.ts`:

```ts
import { describe, expect, it } from "vitest";

// The action handler is not directly unit-testable (it depends on ActionCtx),
// but we can extract the resilience logic into a testable helper.
// For now, test the extracted helper: safeActivities.

import { safeActivities } from "./weekPlanEnriched";
import type { Activity } from "./tonal/types";

describe("safeActivities", () => {
  it("returns activities on success", async () => {
    const mockActivities: Activity[] = [
      {
        activityId: "a1",
        activityTime: "2026-04-01T10:00:00Z",
        workoutPreview: { workoutId: "w1", workoutTitle: "Push Day" },
      } as Activity,
    ];
    const fetcher = async () => mockActivities;

    const result = await safeActivities(fetcher);

    expect(result).toEqual(mockActivities);
  });

  it("returns empty array and logs when fetcher throws", async () => {
    const fetcher = async (): Promise<Activity[]> => {
      throw new Error("Tonal API 500: Internal Server Error");
    };

    const result = await safeActivities(fetcher);

    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run convex/weekPlanEnriched.test.ts`
Expected: FAIL with "safeActivities is not exported" or similar

- [ ] **Step 3: Extract `safeActivities` helper and wrap the fetch call**

In `convex/weekPlanEnriched.ts`, add this exported helper before the `getWeekPlanEnriched` action:

```ts
/**
 * Attempt to fetch activities; return empty array on failure.
 * The schedule should render even when Tonal's API is down.
 */
export async function safeActivities(fetcher: () => Promise<Activity[]>): Promise<Activity[]> {
  try {
    return await fetcher();
  } catch (err) {
    console.error(
      "[weekPlanEnriched] Activity sync failed, showing schedule without completion data:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
```

Then replace lines 154-158 in the action handler:

```ts
// 4. Fetch recent activities from Tonal to check completion
const activities = await safeActivities(
  () =>
    ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
      userId,
      limit: 20,
    }) as Promise<Activity[]>,
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run convex/weekPlanEnriched.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add convex/weekPlanEnriched.ts convex/weekPlanEnriched.test.ts
git commit -m "fix: make schedule resilient to Tonal activity sync failures"
```

---

### Task 2: Enhance `doTonalCreateWorkout` error messages with movement context

**Files:**

- Modify: `convex/tonal/mutations.ts:86-90`
- Modify: `convex/tonal/mutations.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `convex/tonal/mutations.test.ts`:

```ts
import { enrichPushErrorMessage } from "./mutations";

describe("enrichPushErrorMessage", () => {
  it("includes title and movement IDs in the enriched message", () => {
    const result = enrichPushErrorMessage(
      "Tonal API 500: Internal Server Error",
      "Push Day - Monday",
      ["move-abc", "move-def", "move-ghi"],
    );

    expect(result).toContain("Push Day - Monday");
    expect(result).toContain("move-abc");
    expect(result).toContain("move-def");
    expect(result).toContain("move-ghi");
    expect(result).toContain("Tonal API 500");
  });

  it("includes all unique movement IDs", () => {
    const result = enrichPushErrorMessage("error", "Legs", ["m1", "m2", "m1"]);

    // Should deduplicate
    expect(result).toContain("m1");
    expect(result).toContain("m2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run convex/tonal/mutations.test.ts`
Expected: FAIL with "enrichPushErrorMessage is not exported"

- [ ] **Step 3: Add `enrichPushErrorMessage` helper and use it in the retry loop**

Add this exported function to `convex/tonal/mutations.ts` (after the `correctDurationRepsMismatch` function, before `doTonalCreateWorkout`):

```ts
/** Build an error message that includes workout context for debugging push failures. */
export function enrichPushErrorMessage(
  originalError: string,
  title: string,
  movementIds: string[],
): string {
  const unique = [...new Set(movementIds)];
  return `Push failed for "${title}" (movements: ${unique.join(", ")}). Tonal error: ${originalError}`;
}
```

Then in `doTonalCreateWorkout`, replace the error handling in the retry loop (lines 86-90):

```ts
        } catch (err) {
          const is5xx = err instanceof TonalApiError && err.status >= 500;
          if (!is5xx || attempt >= MAX_RETRIES) {
            console.error(`createWorkout payload that failed:`, JSON.stringify(payload, null, 2));
            const movementIds = sets.map((s) => s.movementId as string);
            const errMsg = err instanceof Error ? err.message : String(err);
            throw new Error(enrichPushErrorMessage(errMsg, title, movementIds));
          }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run convex/tonal/mutations.test.ts`
Expected: PASS (all existing tests + new test)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add convex/tonal/mutations.ts convex/tonal/mutations.test.ts
git commit -m "fix: include movement context in workout push error messages"
```

---

### Task 3: Add coach prompt guidance for handling push failures

**Files:**

- Modify: `convex/ai/promptSections.ts:270-273`

- [ ] **Step 1: Update the error recovery example in `conversationPacing`**

In `convex/ai/promptSections.ts`, replace the existing error recovery section (lines 270-273):

```ts
Error recovery:
  User: "Push it to Tonal"
  Coach: (one workout fails)
  Coach: "Monday and Wednesday pushed fine. Friday had an issue — one exercise wasn't found. Swapping and retrying... Done. All three on your Tonal."
```

With this expanded guidance:

```ts
Error recovery:
  User: "Push it to Tonal"
  Coach: (one workout fails with movement ID error)
  Coach: "Monday and Wednesday pushed fine. Friday had an issue — one exercise wasn't found. Swapping and retrying... Done. All three on your Tonal."

  Coach: (push fails with 500/server error mentioning specific movements)
  Coach: "Monday and Wednesday are on your Tonal. Friday's push failed — looks like [Exercise Name] may have hit a hardware limit. Want me to swap it for a similar exercise and retry, or adjust the workout?"

When a push fails with a server error (500):
- Tell the user which day/workout failed.
- If the error mentions movement IDs, identify the exercise names and suggest swapping or removing the problematic one.
- Offer to retry after making changes. Do not silently retry the same payload.
- If multiple days fail, report all failures before asking what to do.
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add convex/ai/promptSections.ts
git commit -m "feat: add coach guidance for handling workout push failures"
```

---

### Task 4: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all backend tests**

Run: `npx vitest --project backend`
Expected: All tests pass

- [ ] **Step 2: Run all frontend tests**

Run: `npx vitest --project frontend`
Expected: All tests pass

- [ ] **Step 3: Final type-check**

Run: `npx tsc --noEmit`
Expected: No errors
