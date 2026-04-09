# Schedule & Weekly Planner System Architecture

## Overview

The schedule/weekly planner system manages a user's 7-day training week. It links week plans to workout plans, syncs completion status from Tonal activity history, and provides a rich UI for browsing scheduled sessions.

---

## DATA MODELS

### 1. Week Plan (Convex Table: `weekPlans`)

Stores a user's weekly schedule (Mon-Sun).

**Schema:**

```
{
  userId: Id<"users">                    // Owner
  weekStartDate: string                  // YYYY-MM-DD (Monday of week) — unique key
  preferredSplit: "ppl" | "upper_lower" | "full_body"
  targetDays: number                     // e.g., 4 (intended workouts/week)
  days: [                                // Array of 7 day slots (0=Mon, 6=Sun)
    {
      sessionType: string               // "push" | "pull" | "legs" | "upper" | "lower" | "full_body" | "recovery" | "rest"
      status: string                    // "programmed" | "completed" | "missed" | "rescheduled" (cached/hint)
      workoutPlanId?: Id<"workoutPlans">
      estimatedDuration?: number         // Minutes
    }
    × 7
  ]
  createdAt: number
  updatedAt: number
}
```

**Indexes:**

- `by_userId` — fetch user's week plans
- `by_userId_weekStartDate` — lookup current/specific week

---

### 2. Workout Plan (Convex Table: `workoutPlans`)

A workout (blocks of exercises) that can be pushed to Tonal or remain as draft.

**Schema:**

```
{
  userId: Id<"users">
  threadId?: string                      // AI chat thread (if AI-generated)
  tonalWorkoutId?: string                // Tonal ID after push
  source?: string                        // "tonal_coach" (AI) or other
  title: string
  blocks: [                              // Exercise blocks/supersets
    {
      name: string
      exercises: [
        {
          movementId: string             // Reference to movements table
          sets: number
          reps?: number
          weight?: { value: number; unit: string }
          tempo?: string
          rest?: number
        }
      ]
      supersets?: [...]                  // Grouped exercises
    }
  ]
  status: "draft" | "pushing" | "pushed" | "completed" | "deleted" | "failed"
  pushErrorReason?: string               // Error msg if status="failed"
  estimatedDuration?: number
  createdAt: number
  pushedAt?: number
}
```

**Indexes:**

- `by_userId` — fetch user's workouts
- `by_status` — track pushing/failed workouts

---

### 3. Movements Catalog (Convex Table: `movements`)

Master list of exercises synced from Tonal API.

**Schema:**

```
{
  tonalId: string                        // Tonal's ID
  name: string                           // Display name
  shortName: string
  muscleGroups: string[]
  skillLevel: number
  publishState: string
  sortOrder: number
  onMachine: boolean
  inFreeLift: boolean
  countReps: boolean
  isTwoSided: boolean
  isBilateral: boolean
  isAlternating: boolean
  descriptionHow: string
  descriptionWhy: string
  thumbnailMediaUrl?: string
  accessory?: string
  onMachineInfo?: any
  trainingTypes?: string[]
  lastSyncedAt: number
}
```

**Indexes:**

- `by_tonalId` — resolve tonal movement references
- `by_accessory` — filter by equipment

---

## QUERIES & ACTIONS

### Frontend → Backend Data Flow

#### 1. `getScheduleData` (Convex action)

**Location:** `convex/schedule.ts`

**Flow:**

```
1. Authenticate user
2. Call getWeekPlanEnriched → EnrichedWeekPlan
3. Collect all workoutPlanIds from enriched days
4. Batch-fetch workoutPlan records by ID
5. Collect all movementIds from blocks
6. Fetch movements catalog (name lookup)
7. Build ScheduleDay[] with:
   - dayIndex (0-6)
   - dayName (Mon-Sun)
   - date (ISO string)
   - sessionType (from day slot)
   - derivedStatus (from enriched)
   - workoutTitle (from plan)
   - exercises (resolved names + sets/reps)
   - estimatedDuration (from day slot)
   - tonalWorkoutId (for activity linking)
8. Return { weekStartDate, days[] }
```

**Return Type:**

```typescript
interface ScheduleData {
  weekStartDate: string;
  days: ScheduleDay[];
}

interface ScheduleDay {
  dayIndex: number;
  dayName: string;
  date: string;
  sessionType: string;
  derivedStatus: "rest" | "programmed" | "completed" | "failed";
  workoutTitle?: string;
  exercises: ScheduleExercise[];
  estimatedDuration?: number;
  tonalWorkoutId?: string;
}

interface ScheduleExercise {
  name: string;
  sets: number;
  reps?: number;
}
```

