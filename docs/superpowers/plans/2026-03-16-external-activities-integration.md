# External Activities Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface Apple Watch / HealthKit external activities in the AI coach training snapshot and dashboard so the coach can make recovery-aware programming decisions and users see their full activity history.

**Architecture:** New `ExternalActivity` type + proxy action for the dedicated `/v6/users/{id}/external-activities` endpoint. Training snapshot in `context.ts` renders recent external activities with HR intensity labels. Dashboard gets a new "Other Activities" section below Tonal workouts. No schema migrations — all API-passthrough data.

**Tech Stack:** Convex (actions, queries), TypeScript, React, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-03-16-external-activities-integration-design.md`

---

### Task 1: Add ExternalActivity type and update Activity type

**Files:**

- Modify: `convex/tonal/types.ts:82-105`

- [ ] **Step 1: Add ExternalActivity interface**

After the `MuscleReadiness` interface (line 80), add:

```ts
// External activity from GET /v6/users/{userId}/external-activities
export interface ExternalActivity {
  id: string;
  userId: string;
  workoutType: string;
  beginTime: string;
  endTime: string;
  timezone: string;
  activeDuration: number;
  totalDuration: number;
  distance: number;
  activeCalories: number;
  totalCalories: number;
  averageHeartRate: number;
  source: string;
  externalId: string;
  deviceId: string;
}
```

- [ ] **Step 2: Add optional fields to Activity.workoutPreview**

In the `Activity` interface, add two optional fields after `activityType: string;` (line 103):

```ts
    source?: string;
    externalWorkoutType?: string;
```

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS (additive changes only)

- [ ] **Step 4: Commit**

```bash
git add convex/tonal/types.ts
git commit -m "feat: add ExternalActivity type and optional source fields to Activity"
```

---

### Task 2: Add fetchExternalActivities proxy action

**Files:**

- Modify: `convex/tonal/proxy.ts` (insert after `fetchCustomWorkouts`, line 229)

- [ ] **Step 1: Add the import**

Add `ExternalActivity` to the existing type import at the top of `convex/tonal/proxy.ts` (line 10-20). The import block already imports from `./types` — just add `ExternalActivity` to the list.

- [ ] **Step 2: Add the proxy action**

After `fetchCustomWorkouts` (line 229), add:

```ts
export const fetchExternalActivities = internalAction({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 20 }): Promise<ExternalActivity[]> =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<ExternalActivity[]>(ctx, {
        userId,
        dataType: `externalActivities:${limit}`,
        ttl: CACHE_TTLS.workoutHistory,
        fetcher: () =>
          tonalFetch<ExternalActivity[]>(
            token,
            `/v6/users/${tonalUserId}/external-activities?limit=${limit}`,
          ),
      }),
    ),
});
```

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add convex/tonal/proxy.ts
git commit -m "feat: add fetchExternalActivities proxy action"
```

---

### Task 3: Update isTonalWorkout and add dashboard action

**Files:**

- Modify: `convex/dashboard.ts:57-63` (update `isTonalWorkout`)
- Modify: `convex/dashboard.ts` (add `getExternalActivities` action)
- Test: `convex/dashboard.test.ts`

- [ ] **Step 1: Write failing tests for updated isTonalWorkout**

In `convex/dashboard.test.ts`, update the `makeActivity` helper to accept an optional `activityType` parameter (defaulting to `"workout"` to preserve existing tests), then add two new tests:

