<p align="center">
  <img src="src/app/icon.svg" width="80" alt="Tonal Coach logo" />
</p>

<h1 align="center">Tonal Coach</h1>

<p align="center">
  AI-powered custom workouts for your Tonal
  <br />
  <a href="https://tonal.coach"><strong>tonal.coach</strong></a>
</p>

<p align="center">
  <a href="https://github.com/JeffOtano/tonal-coach/actions/workflows/ci.yml"><img src="https://github.com/JeffOtano/tonal-coach/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/JeffOtano/tonal-coach/releases/latest"><img src="https://img.shields.io/github/v/release/JeffOtano/tonal-coach?label=release&color=blue" alt="Latest release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="tsconfig.json"><img src="https://img.shields.io/badge/TypeScript-strict-3178c6.svg" alt="TypeScript" /></a>
  <a href="#testing"><img src="https://img.shields.io/badge/tests-Vitest-6E9F18.svg" alt="Vitest" /></a>
  <a href="https://discord.gg/Sa5ewWP5M"><img src="https://img.shields.io/discord/1482942052898574336?logo=discord&logoColor=white&label=Discord&color=5865F2" alt="Discord" /></a>
  <img src="https://img.shields.io/coderabbit/prs/github/JeffOtano/tonal-coach?utm_source=oss&utm_medium=github&utm_campaign=JeffOtano%2Ftonal-coach&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews" alt="CodeRabbit Pull Request Reviews" />
</p>

<p align="center">
  <img src="public/screenshots/hero.png" width="720" alt="Tonal Coach landing page" />
</p>

> [!IMPORTANT]
> **Not affiliated with Tonal Systems, Inc.** Tonal Coach is an independent, unofficial tool that works with Tonal fitness machines. "Tonal" is a trademark of Tonal Systems, Inc., used here under nominative fair use. This project is not endorsed by, sponsored by, or associated with Tonal Systems, Inc. in any way.

## What this is

Tonal Coach is an AI coaching companion for Tonal fitness machines. Connect your Tonal account, and the app reads your training history, strength scores, and workout data to program custom weekly workout plans. The coach uses Google Gemini models to select exercises, manage periodization, and push approved workouts directly to Tonal with no manual builder work. It is built on Next.js and Convex with real-time sync.

## Who it's for

This project is open-source for two reasons: technical users who want to self-host their own copy on free-tier infrastructure, and anyone who wants to audit the code to understand exactly how their Tonal credentials and workout data are handled. The code is the answer to "are you storing my password?"

## How the open-source model works

**Self-host.** Clone the repo, spin up a Convex deployment, set the required server secrets, and run locally or deploy to Vercel. You control the infrastructure, secrets, and data handling. Instructions are in the Self-Host Setup section below.

**Operator-managed deployments.** The codebase supports both a shared server-side Gemini key and per-user bring-your-own-key (BYOK) storage. Which mode is enforced is a deployment policy decision, not something the public repo can guarantee for any specific hosted instance.

## Features

- AI chat coach powered by Google Gemini with Tonal-specific tools - reads your Tonal history, programs workouts, explains decisions
- Custom weekly training plans with periodization (Building, Deload, and Testing blocks)
- Exercise selection based on your equipment, goals, and injury history
- Progressive overload tracking across sessions
- Injury and mobility constraint management
- One-click workout push directly to your Tonal - no manual entry
- Shared-key and bring-your-own-key (BYOK) support

<p align="center">
  <img src="public/screenshots/features-workout.png" width="720" alt="Custom workout pushed to Tonal with progressive overload tracking" />
</p>

## Project status

Active, maintained by one person. This is a personal project, not a startup. Issues triaged on a best-effort basis. PRs welcome but may take time to review.

## Stack

