# PostHog Product Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PostHog product analytics across web (Next.js) and backend (Convex) to track ~90 events covering activation, engagement, and system health. iOS integration is out of scope for this plan.

**Architecture:** PostHog JS SDK on the client via `@posthog/next` provider with a reverse proxy through Next.js rewrites to avoid ad blockers. Server-side events from Convex actions via `posthog-node`. A typed `useAnalytics()` hook centralizes event capture on the client. All platforms identify users by Convex user ID.

**Tech Stack:** `posthog-js`, `@posthog/next`, `posthog-node`, Next.js App Router, Convex actions

**Spec:** `docs/superpowers/specs/2026-03-28-posthog-analytics-design.md`

---

## File Map

### New files

| File                                 | Responsibility                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `src/lib/analytics.ts`               | Event type definitions, `useAnalytics()` hook wrapping `posthog.capture()`                       |
| `src/components/PostHogProvider.tsx` | PostHog client initialization + `PostHogIdentify` component for auth-state-driven identify/reset |
| `convex/lib/posthog.ts`              | Server-side PostHog client wrapper for Convex actions                                            |

### Modified files

| File                                                | Change                                                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `next.config.ts`                                    | Add `/ingest` rewrite rules to proxy PostHog requests                                         |
| `src/app/layout.tsx`                                | Add `<PostHogProvider>` wrapping children                                                     |
| `src/app/login/page.tsx`                            | Track `login_completed`, `login_failed`, `signup_completed`                                   |
| `src/app/onboarding/page.tsx`                       | Track `onboarding_started`, `onboarding_step_completed`, `onboarding_completed`               |
| `src/app/(app)/chat/page.tsx`                       | Track `message_sent`, `suggestion_tapped`, `thread_created`                                   |
| `src/app/(app)/dashboard/page.tsx`                  | Track `dashboard_viewed`                                                                      |
| `src/app/(app)/schedule/page.tsx`                   | Track `schedule_viewed`                                                                       |
| `src/app/(app)/schedule/[dayIndex]/page.tsx`        | Track `schedule_day_detail_viewed`                                                            |
| `src/app/(app)/stats/page.tsx`                      | Track `stats_viewed`                                                                          |
| `src/app/(app)/progress/page.tsx`                   | Track `progress_viewed`                                                                       |
| `src/app/(app)/strength/page.tsx`                   | Track `strength_scores_viewed`                                                                |
| `src/app/(app)/exercises/page.tsx`                  | Track `exercises_viewed`                                                                      |
| `src/app/(app)/settings/page.tsx`                   | Track `settings_viewed`                                                                       |
| `src/app/(app)/profile/page.tsx`                    | Track `profile_viewed`                                                                        |
| `src/app/(app)/check-ins/page.tsx`                  | Track `check_in_read`, `check_in_all_read`                                                    |
| `src/app/(app)/activity/[activityId]/page.tsx`      | Track `activity_detail_viewed`                                                                |
| `src/app/connect-tonal/page.tsx`                    | Track `tonal_connected`, `tonal_connection_failed`                                            |
| `src/app/waitlist/page.tsx`                         | Track `waitlist_joined`                                                                       |
| `src/app/reset-password/page.tsx`                   | Track `password_reset_requested`, `password_reset_completed`                                  |
| `src/components/chat/ToolApprovalCard.tsx`          | Track `tool_approved`, `tool_denied`                                                          |
| `src/components/chat/WeekPlanCard.tsx`              | Track `week_plan_card_viewed`, `week_plan_day_tapped`                                         |
| `src/components/chat/ChatInput.tsx`                 | Track `image_attached`                                                                        |
| `src/components/settings/ChangePassword.tsx`        | Track `password_changed`                                                                      |
| `src/components/settings/EmailChange.tsx`           | Track `email_change_requested`, `email_change_confirmed`                                      |
| `src/components/settings/CheckInPreferences.tsx`    | Track `check_in_preferences_changed`                                                          |
| `src/components/settings/DataExport.tsx`            | Track `data_export_requested`                                                                 |
| `src/components/settings/DeleteAccount.tsx`         | Track `account_deleted`                                                                       |
| `src/components/settings/EquipmentSettings.tsx`     | Track `equipment_settings_changed`                                                            |
| `src/components/settings/PhotoAnalysisToggle.tsx`   | Track `photo_analysis_toggled`                                                                |
| `src/components/ReconnectModal.tsx`                 | Track `tonal_reconnected`, `tonal_reconnect_failed`                                           |
| `src/components/progress/ProgressPhotosSection.tsx` | Track `progress_photo_uploaded`, `progress_photo_deleted`, `progress_photo_comparison_viewed` |
| `src/components/admin/ImpersonateUserPicker.tsx`    | Track `impersonation_started`, `impersonation_stopped`                                        |
| `convex/chat.ts`                                    | Track `coach_response_received`, `coach_tool_used` server-side                                |
| `convex/workoutPlans.ts`                            | Track `workout_pushed`, `workout_push_failed`, `workout_push_recovered`                       |
| `convex/checkIns.ts`                                | Track `check_in_received`                                                                     |
| `convex/goals.ts`                                   | Track `goal_created`, `goal_progress_updated`, `goal_abandoned`                               |
| `convex/injuries.ts`                                | Track `injury_reported`, `injury_resolved`, `injury_severity_updated`                         |
| `convex/tonal/tokenRefresh.ts`                      | Track `tonal_token_refreshed`, `tonal_token_refresh_failed`                                   |
| `convex/tonal/historySync.ts`                       | Track `history_sync_completed`                                                                |
| `convex/tonal/movementSync.ts`                      | Track `movement_catalog_synced`                                                               |
| `convex/tonal/workoutCatalogSync.ts`                | Track `workout_catalog_synced`                                                                |
| `convex/activation.ts`                              | Track `activation_check_completed`                                                            |
| `convex/dataRetention.ts`                           | Track `data_retention_completed`                                                              |
| `convex/healthCheck.ts`                             | Track `health_check_completed`                                                                |
| `convex/aiUsage.ts`                                 | Track `ai_usage_recorded`                                                                     |
| `convex/checkIns/triggers.ts`                       | Track `check_in_trigger_evaluated`                                                            |
| `convex/coach/periodization.ts`                     | Track `periodization_block_started`, `periodization_week_advanced`                            |
| `convex/weekPlanActions.ts`                         | Track `week_plan_generated`                                                                   |
| `convex/mcp/keys.ts`                                | Track `mcp_key_generated`, `mcp_key_revoked`                                                  |
| `convex/account.ts`                                 | Track `data_export_requested` (server-side)                                                   |