```ts
// Update makeActivity signature:
function makeActivity(
  workoutId: string,
  totalVolume: number,
  targetArea = "Full Body",
  activityType = "workout",
): Activity {
  return {
    activityId: "act-1",
    userId: "user-1",
    activityTime: "2026-03-14T10:00:00Z",
    activityType,
    workoutPreview: {
      activityId: "act-1",
      workoutId,
      workoutTitle: "Test",
      programName: "",
      coachName: "",
      level: "beginner",
      targetArea,
      isGuidedWorkout: false,
      workoutType: "strength",
      beginTime: "2026-03-14T10:00:00Z",
      totalDuration: 2700,
      totalVolume,
      totalWork: 0,
      totalAchievements: 0,
      activityType,
    },
  };
}

// Add these tests inside the existing describe("isTonalWorkout") block:

it("returns false for External activityType even with non-zero volume", () => {
  const activity = makeActivity("ext-id", 500, "Full Body", "External");
  expect(isTonalWorkout(activity)).toBe(false);
});

it("returns true for Internal activityType with non-zero volume", () => {
  const activity = makeActivity("workout-123", 5000, "Full Body", "Internal");
  expect(isTonalWorkout(activity)).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify the External test fails**

Run: `npx vitest run convex/dashboard.test.ts`
Expected: 1 new test FAILS ("External activityType even with non-zero volume" returns true but we want false). The "Internal activityType" test already passes on the old code since it only checks volume.

- [ ] **Step 3: Update isTonalWorkout implementation**

In `convex/dashboard.ts`, replace the `isTonalWorkout` function (lines 57-63):

```ts
export function isTonalWorkout(a: Activity): boolean {
  const wp = a.workoutPreview;
  if (!wp) return false;
  return a.activityType !== "External" && wp.totalVolume > 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/dashboard.test.ts`
Expected: ALL tests PASS

- [ ] **Step 5: Add getExternalActivities action**

In `convex/dashboard.ts`, add the import for `ExternalActivity` at the top:

```ts
import type {
  Activity,
  ExternalActivity,
  MuscleReadiness,
  StrengthDistribution,
  StrengthScore,
} from "./tonal/types";
```

Then add the new action after `getTrainingFrequency`:

```ts
// ---------------------------------------------------------------------------
// 5. getExternalActivities — recent non-Tonal activities (Apple Watch, etc.)
// ---------------------------------------------------------------------------

export const getExternalActivities = action({
  args: {},
  handler: async (ctx): Promise<ExternalActivity[]> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    return ctx.runAction(internal.tonal.proxy.fetchExternalActivities, {
      userId,
      limit: 10,
    });
  },
});
```

- [ ] **Step 6: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add convex/dashboard.ts convex/dashboard.test.ts
git commit -m "feat: update isTonalWorkout for External type, add getExternalActivities action"
```

---

### Task 4: Add external activities to AI training snapshot

**Files:**

- Modify: `convex/ai/context.ts:1-267`
- Test: `convex/ai/context.test.ts` (create)

- [ ] **Step 1: Write tests for context formatting helpers**

Create `convex/ai/context.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatExternalActivityLine, getHrIntensityLabel, filterLast7Days } from "./context";
import type { ExternalActivity } from "../tonal/types";

// ---------------------------------------------------------------------------
// HR intensity labels
// ---------------------------------------------------------------------------

describe("getHrIntensityLabel", () => {
  it("returns null for zero HR", () => {
    expect(getHrIntensityLabel(0)).toBeNull();
  });

  it("returns 'light' for HR below 100", () => {
    expect(getHrIntensityLabel(90)).toBe("light");
  });

  it("returns 'moderate' for HR between 100 and 130", () => {
    expect(getHrIntensityLabel(115)).toBe("moderate");
  });

  it("returns 'vigorous' for HR above 130", () => {
    expect(getHrIntensityLabel(145)).toBe("vigorous");
  });

  it("returns 'moderate' at exactly 100", () => {
    expect(getHrIntensityLabel(100)).toBe("moderate");
  });

  it("returns 'vigorous' at exactly 131", () => {
    expect(getHrIntensityLabel(131)).toBe("vigorous");
  });
});

// ---------------------------------------------------------------------------
// 7-day filter
// ---------------------------------------------------------------------------

describe("filterLast7Days", () => {
  const now = new Date("2026-03-16T12:00:00Z");

  function makeExternal(beginTime: string): ExternalActivity {
    return {
      id: "ext-1",
      userId: "user-1",
      workoutType: "pickleball",
      beginTime,
      endTime: beginTime,
      timezone: "America/Denver",
      activeDuration: 3600,
      totalDuration: 3600,
      distance: 0,
      activeCalories: 0,
      totalCalories: 500,
      averageHeartRate: 140,
      source: "Apple Watch",
      externalId: "ext-id",
      deviceId: "device-1",
    };
  }

  it("includes activities within 7 days", () => {
    const activity = makeExternal("2026-03-15T10:00:00Z");
    expect(filterLast7Days([activity], now)).toHaveLength(1);
  });

  it("excludes activities older than 7 days", () => {
    const activity = makeExternal("2026-03-08T10:00:00Z");
    expect(filterLast7Days([activity], now)).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(filterLast7Days([], now)).toHaveLength(0);
  });

  it("excludes activity at exactly the 7-day boundary", () => {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(filterLast7Days([makeExternal(sevenDaysAgo)], now)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Format line
// ---------------------------------------------------------------------------

describe("formatExternalActivityLine", () => {
  function makeExternal(overrides: Partial<ExternalActivity> = {}): ExternalActivity {
    return {
      id: "ext-1",
      userId: "user-1",
      workoutType: "pickleball",
      beginTime: "2026-03-15T14:00:00Z",
      endTime: "2026-03-15T16:00:00Z",
      timezone: "America/Denver",
      activeDuration: 7200,
      totalDuration: 7200,
      distance: 0,
      activeCalories: 0,
      totalCalories: 1100,
      averageHeartRate: 140,
      source: "Apple Watch",
      externalId: "ext-id",
      deviceId: "device-1",
      ...overrides,
    };
  }

  it("formats a standard activity line", () => {
    const line = formatExternalActivityLine(makeExternal());
    expect(line).toContain("Pickleball");
    expect(line).toContain("Apple Watch");
    expect(line).toContain("120min");
    expect(line).toContain("1100 cal");
    expect(line).toContain("vigorous");
  });

  it("omits HR label when averageHeartRate is 0", () => {
    const line = formatExternalActivityLine(makeExternal({ averageHeartRate: 0 }));
    expect(line).not.toContain("Avg HR");
  });

  it("capitalizes and space-separates camelCase workout type", () => {
    const line = formatExternalActivityLine(
      makeExternal({ workoutType: "traditionalStrengthTraining" }),
    );
    expect(line).toContain("Traditional Strength Training");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/ai/context.test.ts`
