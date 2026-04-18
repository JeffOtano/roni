# Convex Backend

This directory contains the Roni backend: schema, queries, mutations, actions, HTTP endpoints, cron jobs, and the Tonal/AI integration layers.

## Layout

- `schema.ts` defines the data model.
- `ai/` contains the coach agent, prompt construction, and tool definitions.
- `coach/` contains deterministic programming logic such as exercise selection and periodization.
- `tonal/` contains the Tonal API client, proxy/cache layer, token handling, and sync jobs.
- `_generated/` is Convex-generated code. Do not edit it manually.

## Working In This Folder

Read [`convex/_generated/ai/guidelines.md`](./_generated/ai/guidelines.md) before changing Convex code. It captures project-specific rules that override generic Convex examples.

Useful commands from the repo root:

```bash
npx convex dev
npx convex deploy
npx tsc --noEmit
npm test
```

For overall project setup and environment variables, use the root [`README.md`](../README.md).
