# Tonal Coach Dashboard Architecture

## Page Structure

- **Route**: `/dashboard` (under `src/app/(app)/dashboard/page.tsx`)
- **Auth**: Protected by AppShell wrapper - requires Convex auth + Tonal profile
- **App Layout**: All (app) routes wrapped by `src/app/(app)/layout.tsx` → `AppShell`

## Dashboard Components

The dashboard displays 4 cards in a 2x2 grid:

1. **StrengthScoreCard** (`StrengthScoreCard.tsx`)
   - Displays overall strength score + 3 regional scores (Upper, Lower, Core)
   - Uses SVG radial progress rings
   - Shows percentile badge
   - Links to chat with strength trends prompt
   - Data: StrengthScore[] + StrengthDistribution from Tonal API

2. **MuscleReadinessMap** (`MuscleReadinessMap.tsx`)
   - Shows 11 muscle groups: Chest, Shoulders, Back, Triceps, Biceps, Abs, Obliques, Quads, Glutes, Hamstrings, Calves
   - Color-coded by readiness: Red (≤30 = Fatigued), Amber (≤60 = Recovering), Green (>60 = Ready)
   - Sorted by lowest readiness first
   - Links to chat for fresh muscle workout prompt
   - Data: MuscleReadiness object from Tonal API

3. **TrainingFrequencyChart** (`TrainingFrequencyChart.tsx`)
   - Horizontal bar chart of workouts by target area (last 30 days)
   - Sorted by count descending
   - 5-color cycle (chart-1 through chart-5)
   - Shows "no workouts" if empty
   - Links to chat for stale muscle groups (>7 days without training)
   - Data: TrainingFrequencyEntry[] with count + lastTrainedDate

4. **RecentWorkoutsList** (`RecentWorkoutsList.tsx`)
   - Scrollable list of last 20 workouts
   - Shows: title, relative time, target area badge, total volume, duration
   - Custom formatting: relativeTime(), formatDuration(), formatVolume()
   - Data: Activity[] from Tonal API

## Greeting & Date

- "Hey {firstName}" header where firstName comes from Tonal profile
- Current date formatted as "long weekday, long month, day numeric"

## Data Flow (Convex)

### Dashboard Backend (`convex/dashboard.ts`)

Action functions (require auth):

- `getStrengthData()` → StrengthScore[] + StrengthDistribution
- `getMuscleReadiness()` → MuscleReadiness object
- `getWorkoutHistory()` → Activity[] (limit: 20)
- `getTrainingFrequency()` → TrainingFrequencyEntry[] (last 30 days aggregation)

### Tonal Proxy (`convex/tonal/proxy.ts`)

Internal actions that:

1. Get user's encrypted Tonal token from userProfiles table
2. Use cachedFetch pattern (check cache, fetch if expired, update)
3. Call Tonal API endpoints

Cached endpoints:

- `/v6/users/{userId}/strength-scores/current` → StrengthScore[]
- `/v6/users/{userId}/strength-scores/distribution` → StrengthDistribution
- `/v6/users/{userId}/muscle-readiness/current` → MuscleReadiness
- `/v6/users/{userId}/activities?limit={limit}` → Activity[]

### Cache TTLs

- strengthScores: 6 hours
- strengthDistribution: 6 hours
- muscleReadiness: 1 hour
- workoutHistory: 1 hour
- strengthHistory: 6 hours

## Database Schema

### Tables

1. **userProfiles**
   - userId: id("users") - index
   - tonalUserId: string - index
   - tonalToken: string (encrypted)
   - tonalRefreshToken: optional
   - tonalTokenExpiresAt: optional number
   - profileData: optional object with firstName, lastName, height, weight, gender, level, workoutsPerWeek, workoutDurationMin/Max
   - lastActiveAt: number

2. **tonalCache**
   - userId: optional id("users") - index
   - dataType: string - index
   - data: any
   - fetchedAt: number
   - expiresAt: number

3. **users** (from @convex-dev/auth)
   - email: string
   - (auth system managed)