Expected: FAIL — the exported functions don't exist yet

- [ ] **Step 3: Add helper functions to context.ts**

In `convex/ai/context.ts`, add these exported helpers before `buildTrainingSnapshot`:

```ts
import type { ExternalActivity } from "../tonal/types";

export function getHrIntensityLabel(hr: number): string | null {
  if (hr === 0) return null;
  if (hr < 100) return "light";
  if (hr <= 130) return "moderate";
  return "vigorous";
}

export function filterLast7Days(
  activities: ExternalActivity[],
  now: Date = new Date(),
): ExternalActivity[] {
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  return activities.filter((a) => new Date(a.beginTime).getTime() > sevenDaysAgo);
}

function capitalizeWorkoutType(workoutType: string): string {
  return workoutType
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatExternalActivityLine(a: ExternalActivity): string {
  const type = capitalizeWorkoutType(a.workoutType);
  const mins = Math.round(a.totalDuration / 60);
  const cal = Math.round(a.totalCalories);
  const date = a.beginTime.split("T")[0];

  let line = `  ${date} — ${type} (${a.source}) | ${mins}min | ${cal} cal`;
  const hrLabel = getHrIntensityLabel(a.averageHeartRate);
  if (hrLabel) {
    line += ` | Avg HR ${Math.round(a.averageHeartRate)} (${hrLabel})`;
  }
  return line;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/ai/context.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Integrate into buildTrainingSnapshot**

The snapshot now uses a priority-based `SnapshotSection[]` system with `trimSnapshot`. Each section has a `priority` number (1 = highest, dropped last). Current priorities: 1-9 (workouts), 10 (performance), 11 (missed sessions). External activities slot in at priority 10, bumping performance to 11 and missed sessions to 12.

In `convex/ai/context.ts`, update the `buildTrainingSnapshot` function:

1. Add `fetchExternalActivities` to the parallel fetch (in the `Promise.all` block, after `activeInjuries`):

```ts
      ctx
        .runAction(internal.tonal.proxy.fetchExternalActivities, {
          userId: convexUserId,
          limit: 20,
        })
        .catch(() => [] as ExternalActivity[]),
```

2. Update the destructuring to include the new result:

```ts
  const [scores, readiness, activities, activeBlock, recentFeedback, activeGoals, activeInjuries, externalActivities] =
```

3. After the Priority 9 (Recent Workouts) section, add the external activities section at priority 10. Then bump performance notes to priority 11 and missed session detection to priority 12:

```ts
// Priority 10: External activities (last 7 days)
const recentExternal = filterLast7Days(externalActivities as ExternalActivity[]);
if (recentExternal.length > 0) {
  const extLines: string[] = [`External Activities (last 7 days):`];
  for (const ext of recentExternal) {
    extLines.push(formatExternalActivityLine(ext));
  }
  const hasVigorous = recentExternal.some(
    (e) => getHrIntensityLabel(e.averageHeartRate) === "vigorous",
  );
  if (hasVigorous) {
    extLines.push(
      `  → Recent external load includes high-intensity activity. Factor into recovery and programming decisions.`,
    );
  }
  sections.push({ priority: 10, lines: extLines });
}
```

4. Update the existing performance notes section from `priority: 10` to `priority: 11`, and missed session detection from `priority: 11` to `priority: 12`.

- [ ] **Step 6: Run type-check and tests**

Run: `npx tsc --noEmit && npx vitest run convex/ai/context.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add convex/ai/context.ts convex/ai/context.test.ts
git commit -m "feat: add external activities to AI training snapshot with HR intensity labels"
```

---

### Task 5: Add system prompt instruction for external activity awareness

**Files:**

- Modify: `convex/ai/coach.ts:76-78`

- [ ] **Step 1: Add coaching instruction**

In `convex/ai/coach.ts`, after the line `- Consider muscle readiness when programming — don't train fatigued muscles hard.` (line 76), add:

