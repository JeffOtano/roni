# Orchestrator Plan: Program My Week + Follow-ons (10 Agents)

**Purpose:** Implement "program my week" end-to-end, week completion sync, stuck-push recovery, progressive overload in programming, progress photos, and activation tuning.  
**Spec:** `docs/superpowers/specs/2026-03-12-northstar-rewrite.md` sections 3.2–3.5.  
**Context:** Week plans, exercise selection, volume/intensity, week view, push verification, check-ins, and progressive overload "last time" already exist.

---

## Agent roster (10)

| #   | Agent                                    | Scope                                                                                                                                                                        | Deps |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | Week programming Convex action           | Single action: given userId, weekStartDate, split, targetDays, duration → create week plan, build N workouts (exercise selection + volume), push each to Tonal, link to week | —    |
| 2   | Program my week AI tool                  | New coach tool that calls the week-programming action; integrate with ai/coach and tools                                                                                     | 1    |
| 3   | Program my week UX                       | CTA "Program my week" on dashboard/week view; loading, success/error; optional chat prompt                                                                                   | 1    |
| 4   | Week plan day completion sync            | When a workout linked to a week plan day appears in Tonal activities, set that day's status to "completed" (cron or in activation flow)                                      | —    |
| 5   | Stuck pushing recovery                   | Cron: workoutPlans with status "pushing" and older than 5 min → patch to "failed" with "Push timed out"                                                                      | —    |
| 6   | Progressive overload in week programming | Use last-time/suggested (progressiveOverload or volumeIntensity) when building workouts so suggested weight/rep is included or available                                     | 1    |
| 7   | Progress photos backend                  | Schema (encrypted photo storage), Convex: store (encrypt), list, delete; user-only; deletion on demand                                                                       | —    |
| 8   | Progress photos UI + analysis            | Upload, list, delete UI; optional AI comparison with guardrails (no negative/weight/body-shaming); settings privacy                                                          | 7    |
| 9   | Activation / onboarding tuning           | First-run clarity; analytics or query for 40% in 72h; CTA to first programmed workout                                                                                        | —    |
| 10  | Integration tests + docs                 | Tests for week-programming action; update docs/activation-metric or orchestrator with "what's implemented"                                                                   | 1    |

**Run:** All 10 in parallel. Agents 2, 3, 6, 10 assume agent 1 exposes `programWeek` (or equivalent). Agent 8 assumes agent 7 exposes photo storage API.

---

## Implemented

Program my week is implemented end-to-end: Convex internal action `coach/weekProgramming.programWeek` (and `weekPlans.programWeek` / public `programMyWeek`), AI coach tool that invokes it, and dashboard/week CTA with loading and success/error handling. Week plan day completion sync runs when a workout linked to a week plan day appears in Tonal activities (day status set to completed). Stuck-push recovery: cron marks `workoutPlans` with status `pushing` older than 5 minutes as `failed` with "Push timed out". Progressive overload (last-time/suggested) is used in week programming via `progressiveOverload` / volumeIntensity when building workouts. Integration tests cover week-programming helpers (`getTrainingDayIndices`, `getSessionTypesForSplit`) and the `programWeek` return-shape contract (including `{ success: false }` when a week plan already exists).
