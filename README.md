# Tonal Coach

An AI coaching companion for [Tonal](https://www.tonal.com) fitness machines. Connect your Tonal account, and the app reads your training history, strength scores, and workout data to program custom weekly plans. The AI coach (Gemini 2.5 Pro) selects exercises, manages periodization, and pushes completed workouts directly to your Tonal - no manual entry.

Available as a web app (Next.js) and a native iOS app (SwiftUI) sharing the same Convex backend.

## Stack

| Layer      | Technology                                           |
| ---------- | ---------------------------------------------------- |
| Frontend   | Next.js 16 (App Router), React 19, Tailwind CSS v4   |
| UI         | shadcn/ui (Base UI), Lucide icons                    |
| Backend    | Convex (queries, mutations, actions, real-time sync) |
| AI Coach   | @convex-dev/agent with Gemini 2.5 Pro (33 tools)     |
| Auth       | @convex-dev/auth (password + Resend OTP)             |
| iOS        | SwiftUI, Convex Swift SDK, HealthKit                 |
| Monitoring | Sentry (web), Vercel Analytics                       |
| Deployment | Vercel (web), Convex (backend), Xcode Cloud (iOS)    |

## Prerequisites

- Node.js 20+
- npm
- A [Convex](https://convex.dev) account (free tier works)
- A [Google AI Studio](https://aistudio.google.com) API key - the coach uses Gemini 2.5 Pro
- A [Resend](https://resend.com) account + API key - used for password reset OTP emails
- A Tonal account to test the integration end-to-end

For the iOS app:

- Xcode 15+ (macOS only)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)
- Apple Developer account (for device builds and HealthKit)

## Getting Started

### Web App

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

### iOS App

```bash
# 1. Generate the Xcode project
cd ios
xcodegen generate

# 2. Open in Xcode
open TonalCoach.xcodeproj

# 3. Select a simulator or device target and run (Cmd+R)
```

- Minimum deployment target: iOS 17.0
- Debug builds point to the dev Convex deployment; Release builds point to production
- HealthKit requires a physical device (not available on simulator)
- Bundle ID: `coach.tonal.app`

## Environment Variables

### Convex backend - set via `npx convex env set KEY value`

| Variable                         | Description                                                                 |
| -------------------------------- | --------------------------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY`   | Google AI Studio API key. Used by Gemini 2.5 Pro (coach) and Flash (photos) |
| `AUTH_RESEND_KEY`                | Resend API key (`re_...`). Sends password-reset OTP emails                  |
| `TOKEN_ENCRYPTION_KEY`           | 64-char hex string. Encrypts Tonal OAuth tokens. `openssl rand -hex 32`     |
| `PROGRESS_PHOTOS_ENCRYPTION_KEY` | 64-char hex string. Encrypts progress photo keys. `openssl rand -hex 32`    |
| `GOOGLE_CLIENT_ID`               | Google OAuth client ID for Calendar integration                             |
| `GOOGLE_CLIENT_SECRET`           | Google OAuth client secret for Calendar integration                         |
| `GOOGLE_REDIRECT_URI`            | OAuth callback: `https://<deployment>.convex.site/google/callback`          |
| `APP_URL`                        | Public app URL for OAuth redirects. `http://localhost:3000` locally         |
| `CONVEX_SITE_URL`                | Set automatically by Convex. Do not set manually                            |

### Next.js - set in `.env.local`

| Variable                      | Description                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `CONVEX_DEPLOYMENT`           | Written automatically by `npx convex dev`. Do not edit                       |
| `NEXT_PUBLIC_CONVEX_URL`      | Convex deployment URL (`https://<name>.convex.cloud`). Written automatically |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex HTTP URL (`https://<name>.convex.site`). Add manually after step 2    |

## Project Structure

```
convex/                Backend (Convex)
  ai/                  AI coach agent, 33 tool definitions, context builder
  coach/               Programming engine - exercise selection, periodization, progressive overload
  tonal/               Tonal API integration - OAuth, encrypted tokens, proxy with caching
  google/              Google Calendar OAuth client
  mcp/                 MCP server for Claude Desktop / Claude Code integration
  schema.ts            Full data model
  crons.ts             Scheduled jobs (token refresh, cache refresh, data retention)

src/
  app/                 Next.js pages (App Router)
    (app)/             Authenticated routes - dashboard, chat, schedule, stats, progress
    connect-tonal/     Tonal OAuth connection flow
    login/             Auth pages
    onboarding/        New user onboarding (questionnaire, equipment, preferences)
    workouts/          Public workout library (SEO)
    features/          Marketing pages
  components/          Shared React components

ios/
  TonalCoach/          Native iOS app (SwiftUI)
    App/               Entry point, root navigation, deep links
    Auth/              Login, signup, password reset, Keychain storage
    Chat/              Real-time AI coach chat with tool approvals
    Health/            HealthKit integration (sleep, HRV, steps, weight)
    Tonal/             Dashboard cards (strength, training load, muscle readiness)
    Schedule/          Weekly plan display
    Shared/            Design system (Theme.swift, animations, haptics)
  project.yml          XcodeGen project definition

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
```

## Deployment

### Web App (Vercel + Convex)

The web app deploys to Vercel with Convex as the backend. Vercel runs the build command from `vercel.json`:

```
npx convex deploy --cmd 'npm run build'
```

This deploys the Convex backend first, then builds and deploys the Next.js frontend.

**Setup:**

1. Connect the GitHub repo to a [Vercel](https://vercel.com) project
2. Set the following environment variables in Vercel project settings:
   - `CONVEX_DEPLOY_KEY` - get from Convex dashboard (Settings > Deploy keys)
   - `NEXT_PUBLIC_CONVEX_URL` - your production Convex URL (`https://<name>.convex.cloud`)
   - `NEXT_PUBLIC_CONVEX_SITE_URL` - your production Convex site URL (`https://<name>.convex.site`)
   - Sentry variables if using error tracking (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`)
3. Set production secrets in the Convex dashboard (same keys as the env table above, but with production values)
4. Push to `main` - Vercel auto-deploys on every push

**Manual deploy:**

```bash
npx convex deploy --cmd 'npm run build'
```

### iOS App (Xcode Cloud)

The iOS app uses Xcode Cloud for CI/CD.

**Setup:**

1. In Xcode, go to Product > Xcode Cloud > Create Workflow
2. Configure the workflow:
   - Start condition: changes to `ios/` directory on `main` branch
   - Build action: Archive with Release configuration
   - Post-action: Distribute to TestFlight
3. Signing is managed via Xcode Cloud's automatic signing

**Manual archive and upload:**

```bash
cd ios
xcodegen generate

# Archive
xcodebuild archive \
  -project TonalCoach.xcodeproj \
  -scheme TonalCoach \
  -configuration Release \
  -archivePath build/TonalCoach.xcarchive

# Export for App Store / TestFlight
xcodebuild -exportArchive \
  -archivePath build/TonalCoach.xcarchive \
  -exportPath build/export \
  -exportOptionsPlist ExportOptions.plist

# Upload to App Store Connect
xcrun altool --upload-app \
  -f build/export/TonalCoach.ipa \
  -t ios \
  -u your-apple-id \
  -p your-app-specific-password
```

### Convex Backend (standalone)

If you need to deploy just the Convex backend without a frontend build:

```bash
npx convex deploy
```

## Architecture

### Core Data Flow

```
Tonal API --> [encrypted tokens] --> Convex proxy/cache layer --> Convex DB
                                                                     |
Apple HealthKit --> iOS app --> health.syncSnapshot mutation -------->|
                                                                     v
User (chat) --> sendMessage --> AI Coach Agent (Gemini, 33 tools) --> reads context
                                                                     |
                                                          creates workoutPlans (draft)
                                                                     |
                                                          user approves --> push to Tonal API
```

### AI Coach

The coach uses Gemini 2.5 Pro via `@convex-dev/agent` with 33 tools that can:

- Read Tonal training history, strength scores, and workout data
- Create and modify weekly workout plans with periodization
- Select exercises based on equipment and training goals
- Manage goals, injuries, and training preferences
- Push approved workouts directly to Tonal

### Tonal API Integration

- OAuth tokens encrypted with AES-256 at rest
- Cron refreshes expiring tokens every 30 minutes
- `withTokenRetry` pattern: try with current token, on 401 refresh and retry once
- Proxy layer with stale-while-revalidate caching to minimize API calls
- Circuit breaker pattern for API health tracking

### Scheduled Jobs

| Interval        | Job                                               |
| --------------- | ------------------------------------------------- |
| Every 15 min    | Recover stuck workout pushes                      |
| Every 30 min    | Refresh Tonal tokens, refresh active user cache   |
| Every 1 hour    | Activation checks, cleanup OAuth states           |
| Every 6 hours   | Check-in evaluation (missed sessions, milestones) |
| Daily 3 AM      | Sync movement catalog                             |
| Weekly Sun 4 AM | Sync Tonal workout catalog                        |
| Weekly Sun 5 AM | Data retention cleanup                            |

## License

Private. All rights reserved.
