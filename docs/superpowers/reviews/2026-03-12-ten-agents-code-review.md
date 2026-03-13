# Code Review: North Star v2 — 10-Agent Implementation

**Reviewer:** Orchestrator (code review pass)  
**Date:** March 2026  
**Scope:** Convex backend, lib modules, and UI added by Wave 1–3 agents (week plans, hardware abstraction, activation, cold start, exercise selection, volume/intensity, push verification, week view, check-ins, progressive overload).

---

## Summary

The implementation is **solid and spec-aligned**. Auth and ownership are enforced at boundaries, types are clear, and the new code fits existing patterns. Below: what’s good, what to tighten, and a short action list.

---

## 1. What’s working well

### 1.1 Security and boundaries

- **Auth and ownership:** All public Convex queries/mutations use `getAuthUserId(ctx)` and either return `null` or throw when unauthenticated. Mutations that modify user data (week plans, workout plans, check-ins, preferences) verify `plan.userId === userId` or `row.userId === userId` before patching. No cross-user data leakage in the reviewed paths.
- **Internal vs public:** Activation, check-in evaluation, and push-outcome updates use `internalQuery` / `internalMutation` / `internalAction`; only the intended public API is exposed as `query` / `mutation` / `action`.
- **Retry push:** `retryPush` uses `getPlanForCurrentUser` so only the plan owner can retry; error messages don’t expose internals.

### 1.2 Data model and validation

- **Schema:** `weekPlans`, `checkIns`, and extended `workoutPlans` / `userProfiles` are consistent. Validators (`sessionTypeValidator`, `dayStatusValidator`, `triggerValidator`, etc.) are reused and keep the type surface clear.
- **Week plan invariants:** `create` rejects duplicate (userId, weekStartDate); `update` and `linkWorkoutPlanToDay` enforce 7-day `days` and dayIndex 0–6; `linkWorkoutPlanToDay` validates that the workout plan belongs to the same user.
- **Check-in preferences:** Stored on `userProfiles.checkInPreferences` with sensible defaults; cron only creates check-ins when `enabled && !muted` and respects frequency.

### 1.3 Clarity and structure

- **Hardware abstraction:** `convex/tonal/hardware.ts` clearly separates interfaces (catalog, push result, history) from the Tonal implementation; JSDoc explains manual-logging and other-hardware use. Pure helpers (`movementToHardwareExercise`, `filterExercises`, `activityToCompletedEntry`) are exported for testing.
- **Exercise selection:** Pure function, no I/O; inputs/outputs and “how the weekly programming engine uses this” are documented. Compound-first and no-repeat logic are easy to follow.
- **Volume/intensity:** Pure functions in `lib/volumeIntensity.ts` with typed inputs; JSDoc describes integration with exercise selection and week plan. No Convex/Tonal coupling.
- **Check-in content:** Single place (`checkIns/content.ts`) for trigger → message; one voice, no tone presets per spec.

### 1.4 UX and failure handling

- **Push verification:** `createWorkout` only sets `pushed` when Tonal returns success; on failure we persist `failed` and `pushErrorReason`. WorkoutCard shows error, Retry, and Copy workout description. Matches spec “verify push succeeded before confirming; if push fails, show clear error and retry option.”
- **Cold start:** 2-week gate lives in `getColdStartEligibility`; dashboard and chat branch on it. Preference flow and “Pulling your training history…” copy are implemented.
- **Activation:** First-completion is defined and recorded; hourly cron with batching and delay; `docs/activation-metric.md` explains how to measure “40% within 72 hours.”

---

## 2. Issues and recommendations

### 2.1 High priority

**2.1.1 `weekStartDate` format** — **Fixed**

- **Where:** `weekPlans.create` and `weekPlans.update` (and callers passing `weekStartDate`).
- **Issue:** `weekStartDate` was `v.string()` with no format check.
- **Fix:** Added `isValidWeekStartDateString(s)` (YYYY-MM-DD regex + parseable date); `weekPlans.create` throws if invalid. Unit tests in `weekPlans.test.ts`.

**2.1.2 Check-ins: `listUnread` and index**

- **Where:** `convex/checkIns.ts` — `listUnread` uses `by_userId_readAt` with `q.eq("userId", userId)` then filters `readAt === undefined`.
- **Issue:** The compound index `(userId, readAt)` is only used for `userId`; all check-ins for the user are scanned, then filtered in memory. Fine at current scale; if check-ins grow large, this will not scale.
- **Recommendation:** Leave as-is for now. If you add pagination or expect heavy check-in volume, consider an index that supports “unread” directly (e.g. a dedicated “unread” table or a sentinel value for `readAt`) or cap the query (e.g. `.take(100)` before filter).

**2.1.3 Activation: backward compatibility for `tonalConnectedAt`**

- **Where:** `userProfiles.tonalConnectedAt` is optional; `docs/activation-metric.md` uses it for “signup” time.
- **Issue:** Existing users who connected Tonal before this field was added will have `tonalConnectedAt === undefined`. “40% within 72 hours” for them is undefined (we can’t compute “72h since signup”).
- **Recommendation:** Document that the metric applies to signups after the deployment that sets `tonalConnectedAt`. Optionally backfill from `lastActiveAt` or “first workoutPlans.createdAt” for existing users if you need a one-time approximation.