4. **workoutPlans**
   - userId: id("users") - index
   - threadId: optional string
   - tonalWorkoutId: optional string
   - title: string
   - blocks: any
   - status: "draft" | "pushed" | "completed" | "deleted"
   - estimatedDuration: optional number
   - createdAt: number
   - pushedAt: optional number

## Auth System

- Using @convex-dev/auth with Convex OAuth provider
- Requires: `useConvexAuth()` for auth state + getAuthUserId(ctx)
- Auth check in AppShell redirects unauthenticated to /login
- Unauthenticated users cannot access /dashboard (protected by AppShell)

## UI Framework

### Shadcn Components Installed

- alert, badge, button, card, input, label, scroll-area, separator, skeleton, textarea
- Style: "base-nova" (Base UI from @base-ui/react)
- Icons: lucide-react

### Colors (OKLch format in dark mode)

- Primary: oklch(0.75 0.15 195) - cyan-ish blue
- Background: oklch(0.145 0 0) - near black
- Card: oklch(0.205 0 0) - very dark gray
- Destructive: oklch(0.704 0.191 22.216) - red-orange
- Chart colors 1-5: purple to blue gradient
- Muted/foreground for text hierarchy

### Typography

- Sans: DM Sans (--font-dm-sans)
- Mono: Geist Mono (--font-geist-mono)

## App Layout Structure

### AppShell (`src/components/AppShell.tsx`)

- Desktop: Left sidebar (w-64, hidden <lg)
  - Logo "tonal.coach"
  - Nav links: Chat, Dashboard, Settings (with lucide icons)
  - User Tonal name at bottom
- Mobile: Top header + fixed bottom nav tabs
- Main content scrollable with overflow-auto
- Status banner component for alerts
- Auth guards: redirects if not authenticated or no Tonal profile
- nav: Chat (/chat), Dashboard (/dashboard), Settings (/settings)

### Global Layout (`src/app/layout.tsx`)

- Root layout with ConvexClientProvider
- Dark mode enforced via `<html className="dark">`
- Uses DM Sans and Geist Mono fonts
- ConvexAuthProvider wraps tree

## Type Definitions

All Tonal API types in `convex/tonal/types.ts`:

- TonalUser, Movement, StrengthScore, StrengthDistribution
- MuscleReadiness: { Chest, Shoulders, Back, Triceps, Biceps, Abs, Obliques, Quads, Glutes, Hamstrings, Calves }
- Activity: { activityId, userId, activityTime, activityType, workoutPreview: {...} }
- WorkoutActivityDetail, SetActivity, UserWorkout, etc.

## Key Features

1. **Async data loading** with custom useActionData hook
   - States: loading, success, error
   - Per-card error handling + retry button
   - Skeleton loaders while fetching

2. **Smart CTAs linking to chat**
   - Each card links to /chat with ?prompt= params
   - Auto-sends prompt on chat page mount
   - Contextual: strength trends, fresh muscle workouts, stale areas

3. **Responsive grid**
   - 1 column mobile, 2 columns desktop (md:grid-cols-2)
   - Consistent card styling (border, bg-card, hover:shadow)
   - gap-4 spacing

4. **Token expiration handling**
   - StatusBanner shows if Tonal token expired (yellow alert)
   - tonalTokenExpired computed in users.getMe()
   - Link to /connect-tonal for reconnection

## API Endpoints Available

- GET /v6/users/{userId}
- GET /v6/users/{userId}/strength-scores/current
- GET /v6/users/{userId}/strength-scores/distribution
- GET /v6/users/{userId}/strength-scores/history
- GET /v6/users/{userId}/muscle-readiness/current
- GET /v6/users/{userId}/activities?limit=N
- GET /v6/users/{userId}/workout-activities/{activityId}
- GET /v6/user-workouts
- GET /v6/formatted/users/{userId}/workout-summaries/{summaryId}
- GET /v6/movements
- POST /v6/user-workouts (create custom workout)
- POST /v6/user-workouts/estimate (duration estimate)
- DELETE /v6/user-workouts/{workoutId}
