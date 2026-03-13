# Orchestrator Plan: 10 Parallel Workstreams (North Star v2)

**Purpose:** Where to start and how to run 10 agents in parallel with the orchestrator coordinating.  
**Spec:** `docs/superpowers/specs/2026-03-12-northstar-rewrite.md`  
**Reference:** Dispatching parallel agents — one agent per independent domain, clear scope and output.

---

## Dependency overview

```
Wave 1 (foundation — run first, no shared state)
├── Agent 1: Week plan data model
├── Agent 2: Hardware abstraction interface
├── Agent 3: Activation metric definition + instrumentation
└── Agent 4: First 5 minutes (cold start + loading UX)

Wave 2 (depends on 1 and 2; can run in parallel after Wave 1)
├── Agent 5: Exercise selection engine (uses catalog; later uses abstraction)
├── Agent 6: Volume & intensity + progressive overload logic
├── Agent 7: Push-to-Tonal verification & fallback UX
└── Agent 8: Calendar / week view UI (reads from Agent 1 schema)

Wave 3 (depends on 2; optional to run with Wave 2)
├── Agent 9: Proactive check-ins (triggers + in-app)
└── Agent 10: Progressive overload data + “last time / try this” display
```

**Where to start:** Run **Wave 1** first (Agents 1–4). Then run **Wave 2** (Agents 5–8). Agent 9 and 10 can follow or run in parallel with Wave 2 if you want all 10 going.

---

## Agent 1: Week plan data model

**Scope:** Convex schema and API for “weekly plan” — multiple workouts per user per week, with preferred split, target days, and status. No AI, no push — storage and queries only.

**Context to attach:**

- `convex/schema.ts` (current `workoutPlans` table)
- `convex/workoutPlans.ts` (current internal create/get)
- Spec section 3.2 “What the calendar view shows” and “User’s control surface”

**Tasks:**

1. Add a `weekPlans` (or equivalent) concept: e.g. one row per user per week with `weekStartDate`, `preferredSplit`, `targetDays`, and link to N workout plans (or embed plan IDs).
2. Extend or add tables so a week has: training days, session type per day (Push/Pull/Legs/Full Body/Recovery), rest days, status (programmed/completed/missed/rescheduled).
3. Add Convex queries: get current week plan for user, get week plan by week start.
4. Add mutations: create/update week plan, link workout plans to days. Keep `workoutPlans` for the actual workout payload; week plan is the container.

**Constraints:** Do not change AI tools or Tonal proxy. Do not implement programming logic — only data model and Convex API.

**Deliverable:** Short doc or inline comments: schema changes, new files, and how “first AI-programmed workout” could be inferred (e.g. workout plan with `source: 'tonal_coach'` or linked to week plan).

**Output to return:** List of files created/edited; 1–2 paragraph summary of schema and how calendar/activation will consume it.

---

## Agent 2: Hardware abstraction interface

**Scope:** TypeScript interfaces so the “coaching engine” does not call Tonal directly. Single implementation: Tonal. No refactor of AI coach yet — just the interface and Tonal implementation behind it.

**Context to attach:**

- `convex/tonal/proxy.ts` (createWorkout, fetchWorkoutHistory, etc.)
- `convex/tonal/types.ts` (Movement, UserWorkout, etc.)
- Spec: “The abstraction layer between the coaching engine and the Tonal integration should be designed for this scenario from day one.”

**Tasks:**

1. Define interfaces (in a new file, e.g. `convex/tonal/hardware.ts` or `convex/coach/hardware.ts`):
   - `ExerciseCatalog` (e.g. get exercises, filter by muscle/equipment).
   - `WorkoutFormat` (generic workout structure: blocks, exercises, sets/reps/weight).
   - `PushWorkoutResult` (success + externalId vs error).
   - `GetHistoryResult` (list of completed workouts with minimal fields).
2. Implement these for Tonal only (wrap existing proxy functions).
3. Document how a future “manual logging” or other hardware would implement the same interfaces.

**Constraints:** Do not change the AI coach or tools in this workstream — only add the abstraction and implement for Tonal. No schema changes.

**Deliverable:** New module with interfaces + Tonal implementation; brief README or JSDoc on how coaching logic would call it.

**Output to return:** File path(s); 1 paragraph summary of the interface and how `createWorkout` (or equivalent) is invoked through it.

---

## Agent 3: Activation metric definition + instrumentation