---

## Task 1: Install dependencies and configure environment

**Files:**

- Modify: `package.json`
- Modify: `.env.local` (not committed)

- [ ] **Step 1: Install PostHog packages**

Run:

```bash
npm install posthog-js @posthog/next posthog-node
```

- [ ] **Step 2: Add env vars to `.env.local`**

Add these lines to `.env.local`:

```
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_auCSvU5c7gyQSVTcPbi3NrefsjZYqbe4hZ2D0qVamFB
NEXT_PUBLIC_POSTHOG_HOST=/ingest
```

Note: `NEXT_PUBLIC_POSTHOG_HOST` points to `/ingest` (the local reverse proxy path), NOT directly to `us.i.posthog.com`.

- [ ] **Step 3: Set Convex env var**

Run:

```bash
npx convex env set POSTHOG_PROJECT_TOKEN phc_auCSvU5c7gyQSVTcPbi3NrefsjZYqbe4hZ2D0qVamFB
```

- [ ] **Step 4: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install posthog-js, @posthog/next, and posthog-node"
```

---

## Task 2: Add reverse proxy rewrite to Next.js config

**Files:**

- Modify: `next.config.ts`

- [ ] **Step 1: Add rewrites to nextConfig**

In `next.config.ts`, add the `rewrites` function to the `nextConfig` object, after the existing `headers()` function:

```typescript
async rewrites() {
  return [
    {
      source: "/ingest/static/:path*",
      destination: "https://us-assets.i.posthog.com/static/:path*",
    },
    {
      source: "/ingest/:path*",
      destination: "https://us.i.posthog.com/:path*",
    },
  ];
},
```

This goes inside the `nextConfig` object, right after the `headers()` closing brace.

- [ ] **Step 2: Add `skipTrailingSlashRedirect: true` to nextConfig**

PostHog's rewrite proxy requires this setting. Add it to the `nextConfig` object:

```typescript
skipTrailingSlashRedirect: true,
```

- [ ] **Step 3: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat: add PostHog reverse proxy rewrites to Next.js config"
```

---

## Task 3: Create PostHog provider and identify component

**Files:**

- Create: `src/components/PostHogProvider.tsx`

- [ ] **Step 1: Create `src/components/PostHogProvider.tsx`**