#### 2. `getWeekPlanEnriched` (Convex action)

**Location:** `convex/weekPlanEnriched.ts`

**Purpose:** Sync local week plan status with Tonal activity history. **Tonal is source of truth.**

**Flow:**

```
1. Fetch local week plan for current user + week
2. Collect unique workoutPlanIds from day slots
3. Batch-fetch workoutPlan records (for tonalWorkoutId + status)
4. Fetch recent Tonal activities (limit 20)
5. Build set of completed tonalWorkoutIds from activities
6. For each day:
   - If sessionType="rest" → derivedStatus="rest"
   - If no workoutPlanId → derivedStatus="rest"
   - If workoutPlan.status="failed" → derivedStatus="failed"
   - If tonalWorkoutId in completedIds → derivedStatus="completed"
   - Otherwise → derivedStatus="programmed"
7. Compare derived status to cached status
   - If changed, batch-update weekPlan.days[i].status
8. Return EnrichedWeekPlan with derivedStatus fields
```

**Return Type:**

```typescript
interface EnrichedWeekPlan {
  _id: string;
  weekStartDate: string;
  preferredSplit: string;
  targetDays: number;
  days: EnrichedDay[];
}

interface EnrichedDay {
  sessionType: string;
  status: string; // cached (may be stale)
  derivedStatus: "rest" | "programmed" | "completed" | "failed";
  workoutPlanId?: string;
  estimatedDuration?: number;
  tonalWorkoutId?: string; // for linking to activity detail
}
```

#### 3. `getCurrentWeekPlan` (Convex query)

**Location:** `convex/weekPlans.ts`

Fetch week plan for authenticated user + current week.

```typescript
export const getCurrentWeekPlan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;
    const weekStartDate = getWeekStartDateString(new Date());
    return ctx.db
      .query("weekPlans")
      .withIndex("by_userId_weekStartDate", (q) =>
        q.eq("userId", userId).eq("weekStartDate", weekStartDate),
      )
      .first();
  },
});
```

#### 4. `linkWorkoutPlanToDay` (Convex mutation)

**Location:** `convex/weekPlans.ts`

Assign a workout plan to a day slot.

```typescript
export const linkWorkoutPlanToDay = mutation({
  args: {
    weekPlanId: v.id("weekPlans"),
    dayIndex: v.number(),              // 0-6 (Mon-Sun)
    workoutPlanId: v.id("workoutPlans"),
    status?: dayStatusValidator,       // optional override
    estimatedDuration?: v.number(),
  },
  // Updates days[dayIndex].workoutPlanId, duration, status
});
```

---

## STATUS TRACKING

### Day Status Lifecycle

**Local cache values** (stored in `weekPlans.days[i].status`):

- `"programmed"` — workout planned but not completed
- `"completed"` — completed on Tonal
- `"missed"` — was scheduled but past due date
- `"rescheduled"` — moved to different day

**Derived status** (computed from Tonal activities):

- `"rest"` — rest/recovery day
- `"programmed"` — workout plan exists, not on Tonal completion history
- `"completed"` — tonalWorkoutId found in recent activities
- `"failed"` — workoutPlan.status === "failed" (push never succeeded)

**Logic in enrichment:**

```
if (day.sessionType === "rest") → "rest"
else if (!day.workoutPlanId) → "rest"
else if (workoutPlan.status === "failed") → "failed"
else if (tonalWorkoutId in completedTonalIds) → "completed"
else → "programmed"
```

**UI shows:**

- If today's date + derivedStatus === "programmed" → shown as "missed" (past-due)
- Otherwise → shows derivedStatus directly

---

## UI COMPONENTS

### Page: `/schedule`

**File:** `src/app/(app)/schedule/page.tsx`

**Layout:**

```
Header (week range)
  ↓
Training day cards (grid, 3-4 cols)
  - ScheduleDayCard component
  ↓
Rest days (minimal rows below)
```

**State:**

- Uses `useActionData` hook with `useAction(api.schedule.getScheduleData)`
- Refetch capability on error
- Loading skeleton

### Component: `ScheduleDayCard`

**File:** `src/components/schedule/ScheduleDayCard.tsx`

