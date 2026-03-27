Scaffold a new AI coach tool. Follow existing patterns exactly.

## Steps

1. Read the existing tool patterns:
   - `convex/ai/tools.ts` -- tool definitions and implementations
   - `convex/ai/agent.ts` -- agent configuration and tool registration

2. Ask for:
   - Tool name (verb phrase, e.g. "getStrengthScores")
   - What it does (one sentence)
   - What data it needs access to
   - Whether it reads data or writes data (or both)

3. Implement the tool following the existing pattern in `convex/ai/tools.ts`:
   - Use the same tool definition structure as neighboring tools
   - Add Zod input validation
   - Use `getEffectiveUserId()` for auth if user-scoped
   - For Tonal data: use the cached fetch pattern from `convex/tonal/`
   - For DB writes: use mutations, not direct writes in the tool

4. Register the tool in the agent configuration

5. Run `npx tsc --noEmit` to verify

## Rules

- Match the exact patterns of existing tools -- do not introduce new conventions
- Every tool must validate its inputs
- Read-only tools should use queries, not actions
- Tools that call external APIs must use actions
