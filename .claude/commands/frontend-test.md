Run only frontend tests.

```bash
npx vitest run --project frontend
```

If a specific file is mentioned in the conversation, run just that file:
```bash
npx vitest run src/<file>.test.tsx
```

Show the full output. Do not attempt to fix failures unless asked.