**Scope:** Define “first AI-programmed workout completed on Tonal” and add the minimal Convex/event plumbing so we can measure it. No UI yet.

**Context to attach:**

- Spec: “First AI-programmed workout completed on Tonal”, “Track via Convex: timestamp of Tonal account connection → timestamp of first AI-programmed workout completion”, “Minimum sample: 50 signups”.
- `convex/workoutPlans.ts`, `convex/userProfiles.ts`, `convex/schema.ts`
- Tonal API: activities/workout history (how we know a workout was _completed_ on the machine).

**Tasks:**

1. Define “AI-programmed”: e.g. workout created via tonal.coach (workoutPlans with our `userId` and optionally a `source` or `generatedBy` field).
2. Define “completed”: workout appears in user’s Tonal workout history (e.g. activity with matching `tonalWorkoutId` or equivalent from Tonal API).
3. Add a way to record “first AI-programmed workout completed” per user (e.g. table `activationEvents` or fields on `userProfiles`: `firstAiWorkoutCompletedAt`).
4. Add a Convex action or cron that: given a user, checks Tonal activities for completed workouts that match our pushed workout IDs; when found, write the first-completion timestamp if not already set.
5. Document “signup” (e.g. Tonal account connected) and “activation” (first AI workout completed) for analytics.

**Constraints:** Do not build dashboard or activation UI — only event definition and Convex logic. Do not change Tonal API contract; use existing activity/workout endpoints.

**Deliverable:** Schema/table or fields for activation; Convex function(s) to detect and store first completion; short doc for “how we measure 40% in 72 hours”.

**Output to return:** List of changes; 1 paragraph on how the metric is computed and where to query it.

---

## Agent 4: First 5 minutes — cold start + loading UX

**Scope:** Improve first-run experience: cold start (< 2 weeks history) and loading/latency. No new backend logic for “insight” — only UX and client-side flow.

**Context to attach:**

- Spec: “Cold start: For new Tonal owners with < 2 weeks of history… lead with preference questions”, “Latency: Show a progress indicator with a hook: ‘Pulling your training history from Tonal…’”
- Dashboard and chat entry points: `src/app/(app)/dashboard/`, chat page, any onboarding or first-load components.

**Tasks:**

1. **Cold start:** On first load after Tonal connect, if workout history is empty or < 2 weeks, show a short preference flow (goals, days/week, injuries/constraints) and store in user profile or local state; do not show “one insight” yet — show “Let’s set you up” and then e.g. “Program your first session from your preferences”.
2. **Loading:** Where we fetch Tonal data for the first time (dashboard or chat), replace a bare spinner with a progress message: e.g. “Pulling your training history from Tonal… I’m about to show you something interesting.” (or copy from spec).
3. Ensure the “insight-first” path only runs when we have enough history (e.g. 2+ weeks); otherwise preference flow leads.

**Constraints:** Backend: only read existing APIs (dashboard, profile, history). No new Convex actions for “generate insight”. Frontend only.

**Deliverable:** Updated components and copy; clear branching “cold start vs insight-first” in code or comments.

**Output to return:** Files touched; 1 paragraph describing cold start vs insight-first and where the 2-week gate lives.

---

## Agent 5: Exercise selection engine

**Scope:** Pure logic: given inputs (muscle groups, user level, constraints, session duration, last-used exercises), return a list of Tonal movement IDs for one session. No Convex, no UI — testable module.

**Context to attach:**

- Spec 3.2 “Exercise selection (the hard engineering problem)”: filter by muscle, equipment/handle, no repeat on consecutive same-muscle sessions, match difficulty, compound-first, validate supersets/circuits.
- `convex/tonal/types.ts` (Movement), `convex/ai/tools.ts` (searchExercisesTool — catalog access pattern).

**Tasks:**

1. Create a module (e.g. `lib/exerciseSelection.ts` or `convex/coach/exerciseSelection.ts`) that:
   - Takes: catalog (Movement[]), target muscle groups, user level, duration cap, “last used” exercise IDs for this muscle group, optional constraints (e.g. no overhead pressing).
   - Returns: ordered list of movement IDs (compound first, then isolation), respecting “no repeat” and difficulty.
2. Add unit tests: e.g. “returns only exercises for target muscles”, “does not repeat last session’s exercise for same group”, “respects duration (exercise count)”.
3. Document how this will be called from the weekly programming engine (inputs/outputs).

**Constraints:** Do not call Convex or Tonal — accept catalog as input. Do not implement volume/intensity or progressive overload — only exercise selection.

