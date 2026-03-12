# Guardrails Design: Defense in Depth for AI Agents and Human Contributors

**Date:** 2026-03-12
**Status:** Approved
**Source:** Distilled from `clean-code-patterns-report.md` (March 2026)

## Problem

AI agents (Claude Code, Cursor, Copilot) and future human contributors need consistent guardrails to maintain code quality. Currently: no project-level agent instructions, no CI pipeline, no pre-commit hooks, no formatting enforcement, limited ESLint rules.

## Design: 7-Layer Defense

### Layer 1: Agent Instructions (CLAUDE.md + AGENTS.md)

Decision frameworks from the patterns report's Part 2 -- priority hierarchy, decision trees, phase-based rules, red flag checklists. Teaches agents _how to think_, not just what to do.

### Layer 1b: Claude Code Hooks

Real-time mid-process verification:

- PostToolUse (Write/Edit): file size warning >300 lines
- PostToolUse (Write/Edit): ESLint on changed file
- PostToolUse (Write/Edit): component-per-file check for .tsx
- PostToolUse (Write): test companion check for convex/ logic files

### Layer 2: Formatting (Prettier + .editorconfig)

Zero-thought consistent style across all editors and agents.

### Layer 3: Code Quality (ESLint)

Built-in rules: `max-lines` (300), `max-lines-per-function` (60), `complexity` (10). Import ordering. No `any` via `no-restricted-syntax`.

### Layer 4: Dead Code (Knip)

Unused exports, phantom dependencies, unlisted dependencies. Catches cruft from agent-generated code.

### Layer 5: Testing Gate (Vitest + coverage)

Coverage thresholds with `@vitest/coverage-v8`. Minimum coverage that CI enforces.

### Layer 6: Git Workflow

- Commitlint: conventional commit format
- Husky + lint-staged: pre-commit enforcement
- PR template: review checklist

### Layer 7: CI Pipeline (GitHub Actions)

Type-check, lint, format-check, test with coverage, build, knip. Runs on push and PR. Must pass before merge.

## Files

| File                               | Action                                    |
| ---------------------------------- | ----------------------------------------- |
| `CLAUDE.md`                        | Create - project-level agent instructions |
| `AGENTS.md`                        | Create - universal agent instructions     |
| `.prettierrc`                      | Create - formatter config                 |
| `.prettierignore`                  | Create - formatter ignores                |
| `.editorconfig`                    | Create - editor settings                  |
| `.commitlintrc.json`               | Create - commit message rules             |
| `.github/workflows/ci.yml`         | Create - CI pipeline                      |
| `.github/pull_request_template.md` | Create - PR checklist                     |
| `knip.config.ts`                   | Create - dead code detection config       |
| `scripts/check-file-size.sh`       | Create - hook script                      |
| `eslint.config.mjs`                | Modify - add quality rules                |
| `vitest.config.ts`                 | Modify - add coverage                     |
| `package.json`                     | Modify - scripts and deps                 |
| `.claude/settings.local.json`      | Modify - add hooks                        |