| Layer      | Technology                                           |
| ---------- | ---------------------------------------------------- |
| Frontend   | Next.js 16 (App Router), React 19, Tailwind CSS v4   |
| UI         | shadcn/ui (Base UI), Lucide icons                    |
| Backend    | Convex (queries, mutations, actions, real-time sync) |
| AI Coach   | `@convex-dev/agent` with Google Gemini models        |
| Auth       | @convex-dev/auth (password + Resend OTP)             |
| Monitoring | Sentry (web), Vercel Analytics                       |
| Deployment | Vercel (web), Convex (backend)                       |

## Prerequisites

- Node.js 22 (matches `.nvmrc`; Node.js 20+ should also work)
- npm
- A [Convex](https://convex.dev) account (free tier works)
- A [Google AI Studio](https://aistudio.google.com) API key for the server-side Gemini integration
- A [Resend](https://resend.com) account + API key (optional - only needed for password reset OTP emails)
- A Tonal account to test the integration end-to-end

## Self-Host Setup

```bash
git clone <repo-url> tonal-coach
cd tonal-coach
npm install
npm run setup        # interactive: bootstraps Convex, generates secrets, prompts for optional integrations

# In two separate terminals:
npx convex dev       # terminal 1
npm run dev          # terminal 2

# Open http://localhost:3000
```

`npm run setup` walks you through Convex deployment creation, generates `TOKEN_ENCRYPTION_KEY`, `EMAIL_CHANGE_CODE_PEPPER`, and the JWT keypair, and prompts for optional integrations (Resend, Discord webhooks, PostHog, Sentry). It is safe to re-run - existing values are preserved unless you choose to overwrite them.

By default, self-hosted deployments start with analytics, Sentry, and the public contact form disabled. Those integrations are opt-in and can be enabled during `npm run setup` or by setting the variables below.

## Environment Variables

### Convex backend - set via `npx convex env set KEY value`

| Variable                       | Description                                                             |
| ------------------------------ | ----------------------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio API key. Used for the shared Gemini key and embeddings |
| `AUTH_RESEND_KEY`              | Optional Resend API key (`re_...`). Sends password-reset OTP emails     |
| `TOKEN_ENCRYPTION_KEY`         | 64-char hex string. Encrypts Tonal OAuth tokens and BYOK Gemini keys    |
| `EMAIL_CHANGE_CODE_PEPPER`     | 64-char hex string. HMAC pepper for email-change verification codes     |
| `DISCORD_CONTACT_WEBHOOK`      | Optional Discord webhook for the public `/contact` form                 |
| `DISCORD_WEBHOOK_URL`          | Optional Discord webhook for operator notifications                     |
| `POSTHOG_PROJECT_TOKEN`        | Optional PostHog project token for server-side analytics                |
| `BYOK_DISABLED`                | Optional kill switch that forces all users onto the shared Gemini key   |
| `TOKEN_ENCRYPTION_KEY_OLD`     | Optional old key used only during encryption-key rotation               |
| `DISABLE_CRONS`                | Optional `true` to silence all cron jobs. Useful on dev deployments     |
| `CONVEX_SITE_URL`              | Set automatically by Convex. Do not set manually                        |

### Next.js - set in `.env.local`

| Variable                                          | Description                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `CONVEX_DEPLOYMENT`                               | Written automatically by `npx convex dev`. Do not edit                       |
| `NEXT_PUBLIC_CONVEX_URL`                          | Convex deployment URL (`https://<name>.convex.cloud`). Written automatically |
| `NEXT_PUBLIC_GITHUB_REPO_URL`                     | Optional public GitHub repo URL. Enables the OSS banner                      |
| `NEXT_PUBLIC_CONTACT_FORM_ENABLED`                | Optional `true` flag that enables the public `/contact` form UI              |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`               | Optional PostHog token for browser analytics                                 |
| `NEXT_PUBLIC_POSTHOG_HOST`                        | Optional PostHog host. Defaults to `/ingest`                                 |
| `NEXT_PUBLIC_SENTRY_DSN`                          | Optional Sentry DSN. Browser/server error reporting is off unless set        |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`           | Optional trace sample rate from `0` to `1`                                   |
| `NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`  | Optional session replay sample rate from `0` to `1`                          |
| `NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE` | Optional replay-on-error sample rate from `0` to `1`                         |

### Sentry server and build variables

Set these in Vercel project settings (or your deployment platform). The first three are only needed if you want Sentry source-map uploads during production builds. `SENTRY_TRACES_SAMPLE_RATE` is read at runtime by the Next.js server and edge Sentry instrumentation.

| Variable                    | Description                                                     |
| --------------------------- | --------------------------------------------------------------- |
| `SENTRY_AUTH_TOKEN`         | Build-time. Sentry auth token used by the Next.js build plugin  |
| `SENTRY_ORG`                | Build-time. Sentry organization slug                            |
| `SENTRY_PROJECT`            | Build-time. Sentry project slug                                 |
| `SENTRY_TRACES_SAMPLE_RATE` | Runtime. Optional server/edge trace sample rate from `0` to `1` |

## Project Structure

```
convex/                Backend (Convex)
  ai/                  AI coach agent, tool definitions, context builder
  coach/               Programming engine - exercise selection, periodization, progressive overload
  tonal/               Tonal API integration - OAuth, encrypted tokens, proxy with caching
  schema.ts            Full data model
  crons.ts             Scheduled jobs (token refresh, cache refresh, data retention)

src/
  app/                 Next.js pages (App Router)
    (app)/             Authenticated routes - dashboard, chat, schedule, stats, progress, strength, profile, settings, activity, check-ins, exercises
    connect-tonal/     Tonal OAuth connection flow
    login/             Auth pages
    onboarding/        New user onboarding (connect, preferences, optional Gemini key step)
    workouts/          Public workout library (SEO)
    features/          Public marketing routes
  components/          Shared React components

lib/                   Shared TypeScript types and utilities
scripts/               Build and CI helper scripts
```

## Commands

| Command                         | Description                              |
| ------------------------------- | ---------------------------------------- |
| `npm run dev`                   | Start Next.js dev server (port 3000)     |
| `npx convex dev`                | Start Convex dev backend with hot reload |
| `npm run typecheck`             | Type check with `tsc --noEmit`           |
| `npm test`                      | Run all tests once                       |
| `npx vitest --project backend`  | Backend tests only                       |
| `npx vitest --project frontend` | Frontend tests only                      |
| `npm run test:watch`            | Run tests in watch mode                  |
| `npm run test:coverage`         | Run tests with coverage report           |
| `npm run test:e2e`              | Run Playwright smoke tests               |
| `npm run build`                 | Production build                         |
| `npm run lint`                  | ESLint                                   |
| `npm run format`                | Prettier (write)                         |
| `npm run format:check`          | Prettier (check only)                    |
| `npm run knip`                  | Dead code detection                      |

## Testing

Vitest with two projects: `backend` (Node environment, `convex/**/*.test.ts`) and `frontend` (jsdom, `src/**/*.test.{ts,tsx}`). Test files are co-located next to source files.

```bash
npm test                              # all tests
npx vitest --project backend          # backend only
npx vitest --project frontend         # frontend only
npx vitest run convex/stats.test.ts   # single file
npm run test:e2e                      # Playwright smoke tests
```

Coverage thresholds are enforced in CI. Lint is also treated as a hard gate: warnings fail CI.

## Deployment

### Web App (Vercel + Convex)

```
npx convex deploy --cmd 'npm run build'
```

This is the build-command pattern used for Vercel deployments: deploy the Convex backend first, then run the Next.js production build.

**Setup:**

1. Connect the GitHub repo to a [Vercel](https://vercel.com) project
2. Set the following environment variables in Vercel project settings:
   - `CONVEX_DEPLOY_KEY` - get from Convex dashboard (Settings > Deploy keys)
   - `NEXT_PUBLIC_CONVEX_URL` - your production Convex URL (`https://<name>.convex.cloud`)
   - `NEXT_PUBLIC_GITHUB_REPO_URL` - optional, enables the OSS banner in production
   - `NEXT_PUBLIC_CONTACT_FORM_ENABLED` - optional, set to `true` only if `DISCORD_CONTACT_WEBHOOK` is configured
   - PostHog variables if using analytics (`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`)
   - Sentry variables if using error tracking (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`)
3. Set production secrets in the Convex dashboard (same keys as the env table above, with production values)
4. Push to `main` - Vercel auto-deploys on every push

### Convex backend only

```bash
npx convex deploy
```

## Architecture

### Core Data Flow

```
Tonal API --> [encrypted tokens] --> Convex proxy/cache layer --> Convex DB
                                                                     |
                                                                     v
User (chat) --> send message --> AI Coach Agent (Gemini, tool-driven) --> reads context
                                                                     |
                                                          creates workoutPlans (draft)
                                                                     |
                                                          user approves --> push to Tonal API
```

### AI Coach

The coach uses `@convex-dev/agent` with Google Gemini models. In the current codebase the primary model is `gemini-3-flash-preview`, the fallback model is `gemini-2.5-flash`, and embeddings use the server-side Google AI key. Tool-driven capabilities include:

- Read Tonal training history, strength scores, and workout data
- Create and modify weekly workout plans with periodization
- Select exercises based on equipment and training goals
- Manage goals, injuries, and training preferences
- Push approved workouts directly to Tonal

**Shared key + BYOK:** The Gemini provider is resolved per request. The repo supports both a shared server-side key and encrypted per-user BYOK storage. Whether BYOK is required is controlled by deployment policy in [`convex/byok.ts`](./convex/byok.ts); failed BYOK requests error explicitly instead of silently falling back.

### Tonal API Integration

- OAuth tokens encrypted with AES-256 at rest
- Cron refreshes expiring tokens every 30 minutes
- `withTokenRetry` pattern: try with current token, on 401 refresh and retry once
- Proxy layer with stale-while-revalidate caching to minimize API calls
- Circuit breaker pattern for API health tracking

### Scheduled Jobs

| Schedule         | Job                                                        |
| ---------------- | ---------------------------------------------------------- |
| Every 15 minutes | Recover stuck workout pushes                               |
| Every 15 minutes | Health check (expired tokens, stuck pushes, circuit state) |
| Every 30 minutes | Refresh Tonal tokens                                       |
| Every 30 minutes | Refresh active-user cache                                  |
| Every 1 hour     | Activation checks                                          |
| Every 6 hours    | Check-in evaluation (missed sessions, milestones)          |
| Every 6 hours    | Garbage-collect orphaned chat-image storage                |
| Cron `0 3 * * *` | Sync movement catalog                                      |
| Cron `0 4 * * 0` | Sync Tonal workout catalog                                 |
| Cron `0 2 * * 0` | Data retention cleanup                                     |

## Support the project

This project is free. Hosting and my time are not. If it's saved you work, consider chipping in. No pressure.

- [GitHub Sponsors](https://github.com/sponsors/JeffOtano)
- [Buy Me a Coffee](https://www.buymeacoffee.com/jeffotano)

## Community standards

- [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, coding standards, and PR expectations
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for community expectations
- [SUPPORT.md](./SUPPORT.md) for where to ask for help or report bugs
- [SECURITY.md](./SECURITY.md) for private security reporting
- [CHANGELOG.md](./CHANGELOG.md) for notable changes
- [RELEASING.md](./RELEASING.md) for the maintainer release workflow

## Security

See [SECURITY.md](./SECURITY.md) for private reporting and [docs/trust-model.md](./docs/trust-model.md) for the data-handling trust model.

## License

MIT. See [LICENSE](./LICENSE).