```typescript
"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest";

if (typeof window !== "undefined" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: "https://us.posthog.com",
    capture_pageview: false, // We use Next.js router events instead
    capture_pageleave: true,
    person_profiles: "identified_only",
  });
}

function PostHogIdentify() {
  const ph = usePostHog();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const identifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ph) return;

    if (me?._id && identifiedRef.current !== me._id) {
      ph.identify(me._id, {
        email: me.email,
        tonal_connected: !!me.hasTonalProfile,
        onboarding_completed: !!me.onboardingCompleted,
        name: me.tonalName,
      });
      identifiedRef.current = me._id;
    }

    if (!isAuthenticated && identifiedRef.current) {
      ph.reset();
      identifiedRef.current = null;
    }
  }, [ph, me, isAuthenticated]);

  return null;
}

function PostHogPageview() {
  const ph = usePostHog();

  useEffect(() => {
    if (!ph) return;

    // Capture initial pageview
    ph.capture("$pageview");

    // Listen for Next.js client-side navigations
    const handleRouteChange = () => ph.capture("$pageview");
    window.addEventListener("popstate", handleRouteChange);

    return () => window.removeEventListener("popstate", handleRouteChange);
  }, [ph]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <PostHogIdentify />
      <PostHogPageview />
      {children}
    </PHProvider>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PostHogProvider.tsx
git commit -m "feat: create PostHog provider with auto-identify and pageview capture"
```

---

## Task 4: Wire PostHog provider into app layout

**Files:**

- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add PostHogProvider import and wrap children**

In `src/app/layout.tsx`, add the import:

```typescript
import { PostHogProvider } from "@/components/PostHogProvider";
```

Then wrap the `<ConvexClientProvider>` children with `<PostHogProvider>`:

Replace:

```tsx
<ConvexClientProvider>
  <ErrorBoundary>{children}</ErrorBoundary>
  <Toaster theme="dark" position="bottom-center" richColors />
</ConvexClientProvider>
```

With:

```tsx
<ConvexClientProvider>
  <PostHogProvider>
    <ErrorBoundary>{children}</ErrorBoundary>
    <Toaster theme="dark" position="bottom-center" richColors />
  </PostHogProvider>
</ConvexClientProvider>
```

PostHogProvider must be inside ConvexClientProvider because it calls `useConvexAuth()` and `useQuery()`.

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Smoke test in browser**

Run `npm run dev`, open the app, and check:

- Network tab: requests going to `/ingest/e` (not `us.i.posthog.com`)
- PostHog dashboard live events: should see `$pageview` events
- After login: should see an identify call with user properties

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wire PostHogProvider into root layout"
```

---

## Task 5: Create typed analytics hook and event definitions

**Files:**

- Create: `src/lib/analytics.ts`

- [ ] **Step 1: Create `src/lib/analytics.ts`**

This file defines every client-side event name and its properties as a TypeScript type map, plus a `useAnalytics()` hook that returns a typed `track()` function.

```typescript
import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";

// ---- Event type map ----
// Every client-side event and its properties. Server-side-only events are NOT here.

type AnalyticsEvents = {
  // Activation
  signup_completed: { method: string };
  onboarding_started: Record<string, never>;
  onboarding_step_completed: { step: string };
  onboarding_completed: { duration_seconds: number };
  tonal_connected: Record<string, never>;
  tonal_connection_failed: { error: string };
  tonal_sync_completed: { workout_count: number };
  waitlist_joined: Record<string, never>;

  // Auth
  login_completed: { method: string };
  login_failed: { error: string };
  logout: Record<string, never>;
  password_reset_requested: Record<string, never>;
  password_reset_completed: Record<string, never>;
  password_changed: Record<string, never>;
  email_change_requested: Record<string, never>;
  email_change_confirmed: Record<string, never>;

  // Chat
  message_sent: { message_length: number; has_images: boolean; image_count: number };
  suggestion_tapped: { suggestion_text: string };
  thread_created: Record<string, never>;
  image_attached: { image_count: number };
  image_upload_failed: { error: string };

  // Workout plans
  week_plan_card_viewed: { plan_id: string };
  week_plan_day_tapped: { plan_id: string; day_index: number; day_name: string };
  week_plan_approved: { plan_id: string; exercise_count: number };
  week_plan_rejected: { plan_id: string };

  // Tool approvals
  tool_approval_shown: { tool_name: string };
  tool_approved: { tool_name: string; response_time_ms: number };
  tool_denied: { tool_name: string };

  // Navigation / page views (supplement autocapture with explicit events)
  dashboard_viewed: Record<string, never>;
  schedule_viewed: { week_offset?: number };
  schedule_day_tapped: { day_index: number; session_type: string };
  schedule_day_detail_viewed: { day_index: number };
  stats_viewed: Record<string, never>;
  progress_viewed: Record<string, never>;
  strength_scores_viewed: Record<string, never>;
  muscle_readiness_viewed: Record<string, never>;
  exercises_viewed: Record<string, never>;
  activity_detail_viewed: { activity_id: string };
  settings_viewed: Record<string, never>;
  profile_viewed: Record<string, never>;

  // Progress photos
  progress_photo_uploaded: Record<string, never>;
  progress_photo_deleted: Record<string, never>;
  progress_photo_comparison_viewed: { photo_count: number };
  photo_analysis_toggled: { enabled: boolean };

  // Goals & injuries
  goal_created: { goal_type: string };
  goal_progress_updated: { goal_id: string; progress_pct: number };
  goal_abandoned: { goal_id: string };
  injury_reported: { body_part: string; severity: string };
  injury_resolved: { body_part: string };
  injury_severity_updated: { body_part: string; old_severity: string; new_severity: string };

  // Check-ins
  check_in_read: { check_in_id: string };
  check_in_all_read: { count: number };
  check_in_preferences_changed: { enabled: boolean; frequency?: string };

  // Settings
  training_preferences_saved: Record<string, unknown>;
  equipment_settings_changed: Record<string, never>;
  data_export_requested: Record<string, never>;
  account_deleted: Record<string, never>;

  // Integrations
  calendar_connected: Record<string, never>;
  calendar_disconnected: Record<string, never>;
  tonal_reconnected: Record<string, never>;
  tonal_reconnect_failed: { error: string };
  mcp_key_generated: Record<string, never>;
  mcp_key_revoked: Record<string, never>;

  // Admin
  impersonation_started: { target_user_id: string };
  impersonation_stopped: Record<string, never>;
};

