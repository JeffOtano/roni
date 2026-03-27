Full verification pipeline for Tonal Coach. Run after completing any code change.

## Steps

1. Run `npx tsc --noEmit` -- fix any type errors before continuing
2. Run `npm run lint` -- fix any lint errors
3. Run `npm run format:check` -- if failures, run `npm run format` then re-check
4. Run `npm test` -- all tests must pass
5. If any step fails, fix the issue and re-run that step before moving on

## Output

- PASS: All checks green
- FAIL: [which step failed + error summary]
