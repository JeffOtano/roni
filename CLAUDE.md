# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Tonal Coach is an AI coaching companion for Tonal fitness machines. Users connect their Tonal account, and the AI coach (Gemini) reads their training history, strength scores, and workout data to program custom weekly plans. The coach pushes completed workouts directly to Tonal. There is also a native iOS app with Apple HealthKit integration.

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui (Base UI)
- **Backend:** Convex (queries, mutations, actions), @convex-dev/agent for AI coach
- **iOS:** Swift (Xcode), Convex Swift SDK, HealthKit
- **Language:** TypeScript (strict mode), Zod for runtime validation
- **Testing:** Vitest, @vitest/coverage-v8
- **Formatting:** Prettier (auto-enforced via pre-commit hooks)
- **Package manager:** npm
- **Deployment:** Vercel (web), Convex (backend)

## Conductor Workspaces

This project uses [Conductor](https://conductor.build) for parallel agent development. Each workspace is an isolated git worktree with its own branch.

- **Environment files** (`.env.local`, `.env.sentry-build-plugin`) are symlinked from the repo root via the setup script -- do not copy or create them manually
- **Dev server port**: Use `$CONDUCTOR_PORT` instead of hardcoding 3000. The run script handles this automatically
- **Convex dev**: All workspaces share the same Convex dev deployment, so avoid running schema-altering backend changes in parallel. `npx convex dev` is started by the run script
- **Workspace path**: Available as `$CONDUCTOR_WORKSPACE_PATH`. The repo root is `$CONDUCTOR_ROOT_PATH`
- **Branch per workspace**: Each workspace gets a unique branch. Rename with `git branch -m new-name`

## Development Commands

```bash
# Dev servers (run concurrently in separate terminals)
npx convex dev              # Convex backend with hot reload
npm run dev                 # Next.js dev server (port 3000)

# Verification (run after every code change)
npm run typecheck           # tsc --noEmit

# Testing
npm test                    # all tests once
npx vitest --project backend   # backend tests only (convex/**/*.test.ts)
npx vitest --project frontend  # frontend tests only (src/**/*.test.{ts,tsx})
npx vitest run convex/stats.test.ts  # single test file
npm run test:watch          # watch mode
npm run test:coverage       # with coverage report

# Code quality
npm run lint                # ESLint
npm run format              # Prettier (write)
npm run format:check        # Prettier (check only)
npm run knip                # Dead code detection

# Build
npm run build               # Production build

# Convex
npx convex env set KEY value   # Set backend environment variable
npx convex deploy              # Deploy to production
```

## Architecture

### Core Data Flow

```
Tonal API --> [encrypted tokens] --> Convex proxy/cache layer --> Convex DB
                                                                     |
Apple HealthKit --> iOS app --> health.syncSnapshot mutation -------->|
                                                                     v
User (chat) --> sendMessage --> AI Coach Agent (Gemini, 33 tools) --> reads context
                                                                     |
                                                          creates workoutPlans (draft)
                                                                     |
                                                          user approves --> push to Tonal API
```

### Backend Domains (`convex/`)

- **`ai/`** -- Coach agent definition, 33 tools (read Tonal data, create/modify workouts, manage goals/injuries), context builder that injects training snapshot as system message, prompt construction
- **`coach/`** -- Programming engine: exercise selection, periodization (Building/Deload/Testing blocks), progressive overload tracking
- **`tonal/`** -- Tonal API integration: OAuth token management (AES-256 encrypted at rest), proxy layer with stale-while-revalidate caching, history sync, movement/workout catalog sync
- **`mcp/`** -- MCP server for Claude Desktop integration (authenticated via API keys)
- **`lib/auth.ts`** -- `getEffectiveUserId()` helper used by all user-facing queries/mutations; thin wrapper over `getAuthUserId`

### Auth & Beta Cap

- Password auth via `@convex-dev/auth` with Resend OTP for password reset
- Beta capped at 50 users (enforced in both client pre-check via `userProfiles:canSignUp` AND server-side in `auth.ts` `createOrUpdateUser` callback)
- The server-side check is a safety net only -- if it throws, `@convex-dev/auth` has already created an orphaned auth entry. Clients must check capacity first.
- `BETA_SPOT_LIMIT` constant must stay in sync between `auth.ts` and `userProfiles.ts`

### Tonal API Token Management

- Tokens encrypted with `TOKEN_ENCRYPTION_KEY` (AES-256), stored in `userProfiles`
- Cron refreshes expiring tokens every 30 minutes (`tonal/tokenRefresh.ts`)
- `withTokenRetry` pattern: try with current token, on 401 refresh and retry
- `withTonalToken()` helper encapsulates token decryption and injection

### Scheduled Jobs (`crons.ts`)

- Every 30m: refresh Tonal tokens, refresh active user cache
- Every 15m: recover stuck workout pushes
- Every 1h: activation checks
- Every 6h: check-in trigger evaluation (missed sessions, milestones)
- Daily 3 AM: sync movement catalog
- Weekly Sunday 4 AM: sync Tonal workout catalog

### iOS App (`ios/TonalCoach/`)

Native Swift app sharing the same Convex backend. Key modules:

- `Auth/` -- Convex session management, password auth
- `Chat/` -- Real-time AI chat with tool approval cards
- `Health/` -- HealthKit integration (sleep, HRV, steps, weight) synced daily via `health.syncSnapshot`
- `Tonal/` -- Dashboard cards (strength scores, training load, muscle readiness)
- `Schedule/` -- Weekly plan display
- `Shared/Theme.swift` -- Centralized colors, `AnimationConstants.swift` for animation presets

### Frontend Routes (`src/app/`)

- `(app)/` -- Authenticated area: dashboard, chat, schedule, stats, progress, profile, settings
- `onboarding/` -- 3-step flow: questionnaire, equipment, training preferences
- `connect-tonal/` -- Tonal OAuth connection flow
- `login/`, `reset-password/` -- Auth pages

### Rate Limiting

Uses `@convex-dev/rate-limiter`. Key limits defined in `convex/rateLimits.ts`:

- `sendMessage` -- burst + daily cap per user
- `syncHealthSnapshot` -- per-user sync rate
- `mcpRequest` -- per-user MCP API calls

## Priority Hierarchy

When principles conflict, the higher number always wins.

1. **Correctness** -- Code must produce correct results and pass all tests. Never overridden.
2. **Security** -- Every system boundary validates auth, input, and ownership.
3. **Clarity** -- A developer unfamiliar with the codebase can read any function without external context.
4. **Simplicity** -- Write the least code that satisfies the requirement. No speculative abstractions.
5. **Decoupling** -- A change to module A should not force changes in module B.
6. **DRY** -- Each piece of knowledge exists in one place. May duplicate when the shared abstraction would couple unrelated modules.
7. **Performance** -- Optimize only measured bottlenecks. May pre-optimize when cost is zero (Map vs repeated array scan) or when O(n) vs O(n^2) at known scale.

## Decision Trees

### Should I extract a shared abstraction?

- Do I have 3+ concrete cases? No -> don't abstract. Duplication is cheaper than the wrong abstraction.
- Do all cases change for the same reason? No -> don't abstract. Incidental duplication will diverge.
- Is the abstraction simpler than the duplication? No -> don't abstract.
- Yes to all -> extract it. Minimal interface. Parameterize only what varies today.

### Should I split this function?

- Is it >60 lines? No -> probably fine. Stop unless readability is poor.
- Can I name the extracted piece with a meaningful domain name (not `doStep2`)? No -> don't split.
- Will the extracted piece have >1 caller? Yes -> split into its own exported function.
- Is it a sequential coordination function (imperative shell)? Yes -> keep together, add phase comments.
- Otherwise -> split, but keep in the same file unless independently testable.

### Should I add an interface/abstraction layer?

- Do I have 2+ implementations today? No -> is this at a system boundary (DB, external API)? No -> don't add it. Yes -> add it for testability.
- Am I adding it "for future flexibility"? -> Don't. YAGNI. Extract when the second implementation arrives.

### Should I handle this error or let it propagate?

- Is this a system boundary (API route, webhook, queue consumer)? -> Catch, return structured error, log with context.
- Can I add meaningful context the caller doesn't have? -> Catch, wrap with context, re-throw.
- Is this an expected business case (not found, validation, permissions)? -> Handle explicitly.
- Otherwise -> let it propagate. Don't catch just to log and re-throw.

### Should I add a test?

- Pure function with logic (conditionals, transforms, calculations)? -> Unit test. Happy path + at least one edge case.
- API route or Convex mutation/action? -> Test. Happy path + at least one auth/validation error case.
- Trivial getter/setter with no logic? -> Don't test.
- Wires together other tested pieces with no new logic? -> Integration test, not unit test.
- Testing framework behavior? -> Don't test. Trust the framework.

## Phase Rules

### Before Writing

- **Dependency direction:** UI -> Application -> Domain. Never reverse.
- **State shape:** Use discriminated unions, not boolean flags. Make illegal states unrepresentable.
- **Error strategy:** Decide Result types vs exceptions BEFORE writing. Don't mix within a layer.
- **API surface:** Define input types, output types, and error cases before implementing the body.

### While Writing

- Function names use a verb. If you need "and" in the name, split it.
- Max 3 positional arguments. Beyond that, use an options object.
- Return empty collections (`[]`, `{}`) instead of null for expected empty results.
- Default to `readonly`. Mutate only with measured performance reason.
- Guard clauses at the top, happy path unindented. No nested if/else pyramids.
- No magic values. Extract to named constants.
- Comments explain WHY, never WHAT. If explaining WHAT, rename instead.
- No `any`. No `as` casts except at deserialization boundaries with runtime validation (Zod).
- Exhaustive switches: use `const _exhaustive: never = value` for unhandled union members.

### After Writing

- Can I explain the function in one sentence without "and"?
- Does the abstraction have 2+ callers TODAY? If not, inline it.
- Does each test verify behavior (input -> output) or implementation details?
- Does each catch block add information, or just re-throw/swallow?
- Would a junior developer understand this without a walkthrough?
- Can I delete any code and still pass all tests? If yes, it's dead -- remove it.

## Red Flags (stop and reconsider)

- You created a utility function used by exactly one caller
- Your abstraction has more lines than the duplication it replaced
- A function has >3 levels of nesting
- A file exceeds 300 lines (ESLint enforced)
- A function exceeds 60 lines (ESLint enforced)
- You're mocking >2 dependencies in a single test
- A function takes >5 parameters
- You added a parameter "just in case"
- You built configuration for something with exactly one value
- You created an interface with exactly one implementation (not at a system boundary)

## File Organization

- **One component per `.tsx` file.** Named export matching the filename.
- **Max 300 lines per file.** If approaching this, split by responsibility.
- **Convex modules:** One concept per file in `convex/`. Queries, mutations, and actions for the same domain live together.
- **Test files:** Co-located as `<module>.test.ts` next to the source file.
- **No barrel files** (`index.ts` that re-exports). Import directly from the source module.

## Testing Rules

- Test behavior, not implementation. Test inputs and outputs, not internal wiring.
- AAA structure: Arrange, Act, Assert. Separate with blank lines.
- Name tests as sentences: "rejects appointments scheduled in the past"
- Mock at boundaries (DB, APIs, email), not internal functions.
- Every function gets at least one error/edge case test.
- Tests must be deterministic. No reliance on system time, random values, or network.
- Use test data builders for complex objects (provide defaults, allow overrides).

## Convex Patterns

- Use `query` for reads, `mutation` for DB writes, `action` for external API calls.
- Prefix functions with `internal.*` when they should not be callable from the frontend.
- All user-facing queries/mutations must call `getEffectiveUserId()` from `convex/lib/auth.ts` to resolve the authenticated user.
- `process.env` only in Convex actions or Next.js API routes. `NEXT_PUBLIC_` for client-side.
- Every new mutation/action: check if it needs rate limiting (see `convex/rateLimits.ts`).
- Validate external input with Zod at the action boundary. Internal functions receive typed data.
- The Tonal API integration uses `cachedFetch` pattern -- check cache, fetch if expired, update cache.

## Key Type Locations

- **Tonal API types** (TonalUser, Movement, Activity, StrengthScore, etc.): `convex/tonal/types.ts`
- **Domain types** (MuscleGroup, SessionDurationMinutes, OverloadSuggestion, etc.): `lib/volumeIntensityTypes.ts`
- **Enriched week plan** (EnrichedDay, EnrichedWeekPlan): `convex/weekPlanEnriched.ts`
- **Week plan validators/constants** (SESSION_TYPES, DAY_STATUSES, preferredSplitValidator): `convex/weekPlanHelpers.ts`
- **Convex document/ID types**: `import type { Doc, Id } from "./_generated/dataModel"`
- **Workout block structure**: `convex/validators.ts` (blockInputValidator)

## Installed UI Components (shadcn/ui)

alert, badge, button, card, dialog, input, label, scroll-area, separator, skeleton, textarea

Install new ones with `npx shadcn@latest add <component>`.

## Error Handling

All errors use `throw new Error("message")` -- no custom error classes or ConvexError. Three patterns:

- **Auth/ownership guard** (top of handler): `if (!userId) throw new Error("Not authenticated")`
- **Validation** (before processing): `if (args.dayIndex < 0 || args.dayIndex > 6) throw new Error("dayIndex must be 0-6")`
- **Action return objects** (actions that callers need to distinguish success/failure): `return { error: "reason" }` or `return { weekPlanId }`

## Automated Enforcement

The following are enforced by tooling -- you don't need to remember them:

- **Formatting:** Prettier runs on pre-commit (husky + lint-staged)
- **File size:** ESLint `max-lines: 300` (warning), `max-lines-per-function: 60` (warning)
- **Complexity:** ESLint `complexity: 10`
- **Type safety:** `npx tsc --noEmit` runs via post-edit hook and CI
- **Dead code:** Knip runs in CI
- **Commit format:** Commitlint enforces `type: description`
- **Coverage:** Vitest coverage thresholds enforced in CI

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->
