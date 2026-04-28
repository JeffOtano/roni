# Review: perf/convex-cost-reduction

Scope reviewed: `origin/main...HEAD` at `8025763` (`perf/convex-cost-reduction`).

## Findings

### P2 - Workout-detail misses are now cached for 30 days

`convex/tonal/proxy.ts:282`

The branch changes `fetchWorkoutDetail` from `CACHE_TTLS.workoutHistory` to
`CACHE_TTLS.immutableWorkout`, which is 30 days. That long TTL is reasonable for
successful historical workout-detail payloads, but this same cache path also
stores negative results.

Evidence:

- `convex/tonal/proxy.ts:289-297` returns `null` when `projectWorkoutDetail`
  rejects a Tonal payload.
- `convex/tonal/proxy.ts:301-302` returns `null` when Tonal responds with `404`.
- `convex/tonal/proxy.ts:116-121` writes whatever `fetcher()` returned into
  `tonalCache` when the value fits the size limit. `null` fits, so it is cached.
- `convex/workoutDetail.ts:119-124` calls `fetchWorkoutDetail`, swallows action
  errors as `null`, and `convex/workoutDetail.ts:141` returns `null` to the UI
  when no detail is available.
- In `origin/main`, the same `workoutDetail:${activityId}` cache entry used
  `CACHE_TTLS.workoutHistory` at `convex/tonal/proxy.ts:273`, a 30-minute poison
  window instead of 30 days.

Impact:

A temporary Tonal `404`, an eventually-consistent workout-detail response, or a
schema payload that is rejected until the projection code is fixed can hide that
activity detail for up to 30 days unless the user manually purges cache. This is
especially risky because the public detail action converts the missing detail to
`null`, so the UI sees a normal "not found" shape rather than an error that would
force a refetch.

Suggested fix:

Use the immutable TTL only for successful projected workout-detail payloads.
Keep negative results on the old short `workoutHistory` TTL, or do not cache
projection failures / `404` results at all. A regression test should cover that
`null` detail responses are not persisted with `CACHE_TTLS.immutableWorkout`.

## Non-Findings Checked

- The `systemHealth` module, schema table, health-check fields, and dev-tools
  circuit-breaker UI were removed consistently. `rg` found no remaining live
  references outside `CHANGELOG.md`.
- The new `runCacheRetention` action is wired from `crons.ts` and covered by a
  positive prune test.
- The request-scoped `cachedFetch` memo deletes failed promises and dedupes
  concurrent same-key lookups within an action. I did not find a concrete
  same-action key collision in the current call sites.

## Verification

- `npm run typecheck` passed.
- `npx vitest run convex/tonal/proxyCacheBehavior.test.ts convex/dataRetention.test.ts convex/healthCheck.test.ts convex/tonal/proxy.test.ts` passed: 4 files, 30 tests.
- `npm run lint` passed.
- `npm test` passed: 142 files passed, 1 skipped; 1465 tests passed, 13 skipped.
- `npm run format:check` passed.
