# Contributing

Thanks for your interest in Tonal Coach. This is a personal project maintained by one person on a best-effort basis. PRs are welcome but may take time to review.

## Before you file an issue

Search existing issues first. Then pick the right channel:

- Security issue: follow [SECURITY.md](SECURITY.md) and email rather than opening a public issue
- Bug report or feature request: use the GitHub issue templates
- Usage or self-hosting help: start with [SUPPORT.md](SUPPORT.md)

## Development setup

See the [Self-host setup](README.md#self-host-setup) section of the README for the full onboarding path. The short version:

```bash
git clone https://github.com/JeffOtano/tonal-coach.git
cd tonal-coach
npm install
npm run setup        # interactive: bootstraps Convex, generates required secrets
npx convex dev       # in one terminal
npm run dev          # in another terminal
```

Use Node.js 22 to match `.nvmrc`. You will need a free Convex account, a Google AI Studio API key, and (for end-to-end testing) a Tonal account.

## Running tests

```bash
npm test                 # all tests once
npm run test:watch       # watch mode
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run test:e2e         # Playwright smoke tests
```

Every pull request runs through CI, which enforces:

- `npm run lint` (ESLint with `--max-warnings=0`)
- `npx prettier --check .`
- `npx knip` dead code check
- `npx tsc --noEmit`
- `npx vitest run --coverage`
- `npm run build` and a 1500KB JS bundle-size budget
- `npm audit --audit-level=high`
- Playwright E2E smoke tests
- A file-size check (300-line soft cap, 400-line hard limit)

Run the relevant commands locally before pushing so the PR stays green.

## Pull request guidelines

- One logical change per PR. Split unrelated work into separate PRs.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`. Commitlint enforces this via the `commit-msg` husky hook.
- Commit subjects default to lowercase. Commitlint rejects sentence-case, start-case, PascalCase, and UPPER CASE, so technical identifiers like `BYOK_REQUIRED_AFTER` in the middle of a subject are fine.
- Write tests for new behavior. The test pattern in this codebase is Vitest with `vi.mock` for Convex modules (no `convex-test`).
- Comments explain WHY, not WHAT. If you find yourself writing prose that describes what the next line does, rename something instead.
- Files have soft and hard size caps enforced by hooks and CI: 300-line warning, 400-line hard limit.
- Issues and pull requests are expected to stay within the project's [Code of Conduct](CODE_OF_CONDUCT.md).

## Code style

- TypeScript strict mode everywhere. `@typescript-eslint/no-explicit-any` blocks `any`. Avoid `as` casts except at deserialization boundaries (convention, not mechanically enforced).
- Prettier formats on commit via `lint-staged`.
- ESLint runs on commit.
- Prefer readonly, discriminated unions, exhaustive switches with `const _exhaustive: never = value`.

## What's in scope

- Bug fixes
- Small features that fit the existing architecture
- Documentation improvements
- Performance wins with measurements

## What's out of scope

- The iOS app is not in this repository (it stays in a private fork).
- Adding support for fitness machines other than Tonal is not on the roadmap right now, though the coach engine is mostly machine-agnostic. File an issue to discuss before starting work.
- There is a [Discord server](https://discord.gg/Sa5ewWP5M) for casual discussion, but GitHub issues remain the primary channel for bugs, features, and support.