**Renders:**

- **Training day:** Card with:
  - Left-border accent (color per sessionType)
  - Header: day name, date, duration pill, session badge
  - Status badge (completed/programmed/missed)
  - Workout title
  - ExerciseList (max 4 visible + "+X more")
  - Footer button: "View workout" (if completed → link to `/activity/{tonalWorkoutId}`) OR "Ask coach" (link to chat with prompt)
  - Stretched link overlay for card click → `/schedule/{dayIndex}`

- **Rest day:** Minimal row with:
  - Moon icon
  - Day name
  - Date
  - "Rest" label

### Component: `ExerciseList`

**File:** `src/components/schedule/ExerciseList.tsx`

Shows first 4 exercises, truncates with "+N more" overflow indicator.

---

### Page: `/schedule/[dayIndex]`

**File:** `src/app/(app)/schedule/[dayIndex]/page.tsx`

**Layout:**

```
Back button
Title (formatted date)
Session type badge + status badge
Workout title
Stat cards (duration, exercise count)
Full exercises list (all, not truncated)
"Ask coach" CTA button
```

**Helpers in `components.tsx`:**

- `SESSION_LABELS` — session type → display name
- `SESSION_BADGE_COLORS` — session type → styling
- `formatDuration()` — minutes → "X h Y m"
- `formatDayDate()` — ISO → "Monday, March 24"
- `ExerciseRow` — alternating bg, exercise name + sets×reps
- `StatCard` — icon + value + label

---

## WEEK START DATE LOGIC

**`getWeekStartDateString(date: Date): string`**

- Input: any Date
- Output: YYYY-MM-DD of Monday of that week
- Handles UTC correctly
- Used for:
  - Computing "current week" for calendar
  - Unique key for week plan lookup

**Example:**

```
Wed Mar 26, 2025 → "2025-03-24" (Mon of that week)
Mon Mar 24, 2025 → "2025-03-24" (same)
Sun Mar 23, 2025 → "2025-03-17" (previous Mon)
```

---

## INTERNAL MUTATIONS & HELPERS

**Location:** `convex/weekPlanInternals.ts`

### `getByUserIdAndWeekStartInternal`

Fetch week plan for user + specific week.

### `batchUpdateDayStatusesInternal`

Sync cached status when enriched status changes.

```typescript
args: {
  weekPlanId: v.id("weekPlans"),
  updates: [{ dayIndex: number, status: dayStatusValidator }]
}
```

### `linkWorkoutPlanToDayInternal`

Used by `programWeek` action to assign workouts to days.

### `createForUserInternal`

Create a new week plan (defaults to all rest days).

### `deleteWeekPlanInternal`

Delete week plan + linked draft workouts.

---

## WORKOUT PLAN LINKING

**How a day goes from "programmed" to "completed":**

1. **Programming:** AI generates or user creates workout → `workoutPlans` (status="draft")
2. **Pushing:** Async action calls Tonal API → sets status="pushing" → "pushed" (with tonalWorkoutId)
3. **Linking:** `linkWorkoutPlanToDay` assigns workoutPlanId to `weekPlans.days[dayIndex]`
4. **Completion:** User completes on Tonal → activity synced via `tonal.proxy.fetchWorkoutHistory`
5. **Cache sync:** `getWeekPlanEnriched` detects completion → updates `weekPlans.days[dayIndex].status = "completed"`

---

## SESSION TYPES

Available session types (defined in `weekPlanHelpers.ts`):

```
"push", "pull", "legs", "upper", "lower", "full_body", "recovery", "rest"
```

Color mapping (for UI badges):

- push → blue
- pull → purple
- legs → emerald
- upper → orange
- lower → teal
- full_body → pink

---

## KEY ENTRY POINTS FOR iOS

1. **Fetch schedule:** Call `getScheduleData` → get full week view
2. **Fetch day detail:** Use same `getScheduleData` response, filter by dayIndex
3. **Update day status:** (not exposed in current API — use Tonal integration)
4. **Link workout to day:** `linkWorkoutPlanToDay` mutation
5. **View completed workout:** Use `tonalWorkoutId` to navigate to activity detail

**Design decisions:**

- Single action call (`getScheduleData`) returns everything: week plan + workout details + exercise names
- No separate "detail" API — frontend filters the response
- Tonal is source of truth for completion; local cache is hint only
- Derived status computed on-demand, cached locally for display consistency
