Deploy Tonal Coach to production. This affects live users -- be careful.

## Steps

1. Run the full verification pipeline first:
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npm test`
   - All must pass. Stop if any fail.

2. Show a summary of what will be deployed:
   - `git log --oneline main..HEAD` (commits being deployed)
   - Flag any schema changes in `convex/schema.ts`
   - Flag any new environment variables needed

3. **Ask for explicit confirmation before proceeding.**

4. Deploy Convex backend:

   ```bash
   npx convex deploy
   ```

5. Report the result. The Next.js frontend deploys automatically via Vercel on merge to main.

## Rules

- Never deploy without running verification first
- Always ask for confirmation -- this is a production deployment
- If schema changes exist, warn that they may require backfill
- If new env vars are needed, list them and confirm they're set in production