**Deliverable:** One module + tests; brief doc or JSDoc on interface.

**Output to return:** File path(s); 1 paragraph summary of API and test coverage.

---

## Agent 6: Volume, intensity, and progressive overload logic

**Scope:** Pure logic: weekly volume targets per muscle group, progressive overload from previous week (weight/set/rep), muscle readiness projection across the week, session duration. No Convex, no UI — testable module. Uses workout history and readiness as input.

**Context to attach:**

- Spec 3.2 “Volume and intensity”, 3.3 “Progressive overload tracking”.
- Types: strength scores, muscle readiness, workout history (activities/sets) — use existing types from `convex/tonal/types.ts`.

**Tasks:**

1. Create a module (e.g. `lib/volumeIntensity.ts` or `convex/coach/volumeIntensity.ts`) that:
   - Takes: user’s last week(s) of workouts (per-exercise volume/weight), muscle readiness, strength level, session duration preference.
   - Returns: per-session suggestions (e.g. “add 1 set”, “+2.5 lbs”, “same weight, +1 rep”) or target volume per muscle group for the week.
2. Optionally: project “if we train chest Monday, readiness Thursday” (simple rule or table).
3. Add unit tests with fake history and readiness.
4. Document how this integrates with the exercise selection engine (Agent 5) and week plan (Agent 1).

**Constraints:** No Convex, no Tonal API calls — pure functions with typed inputs. No UI.

**Deliverable:** One module + tests; short doc on inputs/outputs and integration points.

**Output to return:** File path(s); 1 paragraph summary.

---

## Agent 7: Push-to-Tonal verification and fallback UX

**Scope:** After pushing a workout to Tonal, verify success; on failure, show clear error and retry. Spec: “Verify push succeeded before confirming to user; if push fails, show clear error and retry option” and “workout description as fallback”.

**Context to attach:**

- `convex/tonal/proxy.ts` (createWorkout), `convex/ai/tools.ts` (createWorkoutTool), UI that shows “Pushed to Tonal” (e.g. WorkoutCard, ToolCallIndicator).
- Spec failure modes 3.2: push fails silently, API changes.

**Tasks:**

1. In Convex: ensure we only set `workoutPlans.status = 'pushed'` and store `tonalWorkoutId` when Tonal API returns success; on failure, set status to `draft` or `failed` and store error reason.
2. Expose failure reason to the client (e.g. in workout plan or in tool result).
3. In UI: when status is `failed` or push errors, show clear message and a “Retry” action (e.g. re-call push).
4. Optional: “Export” or “Copy workout description” so user can do the workout manually if push is down (fallback).

**Constraints:** Do not change the Tonal API shape; only interpret response and store/display state correctly.

**Deliverable:** Convex changes for verify-before-confirm and failure state; UI changes for error + retry (and optional fallback).

**Output to return:** Files changed; 1 paragraph summary of verification flow and fallback.

---

## Agent 8: Calendar / week view UI

**Scope:** A view that shows the user’s week: training days, session type (Push/Pull/Legs/Full Body/Recovery), rest days, status (programmed/completed/missed/rescheduled). Reads from week plan (Agent 1) and Tonal completion where needed.

**Context to attach:**

- Spec 3.2 “What the calendar view shows”.
- Architecture: `src/app/(app)/dashboard/`, existing dashboard cards; `workoutPlans` and week plan schema from Agent 1.

**Tasks:**

1. Add a “Week” or “Calendar” view (new page or dashboard section): 7 days, each day shows session type or “Rest”, and status.
2. Data: query week plan for current week; for “completed”, either from week plan status or by matching Tonal activities to our pushed workouts.
3. Use existing design system (shadcn, dashboard cards). No new backend beyond what Agent 1 provides; if Agent 1 is not merged yet, use stubbed data shape and document the contract.

**Constraints:** Read-only for this workstream — no “program my week” button implementation. Focus on display and data binding.

**Deliverable:** New calendar/week component(s) and route; integration with week plan API.

**Output to return:** File path(s); 1 paragraph on data source and status mapping.

---

## Agent 9: Proactive check-ins (triggers + in-app)

**Scope:** Design and implement trigger-based in-app check-ins only. No SMS. Respect mute/frequency settings.

**Context to attach:**

- Spec 3.4: table of triggers (missed session, 3+ day gap, completed tough session, weekly recap, strength milestone, plateau); “in-app notifications first”; “one voice at launch”; user can mute/adjust/turn off.
- Convex: crons, user preferences (add if missing).