export function useAnalytics() {
  const posthog = usePostHog();

  const track = useCallback(
    <E extends keyof AnalyticsEvents>(
      event: E,
      ...args: AnalyticsEvents[E] extends Record<string, never>
        ? []
        : [properties: AnalyticsEvents[E]]
    ) => {
      posthog?.capture(event, args[0] as Record<string, unknown> | undefined);
    },
    [posthog],
  );

  return { track };
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/analytics.ts
git commit -m "feat: create typed useAnalytics hook with full event taxonomy"
```

---

## Task 6: Create Convex server-side analytics helper

**Files:**

- Create: `convex/lib/posthog.ts`

- [ ] **Step 1: Create `convex/lib/posthog.ts`**

```typescript
import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const apiKey = process.env.POSTHOG_PROJECT_TOKEN;
  if (!apiKey) return null;

  if (!client) {
    client = new PostHog(apiKey, {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Capture a server-side analytics event.
 * Safe to call even if PostHog is not configured (no-ops silently).
 */
export function capture(userId: string, event: string, properties?: Record<string, unknown>): void {
  const ph = getClient();
  if (!ph) return;
  ph.capture({ distinctId: userId, event, properties });
}

/**
 * Capture a system event not tied to a specific user.
 */
export function captureSystem(event: string, properties?: Record<string, unknown>): void {
  capture("system", event, properties);
}

/**
 * Flush pending events. Call at the end of Convex actions.
 */
export async function flush(): Promise<void> {
  const ph = getClient();
  if (!ph) return;
  await ph.flush();
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add convex/lib/posthog.ts
git commit -m "feat: create Convex server-side PostHog analytics helper"
```

---

## Task 7: Instrument auth events (login, signup, password reset)

**Files:**

- Modify: `src/app/login/page.tsx`
- Modify: `src/app/reset-password/page.tsx`

- [ ] **Step 1: Add analytics to login page**

In `src/app/login/page.tsx`, add the import at the top:

```typescript
import { useAnalytics } from "@/lib/analytics";
```

Inside the `LoginPage` component, add after the existing state declarations:

```typescript
const { track } = useAnalytics();
```

In `handleSubmit`, after the successful `signIn` call (before `router.replace("/chat")`):

```typescript
track(flow === "signIn" ? "login_completed" : "signup_completed", { method: "password" });
```

In the catch block, after setting the error state for `signIn` flow:

```typescript
if (flow === "signIn") {
  track("login_failed", { error: "invalid_credentials" });
}
```

- [ ] **Step 2: Add analytics to reset password page**

Read `src/app/reset-password/page.tsx` first to understand the component structure.

Add `import { useAnalytics } from "@/lib/analytics";` and `const { track } = useAnalytics();`.

Track `password_reset_requested` when the reset email is successfully sent.
Track `password_reset_completed` when the new password is successfully set.

Exact placement depends on the component structure - add the `track()` calls right after the successful mutation/action calls.

- [ ] **Step 3: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx src/app/reset-password/page.tsx
git commit -m "feat: instrument auth events (login, signup, password reset)"
```

---

## Task 8: Instrument onboarding events

**Files:**

- Modify: `src/app/onboarding/page.tsx`

- [ ] **Step 1: Add analytics to onboarding page**

In `src/app/onboarding/page.tsx`, add the import:

```typescript
import { useAnalytics } from "@/lib/analytics";
```

In the `OnboardingFlow` component, add:

```typescript
const { track } = useAnalytics();
const startTimeRef = useRef(Date.now());
```

(Add `useRef` to the existing react import.)

Track `onboarding_started` on mount:

```typescript
useEffect(() => {
  track("onboarding_started");
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Modify the step transitions to track step completions. Replace the `onComplete` callbacks:

```tsx
{
  step === 1 && (
    <ConnectStep
      onComplete={() => {
        track("onboarding_step_completed", { step: "connect_tonal" });
        setStep(2);
      }}
    />
  );
}
{
  step === 2 && (
    <PreferencesStep
      onComplete={() => {
        track("onboarding_step_completed", { step: "preferences" });
        setStep(3);
      }}
    />
  );
}
{
  step === 3 && (
    <ReadyStep
      firstName={firstName}
      onComplete={() => {
        track("onboarding_step_completed", { step: "ready" });
        track("onboarding_completed", {
          duration_seconds: Math.round((Date.now() - startTimeRef.current) / 1000),
        });
      }}
    />
  );
}
```

Note: Check if `ReadyStep` takes an `onComplete` prop. If it navigates via router instead, add the tracking before the navigation call inside `ReadyStep`.

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/page.tsx
git commit -m "feat: instrument onboarding funnel events"
```

---

## Task 9: Instrument chat and coach interaction events

**Files:**

- Modify: `src/app/(app)/chat/page.tsx`
- Modify: `src/components/chat/ToolApprovalCard.tsx`
- Modify: `src/components/chat/WeekPlanCard.tsx`

- [ ] **Step 1: Add analytics to chat page**

In `src/app/(app)/chat/page.tsx`, add:

```typescript
import { useAnalytics } from "@/lib/analytics";
```

In `ChatPageInner`, add `const { track } = useAnalytics();`.

In `sendAndWait`, after the `sendMessage` call returns successfully:

```typescript
track("message_sent", {
  message_length: args.prompt.length,
  has_images: false,
  image_count: 0,
});
```

For suggestion chips, wrap the `onClick`:

```tsx
onClick={() => {
  track("suggestion_tapped", { suggestion_text: text });
  sendAndWait({ prompt: text });
}}
```

In `WelcomeInput`, pass `track` as a prop or import `useAnalytics` there. In `handleSend`, after the successful send:

```typescript
track("message_sent", {
  message_length: trimmed.length,
  has_images: pendingImages.length > 0,
  image_count: pendingImages.length,
});
```

- [ ] **Step 2: Add analytics to ToolApprovalCard**

In `src/components/chat/ToolApprovalCard.tsx`, add:

```typescript
import { useAnalytics } from "@/lib/analytics";
```

In the component, add:

```typescript
const { track } = useAnalytics();
const shownTimeRef = useRef(Date.now());
```

(Add `useRef` to the react import.)

Track `tool_approval_shown` on mount:

```typescript
useEffect(() => {
  track("tool_approval_shown", { tool_name: toolName });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

In `handleResponse`, after the successful `respond` call:

```typescript
track(approved ? "tool_approved" : "tool_denied", {
  tool_name: toolName,
  ...(approved ? { response_time_ms: Date.now() - shownTimeRef.current } : {}),
});
```

- [ ] **Step 3: Add analytics to WeekPlanCard**

In `src/components/chat/WeekPlanCard.tsx`, add:

```typescript
import { useAnalytics } from "@/lib/analytics";
import { useEffect, useRef } from "react";
```

(Update existing `useState` import to include `useEffect` and `useRef`.)

In the component:

```typescript
const { track } = useAnalytics();
const viewTrackedRef = useRef(false);
```

Track `week_plan_card_viewed` on mount:

```typescript
useEffect(() => {
  if (!viewTrackedRef.current) {
    track("week_plan_card_viewed", { plan_id: plan.weekStartDate });
    viewTrackedRef.current = true;
  }
}, [track, plan.weekStartDate]);
```

On day tab click:

```tsx
onClick={() => {
  track("week_plan_day_tapped", {
    plan_id: plan.weekStartDate,
    day_index: i,
    day_name: d.dayName,
  });
  setActiveDay(i);
}}
```

- [ ] **Step 4: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/chat/page.tsx src/components/chat/ToolApprovalCard.tsx src/components/chat/WeekPlanCard.tsx
git commit -m "feat: instrument chat, tool approval, and week plan events"
```

---

## Task 10: Instrument page view events for all app routes

**Files:**

- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/schedule/page.tsx`
- Modify: `src/app/(app)/schedule/[dayIndex]/page.tsx`
- Modify: `src/app/(app)/stats/page.tsx`
- Modify: `src/app/(app)/progress/page.tsx`
- Modify: `src/app/(app)/strength/page.tsx`
- Modify: `src/app/(app)/exercises/page.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/app/(app)/profile/page.tsx`
- Modify: `src/app/(app)/check-ins/page.tsx`
- Modify: `src/app/(app)/activity/[activityId]/page.tsx`

- [ ] **Step 1: Add page view tracking to each route**

For each page component listed above, the pattern is the same. Read each file first to understand its structure. Then:

1. Add `import { useAnalytics } from "@/lib/analytics";`
2. Add `const { track } = useAnalytics();` in the component
3. Add a `useEffect` (add to react import if needed) to track on mount:

```typescript
useEffect(() => {
  track("EVENT_NAME");
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

The event names for each page:

- `dashboard/page.tsx` -> `dashboard_viewed`
- `schedule/page.tsx` -> `schedule_viewed` (pass `{ week_offset: 0 }` or derive from state)
- `schedule/[dayIndex]/page.tsx` -> `schedule_day_detail_viewed` (pass `{ day_index: parseInt(params.dayIndex) }`)
- `stats/page.tsx` -> `stats_viewed`
- `progress/page.tsx` -> `progress_viewed`
- `strength/page.tsx` -> `strength_scores_viewed`
- `exercises/page.tsx` -> `exercises_viewed`
- `settings/page.tsx` -> `settings_viewed`
- `profile/page.tsx` -> `profile_viewed`
- `check-ins/page.tsx` -> (no dedicated view event, check-in events handled in Task 12)
- `activity/[activityId]/page.tsx` -> `activity_detail_viewed` (pass `{ activity_id: params.activityId }`)

If a page is a server component (no `"use client"` directive), either:

- Add `"use client"` if the file is simple enough, or
- Create a small client wrapper component that fires the event

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/
git commit -m "feat: instrument page view events for all app routes"
```

---

## Task 11: Instrument settings component events

**Files:**

- Modify: `src/components/settings/ChangePassword.tsx`
- Modify: `src/components/settings/EmailChange.tsx`
- Modify: `src/components/settings/CheckInPreferences.tsx`
- Modify: `src/components/settings/DataExport.tsx`
- Modify: `src/components/settings/DeleteAccount.tsx`
- Modify: `src/components/settings/EquipmentSettings.tsx`
- Modify: `src/components/settings/PhotoAnalysisToggle.tsx`

- [ ] **Step 1: Instrument each settings component**

Read each file first. For each component, add `import { useAnalytics } from "@/lib/analytics";` and `const { track } = useAnalytics();`, then add `track()` calls at the appropriate success points:

**ChangePassword.tsx:** After successful password change:

```typescript
track("password_changed");
```

**EmailChange.tsx:** After requesting email change:

```typescript
track("email_change_requested");
```

After confirming email change:

```typescript
track("email_change_confirmed");
```

**CheckInPreferences.tsx:** In the `updatePreferences` `.then()` callbacks:

```typescript
track("check_in_preferences_changed", { enabled: !prefs.enabled });
```

For frequency changes:

```typescript
track("check_in_preferences_changed", { enabled: true, frequency: value });
```

**DataExport.tsx:** After export is initiated:

```typescript
track("data_export_requested");
```

**DeleteAccount.tsx:** Before the deletion action (since the user will be logged out after):

```typescript
track("account_deleted");
```

**EquipmentSettings.tsx:** After saving equipment changes:

```typescript
track("equipment_settings_changed");
```

**PhotoAnalysisToggle.tsx:** After toggling:

```typescript
track("photo_analysis_toggled", { enabled: newValue });
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/
git commit -m "feat: instrument settings component events"
```

---

## Task 12: Instrument remaining client-side events

**Files:**

- Modify: `src/components/ReconnectModal.tsx`
- Modify: `src/components/progress/ProgressPhotosSection.tsx`
- Modify: `src/components/admin/ImpersonateUserPicker.tsx`
- Modify: `src/app/connect-tonal/page.tsx`
- Modify: `src/app/waitlist/page.tsx`

- [ ] **Step 1: Instrument ReconnectModal**

In `src/components/ReconnectModal.tsx`, add analytics import and hook. In `handleSubmit`:

After successful reconnect (where `setPhase("success")` is called):

```typescript
track("tonal_reconnected");
```

In the catch block:

```typescript
track("tonal_reconnect_failed", { error: "invalid_password" });
```

- [ ] **Step 2: Instrument ProgressPhotosSection**

Read `src/components/progress/ProgressPhotosSection.tsx` first. Add analytics import and hook.

Track:

- `progress_photo_uploaded` after successful upload
- `progress_photo_deleted` after successful deletion
- `progress_photo_comparison_viewed` when AI comparison is triggered (pass `{ photo_count }`)

- [ ] **Step 3: Instrument ImpersonateUserPicker**

Read `src/components/admin/ImpersonateUserPicker.tsx` first. Add analytics import and hook.

Track:

- `impersonation_started` with `{ target_user_id }` when admin starts impersonating
- `impersonation_stopped` when admin stops impersonating

- [ ] **Step 4: Instrument connect-tonal page**

Read `src/app/connect-tonal/page.tsx` first. Add analytics.

Track:

- `tonal_connected` on successful OAuth connection
- `tonal_connection_failed` with `{ error }` on failure

- [ ] **Step 5: Instrument waitlist page**

Read `src/app/waitlist/page.tsx` first. Add analytics.

Track:

- `waitlist_joined` after successful submission

- [ ] **Step 6: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ReconnectModal.tsx src/components/progress/ProgressPhotosSection.tsx src/components/admin/ImpersonateUserPicker.tsx src/app/connect-tonal/page.tsx src/app/waitlist/page.tsx
git commit -m "feat: instrument remaining client-side events (reconnect, photos, admin, tonal, waitlist)"
```

---

## Task 13: Instrument Convex server-side events (chat and workout plans)

**Files:**

- Modify: `convex/chat.ts`
- Modify: `convex/workoutPlans.ts`
- Modify: `convex/weekPlanActions.ts`

- [ ] **Step 1: Add server-side analytics to chat**

In `convex/chat.ts`, add at the top:

```typescript
import * as analytics from "./lib/posthog";
```

In the `processMessage` internal action (or wherever the AI agent response is finalized), after the response is generated:

```typescript
analytics.capture(userId, "coach_response_received", {
  tool_count: toolCallCount,
  response_time_ms: Date.now() - startTime,
});
await analytics.flush();
```

Read the file first to find the exact location where tool calls are tracked. For each tool invocation by the agent:

```typescript
analytics.capture(userId, "coach_tool_used", { tool_name: toolName });
```

- [ ] **Step 2: Add server-side analytics to workout plans**

In `convex/workoutPlans.ts`, add `import * as analytics from "./lib/posthog";`

In `updatePushOutcome` (where push success/failure is recorded):

For success:

```typescript
analytics.capture(userId, "workout_pushed", {
  plan_id: args.workoutPlanId,
  workout_plan_id: args.workoutPlanId,
});
await analytics.flush();
```

For failure:

```typescript
analytics.capture(userId, "workout_push_failed", {
  plan_id: args.workoutPlanId,
  error: args.error ?? "unknown",
});
await analytics.flush();
```

In `runStuckPushRecovery`:

```typescript
analytics.capture(userId, "workout_push_recovered", { plan_id: planId });
await analytics.flush();
```

- [ ] **Step 3: Add analytics to week plan generation**

In `convex/weekPlanActions.ts`, add `import * as analytics from "./lib/posthog";`

In `programWeek` or `programMyWeek`, after successful plan generation:

```typescript
analytics.capture(userId, "week_plan_generated", {
  plan_id: weekPlanId,
  split: plan.split,
  day_count: plan.days.length,
});
await analytics.flush();
```

- [ ] **Step 4: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add convex/chat.ts convex/workoutPlans.ts convex/weekPlanActions.ts
git commit -m "feat: instrument server-side chat and workout plan events"
```

---

## Task 14: Instrument Convex server-side events (goals, injuries, check-ins)

**Files:**

- Modify: `convex/goals.ts`
- Modify: `convex/injuries.ts`
- Modify: `convex/checkIns.ts`
- Modify: `convex/checkIns/triggers.ts`

- [ ] **Step 1: Skip goals, injuries server-side (mutation-only)**

Goals (`create`, `updateProgress`, `abandon`) and injuries (`report`, `resolve`, `updateSeverity`) are mutations, not actions. `posthog-node` makes network calls and cannot be used in mutations. These events are already in the client-side `useAnalytics` type map and should be tracked from the React components that call these mutations. If the coach agent creates goals/injuries via internal mutations called from actions, add tracking in those calling actions.

**Important:** `posthog-node` makes network calls, so it can only be used in Convex **actions**, not mutations. The `goals`, `injuries`, and `checkIns` modules use mutations for their public API. For these, track the events client-side instead (they're already in the `useAnalytics` type map). Skip server-side tracking for mutation-only operations.

If a mutation is called from an action (like `createInternal`, `reportInternal`), add the tracking in the calling action instead.

- [ ] **Step 2: Instrument check-in creation (internal mutation called from action)**

In `convex/checkIns.ts`, `createCheckIn` is an `internalMutation`. It's called from the `evaluateTriggersForUser` action. Add the `check_in_received` tracking in the calling action (`convex/checkIns/triggers.ts`) instead, where we already have action context.

In `convex/checkIns/triggers.ts`, add `import * as analytics from "../lib/posthog";`

At the end of `evaluateTriggersForUser`:

```typescript
analytics.captureSystem("check_in_trigger_evaluated", {
  users_checked: usersChecked,
  check_ins_sent: checkInsSent,
});
await analytics.flush();
```

- [ ] **Step 4: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add convex/goals.ts convex/injuries.ts convex/checkIns.ts convex/checkIns/triggers.ts
git commit -m "feat: instrument server-side goal, injury, and check-in events"
```

---

## Task 15: Instrument Convex server-side system events (crons and syncs)

**Files:**

- Modify: `convex/tonal/tokenRefresh.ts`
- Modify: `convex/tonal/historySync.ts`
- Modify: `convex/tonal/movementSync.ts`
- Modify: `convex/tonal/workoutCatalogSync.ts`
- Modify: `convex/activation.ts`
- Modify: `convex/dataRetention.ts`
- Modify: `convex/healthCheck.ts`
- Modify: `convex/aiUsage.ts`
- Modify: `convex/coach/periodization.ts`
- Modify: `convex/mcp/keys.ts`
- Modify: `convex/account.ts`

- [ ] **Step 1: Instrument token refresh**

In `convex/tonal/tokenRefresh.ts`, add `import * as analytics from "../lib/posthog";`

After successful token refresh:

```typescript
analytics.capture(userId, "tonal_token_refreshed");
```

On failure:

```typescript
analytics.capture(userId, "tonal_token_refresh_failed", { error: errorMessage });
```

At the end of the action:

```typescript
await analytics.flush();
```

- [ ] **Step 2: Instrument history sync**

In `convex/tonal/historySync.ts`, add `import * as analytics from "../lib/posthog";`

After `syncUserHistory` completes:

```typescript
analytics.capture(userId, "history_sync_completed", {
  user_id: userId,
  new_workouts: newWorkoutCount,
});
await analytics.flush();
```

- [ ] **Step 3: Instrument catalog syncs**

In `convex/tonal/movementSync.ts`, add `import * as analytics from "../lib/posthog";`

After `syncMovementCatalog` completes:

```typescript
analytics.captureSystem("movement_catalog_synced", { count: syncedCount });
await analytics.flush();
```

In `convex/tonal/workoutCatalogSync.ts`, add `import * as analytics from "../lib/posthog";`

After sync:

```typescript
analytics.captureSystem("workout_catalog_synced", { count: syncedCount });
await analytics.flush();
```

- [ ] **Step 4: Instrument activation, data retention, health check**

In `convex/activation.ts`:

```typescript
import * as analytics from "./lib/posthog";

// At end of runActivationCheckForEligibleUsers:
analytics.captureSystem("activation_check_completed", {
  eligible_count: eligibleCount,
  activated_count: activatedCount,
});
await analytics.flush();
```

In `convex/dataRetention.ts`:

```typescript
import * as analytics from "./lib/posthog";

// At end of runDataRetention:
analytics.captureSystem("data_retention_completed", { deleted_count: deletedCount });
await analytics.flush();
```

In `convex/healthCheck.ts`:

```typescript
import * as analytics from "./lib/posthog";

// At end of runHealthCheck:
analytics.captureSystem("health_check_completed", { status, failures });
await analytics.flush();
```

- [ ] **Step 5: Instrument AI usage, periodization, MCP keys, account**

**Mutation-only modules (track client-side instead):**

- `convex/aiUsage.ts` (`record` is `internalMutation`) - `ai_usage_recorded` should be tracked from the action that calls it (the AI agent processing pipeline in `convex/chat.ts`)
- `convex/coach/periodization.ts` (`startBlock`, `advanceWeek` are `internalMutation`) - `periodization_block_started` and `periodization_week_advanced` should be tracked from the action that calls them (week programming actions)
- `convex/mcp/keys.ts` (`generateMcpApiKey`, `revokeMcpApiKey` are `mutation`) - `mcp_key_generated` and `mcp_key_revoked` tracked client-side via `useAnalytics`

**Action module:**
In `convex/account.ts`, `exportData` is an action:

```typescript
import * as analytics from "./lib/posthog";

// At end of exportData action, after export completes:
analytics.capture(userId, "data_export_requested");
await analytics.flush();
```

- [ ] **Step 6: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add convex/tonal/tokenRefresh.ts convex/tonal/historySync.ts convex/tonal/movementSync.ts convex/tonal/workoutCatalogSync.ts convex/activation.ts convex/dataRetention.ts convex/healthCheck.ts convex/account.ts
git commit -m "feat: instrument server-side system events (crons, syncs, exports)"
```

---

## Task 16: Final verification and smoke test

**Files:** None (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All existing tests pass. No regressions.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new lint errors.

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: Successful build.

- [ ] **Step 5: Manual smoke test**

Start the dev server and verify in the PostHog live events dashboard:

1. Load the app -> `$pageview` appears
2. Log in -> `login_completed` + identify call with person properties
3. Navigate to dashboard -> `dashboard_viewed`
4. Send a chat message -> `message_sent`
5. Check network tab -> requests go to `/ingest/*`

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during analytics smoke test"
```
