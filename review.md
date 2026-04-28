# Review: perf/convex-cost-reduction

Scope reviewed: `origin/main...HEAD` at `aefe1b4` (`perf/convex-cost-reduction`).

## Findings

### P2 - Removed circuit breaker now hits Tonal on every expired-cache fallback

`convex/tonal/proxy.ts:106`

The branch removes the `systemHealth` circuit breaker and its schema table, but
does not replace the outage/load-shed behavior with another low-contention
backoff. Fresh cache hits still return immediately, but once a cache row is
expired, the current code always calls `fetcher()` before it can serve stale
data:

- Current branch: `convex/tonal/proxy.ts:102-107` returns fresh cache rows, then
  calls `fetcher()` for expired rows.
- Current branch: `convex/tonal/proxy.ts:142-144` serves stale cached data only
  after that outbound Tonal request fails.
- `origin/main`: `convex/tonal/proxy.ts:77-80` checked
  `internal.systemHealth.isCircuitOpen` and returned stale data without calling
  Tonal when the circuit was open and stale data existed.
- `origin/main`: `convex/tonal/proxy.ts:123-125` recorded non-auth refresh
  failures so repeated failures could open that circuit.

Impact:

During a Tonal outage or sustained 5xx/timeout period, every action with expired
stale data now waits on a Tonal request before falling back. `tonalFetch` uses a
15s timeout for GETs, so this can add user-visible latency and can amplify
external API traffic/rate-limit pressure exactly when the stale cache should be
protecting the app. The request-scoped memo dedupes same-key calls within one
action, but it does not protect across actions, users, or different cache keys.

Suggested fix:

Keep the OCC/cost reduction, but replace the removed circuit table with a
low-contention backoff signal. For example, store a short-lived per-service
`skipUntil`/failure state in a small operational table, use coarser write
throttling, or keep this state in whatever shared low-write operational layer is
preferred. Add a regression test that an active backoff state plus an expired
cache row returns stale data without invoking the fetcher.

## Previously Reported Finding

The earlier review finding about 30-day caching of `null` workout-detail results
has been addressed in `645bc35`. `cachedFetch` now accepts `shouldCache`, and
`fetchWorkoutDetail` opts out for `null` values. The focused test suite includes
coverage that `shouldCache: false` skips the cache write.

## Non-Findings Checked

- The deleted `systemHealth` module/table no longer has live references in
  `convex/` or `src/`; only dated planning docs and `CHANGELOG.md` mention it.
- `getTokenHealth` and `TokenHealth` agree on the reduced payload after removing
  circuit-breaker status from the dev-tools UI.
- `runCacheRetention` is wired from `crons.ts`, covered by a positive prune
  test, and preserves daily retention for non-cache telemetry tables.
- The new request-scoped `cachedFetch` memo deletes rejected promises and I did
  not find a concrete current call site that reuses the same memo key with
  incompatible fetch semantics.

## Verification

- `npm run typecheck` passed.
- `npx vitest run convex/tonal/proxyCacheBehavior.test.ts convex/dataRetention.test.ts convex/healthCheck.test.ts convex/tonal/proxy.test.ts convex/tonal/proxyTruncation.test.ts convex/workoutDetail.test.ts` passed: 6 files, 78 tests.
- `npm run lint` passed.
- `npm test` passed: 142 files passed, 1 skipped; 1466 tests passed, 13 skipped.
- `npm run format:check` passed.
- `git diff --check origin/main...HEAD` passed.