```
- When external activities (Apple Watch, HealthKit) appear in the training snapshot, factor their recency, duration, and intensity into your recovery estimates and programming decisions. High-intensity external sessions (vigorous HR, long duration) within the past 48 hours should influence exercise selection and volume.
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/ai/coach.ts
git commit -m "feat: add external activity awareness to coach system prompt"
```

---

### Task 6: Build ExternalActivitiesList UI component

**Files:**

- Create: `src/components/ExternalActivitiesList.tsx`

**Reference:** Follow the pattern of `src/components/RecentWorkoutsList.tsx` for structure, styling, and helpers. Read it first.

- [ ] **Step 1: Create the component**

Create `src/components/ExternalActivitiesList.tsx`:

```tsx
"use client";

import type { ExternalActivity } from "../../convex/tonal/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek === 1) return "1 week ago";
  if (diffWeek < 5) return `${diffWeek} weeks ago`;

  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function capitalizeType(workoutType: string): string {
  return workoutType
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function ExternalActivityRow({ activity }: { activity: ExternalActivity }) {
  const showCalories = activity.totalCalories > 0;
  const showHr = activity.averageHeartRate > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight text-foreground/80">
          {capitalizeType(activity.workoutType)}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/60">
          {relativeTime(activity.beginTime)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {formatDuration(activity.totalDuration)}
        </span>
        {showCalories && (
          <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {Math.round(activity.totalCalories)} cal
          </span>
        )}
        {showHr && (
          <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {Math.round(activity.averageHeartRate)} bpm
          </span>
        )}
        <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground/50">
          {activity.source}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List component
// ---------------------------------------------------------------------------

interface ExternalActivitiesListProps {
  activities: ExternalActivity[];
}

export function ExternalActivitiesList({ activities }: ExternalActivitiesListProps) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">No external activities.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {activities.map((activity) => (
        <ExternalActivityRow key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ExternalActivitiesList.tsx
git commit -m "feat: add ExternalActivitiesList dashboard component"
```

---

### Task 7: Wire external activities into the dashboard page

**Files:**

- Modify: `src/app/(app)/dashboard/page.tsx`

**Reference:** Read `src/app/(app)/dashboard/page.tsx` first to understand the existing pattern.

- [ ] **Step 1: Add imports and data fetching**

In `src/app/(app)/dashboard/page.tsx`:

1. Add import for the new component:

```ts
import { ExternalActivitiesList } from "@/components/ExternalActivitiesList";
```

2. Add `ExternalActivity` to the **existing** type import block (do NOT add a new standalone import — the page already imports from `../../../../convex/tonal/types`):

```ts
import type {
  Activity,
  ExternalActivity,
  MuscleReadiness,
  StrengthDistribution,
  StrengthScore,
} from "../../../../convex/tonal/types";
```

3. Inside the `DashboardPage` component, add the new data fetch after the `frequency` line (line 58):

```ts
const externalActivities = useActionData<ExternalActivity[]>(
  useAction(api.dashboard.getExternalActivities),
);
```

- [ ] **Step 2: Add the AsyncCard to the grid**

After the "Recent Workouts" `AsyncCard` (line 138), add:

```tsx
<AsyncCard
  state={externalActivities.state}
  refetch={externalActivities.refetch}
  lastUpdatedAt={externalActivities.lastUpdatedAt}
  title="Other Activities"
>
  {(d) => <ExternalActivitiesList activities={d} />}
</AsyncCard>
```

- [ ] **Step 3: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/dashboard/page.tsx
git commit -m "feat: add Other Activities card to dashboard"
```

---

### Task 8: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS — no regressions

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Visual check (if dev server running)**

Start `npm run dev` if not already running. Open the dashboard and verify:

- "Recent Workouts" card still shows only Tonal workouts
- "Other Activities" card shows external activities with workout type, duration, calories, HR, and source badge
- No console errors

- [ ] **Step 4: Final commit if any formatting changes**

Run: `npx prettier --write convex/tonal/types.ts convex/tonal/proxy.ts convex/ai/context.ts convex/ai/coach.ts convex/dashboard.ts convex/dashboard.test.ts convex/ai/context.test.ts src/components/ExternalActivitiesList.tsx src/app/\\(app\\)/dashboard/page.tsx`

If any files changed:

```bash
git add -A
git commit -m "chore: format files"
```
