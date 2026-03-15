# tonal-coach

An AI coaching companion for Tonal fitness machines. Connect your Tonal account, and the app reads your training history, strength scores, and workout data to program custom weekly plans. The AI coach (Gemini 2.5 Pro) selects exercises, manages periodization, and pushes completed workouts directly to your Tonal — no manual entry.

## Stack

- **Next.js 16** (App Router) — frontend and API routes
- **Convex** — backend: queries, mutations, actions, real-time sync
- **@convex-dev/agent** — AI agent framework (Gemini 2.5 Pro)
- **@convex-dev/auth** — password auth with Resend OTP for password reset
- **Tailwind CSS v4** + **shadcn/ui** (Base UI) — styling

## Prerequisites

- Node.js 20+
- npm
- A [Convex](https://convex.dev) account (free tier works)
- A [Google AI Studio](https://aistudio.google.com) API key — the coach uses Gemini 2.5 Pro
- A [Resend](https://resend.com) account + API key — used for password reset OTP emails
- A Tonal account to test the integration end-to-end

## Getting started

```bash
# 1. Clone and install
git clone <repo-url> tonal-coach
cd tonal-coach
npm install

# 2. Start the Convex dev backend (creates a new deployment on first run)
npx convex dev
# Follow the prompts to log in and create a project.
# This writes CONVEX_DEPLOYMENT and NEXT_PUBLIC_CONVEX_URL into .env.local.

# 3. Copy env file and fill in values (see table below)
cp .env.example .env.local
# CONVEX_DEPLOYMENT and NEXT_PUBLIC_CONVEX_URL are already set by step 2.
# Add NEXT_PUBLIC_CONVEX_SITE_URL (same deployment name, .convex.site domain).

# 4. Set Convex backend secrets (these live in Convex, not .env.local)
npx convex env set GOOGLE_GENERATIVE_AI_API_KEY  your-google-ai-key
npx convex env set AUTH_RESEND_KEY                re_your_resend_key
npx convex env set TOKEN_ENCRYPTION_KEY           $(openssl rand -hex 32)
npx convex env set PROGRESS_PHOTOS_ENCRYPTION_KEY $(openssl rand -hex 32)
npx convex env set GOOGLE_CLIENT_ID               your-google-oauth-client-id
npx convex env set GOOGLE_CLIENT_SECRET           your-google-oauth-client-secret
npx convex env set GOOGLE_REDIRECT_URI            https://your-deployment.convex.site/google/callback
npx convex env set APP_URL                        http://localhost:3000

# 5. Start the Next.js dev server (in a second terminal)
npm run dev

# 6. Open http://localhost:3000
```

`npx convex dev` and `npm run dev` need to run concurrently in separate terminals.

## Environment variables

### Convex backend — set via `npx convex env set KEY value`

| Variable                         | Description                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GOOGLE_GENERATIVE_AI_API_KEY`   | Google AI Studio API key. Used by Gemini 2.5 Pro (coach) and Gemini 2.5 Flash (photo analysis).        |
| `AUTH_RESEND_KEY`                | Resend API key (`re_...`). Sends password-reset OTP emails.                                            |
| `TOKEN_ENCRYPTION_KEY`           | 64-char hex string (32 bytes). Encrypts Tonal OAuth tokens at rest. Generate: `openssl rand -hex 32`.  |
| `PROGRESS_PHOTOS_ENCRYPTION_KEY` | 64-char hex string (32 bytes). Encrypts progress photo storage keys. Generate: `openssl rand -hex 32`. |
| `GOOGLE_CLIENT_ID`               | Google OAuth client ID. Required for Google Calendar integration.                                      |
| `GOOGLE_CLIENT_SECRET`           | Google OAuth client secret. Required for Google Calendar integration.                                  |
| `GOOGLE_REDIRECT_URI`            | OAuth callback URL, e.g. `https://<deployment>.convex.site/google/callback`.                           |
| `APP_URL`                        | Public app URL for OAuth redirects. Use `http://localhost:3000` locally.                               |
| `CONVEX_SITE_URL`                | Set automatically by Convex. Used in `auth.config.ts`. Do not set manually.                            |

### Next.js — set in `.env.local`

| Variable                      | Description                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `CONVEX_DEPLOYMENT`           | Written automatically by `npx convex dev`. Do not edit.                                    |
| `NEXT_PUBLIC_CONVEX_URL`      | Convex deployment URL (`https://<name>.convex.cloud`). Written automatically.              |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex HTTP URL (`https://<name>.convex.site`). Add this manually after `convex dev` runs. |

## Project structure

```
convex/              Backend (Convex)
  ai/                AI coach agent, tool definitions, context builder
  coach/             Programming engine — exercise selection, periodization, session planning
  tonal/             Tonal API integration — OAuth, token refresh, proxy, write mutations
  google/            Google Calendar OAuth client
  mcp/               MCP server for Claude Desktop / Claude Code integration
  schema.ts          Full data model

src/
  app/               Next.js pages (App Router)
    (app)/           Authenticated routes — dashboard, chat, week plan, progress
    connect-tonal/   Tonal OAuth connection flow
    login/           Auth pages
    onboarding/      New user onboarding flow
    settings/        Account and preferences
  components/        React components
```

## Key commands

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Start Next.js dev server on port 3000    |
| `npx convex dev`        | Start Convex dev backend with hot reload |
| `npm run typecheck`     | Type check with `tsc --noEmit`           |
| `npm test`              | Run all tests once                       |
| `npm run test:watch`    | Run tests in watch mode                  |
| `npm run test:coverage` | Run tests with coverage report           |
| `npm run build`         | Production build                         |
| `npm run lint`          | ESLint                                   |
| `npm run format`        | Prettier (write)                         |

## Testing

Vitest with two projects: `backend` (Node environment, `convex/**/*.test.ts`) and `frontend` (jsdom, `src/**/*.test.{ts,tsx}`). Test files are co-located next to source files.

```bash
npm test                       # run all tests
npx vitest --project backend   # backend only
npx vitest --project frontend  # frontend only
```
