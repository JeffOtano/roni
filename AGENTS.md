# Agent Guidelines

This file provides coding standards for all AI agents (Cursor, Copilot, Windsurf, etc.).

For the full project guidelines including decision frameworks, priority hierarchy, and testing rules, see `CLAUDE.md` in the project root. The guidelines there apply to all contributors -- human and AI.

## Quick Reference

- **Stack:** Next.js 16, Convex, TypeScript strict, Tailwind CSS v4, shadcn/ui, Vitest
- **Formatting:** Prettier is enforced via pre-commit hooks. Don't manually format.
- **Max file size:** 300-line soft cap, 400-line hard cap. Split by responsibility if approaching the soft cap.
- **Max function size:** 60 lines. If longer, check the splitting decision tree in CLAUDE.md.
- **One component per `.tsx` file.** Named export matching the filename.
- **Tests:** Co-located as `<module>.test.ts`. Every function with logic gets a test.
- **Commits:** Conventional format: `type: description` (feat, fix, refactor, test, chore, docs)
- **No `any`.** No `as` casts except at deserialization boundaries with Zod validation.
- **No barrel files.** Import directly from source modules.

## Before You Write Code

1. Read existing code in the area you're modifying. Follow existing patterns.
2. Check if a utility/component already exists before creating a new one.
3. Define input types, output types, and error cases before implementing.

## After You Write Code

1. Run `npx tsc --noEmit` -- must pass.
2. Run `npm test` -- existing tests must pass.
3. If you wrote logic, write a test. If tests exist for what you changed, run them.
4. Check that no new or materially expanded file exceeds 300 lines, and that no file exceeds the 400-line hard cap.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->
