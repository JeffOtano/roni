# Tonal Coach -- Project Guidelines

## Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui (Base UI)
- **Backend:** Convex (queries, mutations, actions), @convex-dev/agent for AI
- **Language:** TypeScript (strict mode), Zod for runtime validation
- **Testing:** Vitest, @vitest/coverage-v8
- **Formatting:** Prettier (auto-enforced via pre-commit hooks)
- **Package manager:** npm
- **Deployment:** Vercel

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
- `process.env` only in Convex actions or Next.js API routes. `NEXT_PUBLIC_` for client-side.
- Every new mutation/action: check if it needs rate limiting (see existing patterns in `convex/`).
- Validate external input with Zod at the action boundary. Internal functions receive typed data.
- The Tonal API integration uses `cachedFetch` pattern -- check cache, fetch if expired, update cache.

## Automated Enforcement

The following are enforced by tooling -- you don't need to remember them:

- **Formatting:** Prettier runs on pre-commit (husky + lint-staged)
- **File size:** ESLint `max-lines: 300` (warning), `max-lines-per-function: 60` (warning)
- **Complexity:** ESLint `complexity: 10`
- **Type safety:** `npx tsc --noEmit` runs via post-edit hook and CI
- **Dead code:** Knip runs in CI
- **Commit format:** Commitlint enforces `type: description`
- **Coverage:** Vitest coverage thresholds enforced in CI