### 2.2 Medium priority

**2.2.1 Progressive overload: N+1 and cost**

- **Where:** `progressiveOverload.getPerMovementHistory` fetches activities, then for each activity calls `fetchWorkoutDetail` and optionally `fetchFormattedSummary`.
- **Issue:** For 20 activities this is 1 + 20 + up to 20 = 41 Tonal API calls per user per invocation. Rate limits and latency could bite.
- **Recommendation:** Consider caching per-user per-movement history in Convex (e.g. `tonalCache` with a key like `progressiveOverload:${userId}` and TTL 1–6 hours) and/or reducing `maxActivities` default (e.g. 10). Document this as a known cost and add monitoring if you scale.

**2.2.2 Check-in cron: silent failure** — **Fixed**

- **Where:** `runCheckInTriggerEvaluation` had `try { ... } catch { /* Skip */ }` per user.
- **Fix:** Catch block now logs `userId` and error message via `console.error` so misconfiguration or API issues are visible in Convex logs.

**2.2.3 Week plan `days` default**

- **Where:** `weekPlans.create` uses `DEFAULT_DAYS` (7× rest, programmed) when `args.days` is omitted or not length 7.
- **Issue:** Callers might expect “no plan” to mean “no days filled”; currently we always insert 7 slots. That’s consistent with “calendar has 7 days” but worth documenting.
- **Recommendation:** No change required; add a one-line comment above `DEFAULT_DAYS` that the week view always shows 7 days and an empty plan is “all rest, programmed.”

### 2.3 Low priority / polish

**2.3.1 WorkoutCard `planId` type**

- **Where:** `WorkoutCard` accepts `planId?: string`; `ToolCallIndicator` passes `planId` from tool output (Convex `Id<"workoutPlans">`).
- **Observation:** TypeScript accepts this (Id is string-like). For consistency you could type `planId` as `Id<"workoutPlans">` in the component if the rest of the app uses Convex IDs there.
- **Recommendation:** Optional; current code is correct.

**2.3.2 Exercise selection: empty catalog**

- **Where:** `selectExercises` returns `ordered.slice(0, maxExercises).map((m) => m.id)`. If `catalog` is empty, `eligible` is empty and we return `[]`.
- **Observation:** Caller gets an empty workout; no explicit “catalog empty” signal. Acceptable if the programming layer validates catalog presence before calling.
- **Recommendation:** Optional: add a one-line JSDoc that empty catalog yields empty list and caller should ensure catalog is loaded.

**2.3.3 Constants in checkIns**

- **Where:** Cooldowns and time windows are named constants at the top of `checkIns.ts`; `frequencyWindowMs` is a function.
- **Observation:** Clear and maintainable. No change needed.
- **Recommendation:** None.

---

## 3. Alignment with project guidelines (CLAUDE.md / AGENTS.md)

| Guideline                    | Status                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Correctness                  | Pass — logic and auth checks are correct in reviewed paths.                                                                    |
| Security                     | Pass — auth and ownership at boundaries; no `any` in new code.                                                                 |
| Clarity                      | Pass — function names and JSDoc are clear; validators and types are consistent.                                                |
| Max 300 lines/file           | Pass — no file in the reviewed set exceeds 300 lines.                                                                          |
| One component per .tsx       | Pass — WorkoutCard, WeekView, etc. are single-purpose.                                                                         |
| Tests                        | Pass — exercise selection, volumeIntensity, weekPlans helpers, hardware helpers, check-ins content have tests; 67 tests total. |
| No barrel files              | Pass — direct imports from source modules.                                                                                     |
| Convex: validate at boundary | Pass — args use Convex validators; internal functions receive typed data.                                                      |

---

## 4. Suggested next steps (ordered)

1. ~~**Add `weekStartDate` validation** (high)~~ — Done: `isValidWeekStartDateString` in create + tests.
2. ~~**Log check-in cron errors** (medium)~~ — Done: `console.error` with userId and error in catch.
3. ~~**Document activation cohort** (high)~~ — Done: In `docs/activation-metric.md`, state that “signup” and “40% in 72h” apply to users with `tonalConnectedAt` set (post-deploy); note backfill option for existing users.
4. ~~**Progressive overload cost** (medium)~~ — Done: `docs/progressive-overload-data.md` has "API call volume and cost".
5. ~~**Optional (done):**~~ Type `WorkoutCard` `planId` as `Id<"workoutPlans">`; add JSDoc for “empty catalog → empty list” in exercise selection.

---

## 5. Verdict

**Ship with minor follow-ups.** The code is consistent, secure, and aligned with the North Star spec and project rules. The items above are small improvements and documentation; none are blocking for merging. Prioritize `weekStartDate` validation and activation-cohort documentation so metrics and week-plan behavior stay correct as you add “program my week” and more users.