**Tasks:**

1. Add user preferences for check-ins: enabled/disabled, frequency, mute. Store in user profile or a small `userSettings` table.
2. Define “check-in” content per trigger (copy or template); no tone presets.
3. Implement Convex cron or scheduled jobs that: evaluate triggers (e.g. “missed session 18h ago”), check user preferences, and create an in-app “notification” or message (e.g. store in a `checkIns` or `notifications` table with `readAt`).
4. Expose unread check-ins in the app (e.g. banner or bell icon) and link to settings to mute/adjust.

**Constraints:** In-app only. No Twilio/SMS. No “Drill Sergeant”/tone presets — one default voice.

**Deliverable:** Schema for preferences and check-ins; cron + evaluation logic; UI to show and to configure check-ins.

**Output to return:** Files changed; 1 paragraph on trigger evaluation and where user controls live.

---

## Agent 10: Progressive overload data + “last time / try this” display

**Scope:** Per-exercise history from Tonal data; surface “last time you did X at Y” and “try Z” in the app (e.g. in chat context or a small panel). No AI-generated prose in this workstream — only data and display.

**Context to attach:**

- Spec 3.3: “Tracks weight x reps x sets for every movement”, “Last time you did Bench Press at 4x10 @ 69 avg. Try 72-75 today.”
- Tonal: activities and set details (from workout-activities or equivalent); `convex/tonal/types.ts`.

**Tasks:**

1. Add a way to get per-exercise history: by movement ID, last N sessions with weight/reps/sets (from Tonal activities or cached in Convex). If we don’t have set-level history today, document what’s missing and propose a minimal schema/cache.
2. Compute “last time” and “suggested next” (e.g. +2.5 lbs or +1 rep) with a simple rule; keep it in a small module or Convex query.
3. Expose this in the UI: e.g. in a workout detail view or chat context as “Last time: Bench 4x10 @ 69 avg. Suggested: 72–75 lbs.”
4. Optional: “plateau” detection (e.g. same weight 3+ sessions) and show “Options: add set, increase weight, or switch exercise” — can be stub.

**Constraints:** Use existing Tonal data or minimal new caching. No AI for this workstream — deterministic “last time” and simple progression suggestion.

**Deliverable:** Data layer for per-exercise history; simple progression rule; UI component(s) for “last time / try this”.

**Output to return:** Files changed; 1 paragraph on data source and where it’s shown in the app.

---

## Orchestrator: how to run

**Wave 1 (start here):** Launch Agents 1, 2, 3, 4 in parallel. Wait for all four to return.

**Integration after Wave 1:** Merge Agent 1 (schema) first; then ensure Agent 3’s activation logic and Agent 4’s cold-start gate can use profile/history. Agent 2’s interface can be merged without switching the coach over yet.

**Wave 2:** Launch Agents 5, 6, 7, 8 in parallel. Agent 8 (calendar) uses Agent 1’s schema; if Agent 1 output is a doc only (no merge yet), Agent 8 can implement against the agreed schema and stub data.

**Wave 3:** Launch Agents 9 and 10 (or with Wave 2 if you prefer). Both are largely independent of the weekly programming engine.

**Review after each wave:** Run tests, typecheck, and quick sanity pass; resolve any conflicts (e.g. schema, shared types) before the next wave.

---

## Where to start (one sentence per agent)

| #   | Start with…                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------- |
| 1   | Week plan schema + Convex API so the product has a “week” container.                                  |
| 2   | Hardware abstraction interface + Tonal implementation so we can add manual logging later.             |
| 3   | Activation metric definition + Convex instrumentation so we can measure “first AI workout completed”. |
| 4   | Cold start and loading UX so the first 5 minutes match the spec.                                      |
| 5   | Exercise selection engine (pure logic + tests) for weekly programming.                                |
| 6   | Volume/intensity and progressive overload logic (pure logic + tests).                                 |
| 7   | Push verification and retry/fallback UX so we don’t fail silently.                                    |
| 8   | Calendar/week view UI reading from the week plan.                                                     |
| 9   | Check-in triggers and in-app notifications + settings.                                                |
| 10  | Per-exercise history and “last time / try this” display.                                              |

**Recommended first move:** Run **Wave 1 (Agents 1–4)**. They unblock the rest and have no shared state with each other. Then run Wave 2 (5–8), then 9–10 or in parallel with 8.
