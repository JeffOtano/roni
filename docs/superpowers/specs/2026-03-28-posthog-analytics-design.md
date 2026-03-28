# PostHog Product Analytics Integration

## Summary

Add PostHog product analytics across web (Next.js), backend (Convex), and iOS to track user behavior from signup through ongoing engagement. This fills the gap between existing tools (Vercel Analytics for pageviews, Sentry for errors) and actual product usage data.

## Decision

**PostHog** selected over Mixpanel and Amplitude for:

- Best-in-class MCP server and AI documentation (`llms.txt`, Claude Code plugin)
- First-party Next.js SDK (`@posthog/next`) with App Router support
- Actively maintained iOS SDK (`posthog-ios`) with SPM
- 1M events/month free tier (sufficient for 50-user beta)
- Bundled session replay, feature flags, and error tracking for future use

## Existing Tools (no changes)

| Tool                     | Keep | Rationale                                                                 |
| ------------------------ | ---- | ------------------------------------------------------------------------- |
| `@vercel/analytics`      | Yes  | Free pageview + web vitals, no overlap                                    |
| `@vercel/speed-insights` | Yes  | Core Web Vitals monitoring                                                |
| `@sentry/nextjs`         | Yes  | Mature error tracking; revisit once PostHog error tracking is established |

## Architecture

### Web (Next.js)

- `@posthog/next` provider in `layout.tsx` alongside existing `<Analytics />` and `<SpeedInsights />`
- Reverse proxy via Next.js rewrites: `/ingest/*` -> `us.i.posthog.com/*` (avoids ad blockers)
- Autocapture enabled for pageviews and clicks
- `posthog.identify(convexUserId)` called on auth state change

**Event capture pattern:**

- `useAnalytics()` hook wrapping `posthog.capture()` with typed event names
- Components call `track("event_name", { properties })` at interaction points
- No analytics code in Convex queries/mutations called from the client

### Backend (Convex)

- `posthog-node` SDK in `convex/lib/analytics.ts`
- Convex actions call `analytics.capture(userId, "event_name", properties)` for server-only events
- Flush on action completion (Convex actions are short-lived, no background batching)

### iOS

- `posthog-ios` via SPM, initialized in app entry point
- Same project API key as web (single PostHog project)
- Manual event capture at interaction points (no SwiftUI autocapture)

### Identity

- All platforms identify with the Convex user ID
- PostHog merges anonymous pre-login events with authenticated profile automatically
- Person properties set on identify: `email`, `tonal_connected`, `onboarding_completed`, `created_at`, `platform` (web/ios)

## Environment Variables

| Variable                            | Where        | Value                                         |
| ----------------------------------- | ------------ | --------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | `.env.local` | PostHog project API key (public, client-safe) |
| `NEXT_PUBLIC_POSTHOG_HOST`          | `.env.local` | `https://us.i.posthog.com`                    |
| `POSTHOG_PROJECT_TOKEN`             | Convex env   | Same token value as above                     |

## New Dependencies

- `posthog-js` + `@posthog/next` (web)
- `posthog-node` (Convex backend)
- `posthog-ios` via SPM (iOS)

## Event Taxonomy (~90 events)

All events use `snake_case` naming.

### Activation Funnel

| Event                       | Trigger                 | Properties                                   |
| --------------------------- | ----------------------- | -------------------------------------------- |
| `signup_completed`          | Account created         | `method`                                     |
| `onboarding_started`        | Onboarding page loaded  | -                                            |
| `onboarding_step_completed` | Each step transition    | `step` (connect_tonal / preferences / ready) |
| `onboarding_completed`      | Final step submitted    | `duration_seconds`                           |
| `tonal_connected`           | OAuth succeeds          | -                                            |
| `tonal_connection_failed`   | OAuth fails             | `error`                                      |
| `tonal_sync_completed`      | First history sync      | `workout_count`                              |
| `waitlist_joined`           | Waitlist form submitted | -                                            |

### Auth

| Event                      | Trigger              | Properties |
| -------------------------- | -------------------- | ---------- |
| `login_completed`          | Successful login     | `method`   |
| `login_failed`             | Failed login attempt | `error`    |
| `logout`                   | User logs out        | -          |
| `password_reset_requested` | Reset email sent     | -          |
| `password_reset_completed` | New password set     | -          |
| `password_changed`         | Via settings         | -          |
| `email_change_requested`   | Change initiated     | -          |
| `email_change_confirmed`   | Change applied       | -          |

### Chat / Coach Interaction

| Event                     | Trigger                | Properties                                    |
| ------------------------- | ---------------------- | --------------------------------------------- |
| `message_sent`            | User sends message     | `message_length`, `has_images`, `image_count` |
| `suggestion_tapped`       | Taps a suggestion chip | `suggestion_text`                             |
| `coach_response_received` | AI responds            | `tool_count`, `response_time_ms`              |
| `coach_tool_used`         | Agent invokes a tool   | `tool_name`                                   |
| `tool_approval_shown`     | Approval card rendered | `tool_name`                                   |
| `tool_approved`           | User approves          | `tool_name`, `response_time_ms`               |
| `tool_denied`             | User denies            | `tool_name`                                   |
| `image_attached`          | Image added to message | `image_count`                                 |
| `image_upload_failed`     | Upload error           | `error`                                       |
| `thread_created`          | New chat thread        | -                                             |

### Workout Plans

| Event                    | Trigger                      | Properties                                |
| ------------------------ | ---------------------------- | ----------------------------------------- |
| `week_plan_generated`    | Coach generates plan         | `plan_id`, `split`, `day_count`           |
| `week_plan_card_viewed`  | Plan card rendered in chat   | `plan_id`                                 |
| `week_plan_day_tapped`   | Day tab tapped in card       | `plan_id`, `day_index`, `day_name`        |
| `week_plan_approved`     | User approves push           | `plan_id`, `exercise_count`               |
| `week_plan_rejected`     | User rejects                 | `plan_id`                                 |
| `workout_pushed`         | Successfully pushed to Tonal | `plan_id`, `workout_plan_id`              |
| `workout_push_failed`    | Push to Tonal failed         | `plan_id`, `error`                        |
| `workout_push_recovered` | Stuck push recovery          | `plan_id`                                 |
| `workout_plan_deleted`   | Plan deleted                 | `plan_id`                                 |
| `exercise_swapped`       | Coach swaps exercise         | `plan_id`, `old_exercise`, `new_exercise` |
| `exercise_added`         | Coach adds exercise          | `plan_id`, `exercise_name`                |
| `day_slots_swapped`      | Coach reorders days          | `plan_id`                                 |
| `day_duration_adjusted`  | Duration changed             | `plan_id`, `day_index`, `new_duration`    |

### Schedule

| Event                        | Trigger               | Properties                  |
| ---------------------------- | --------------------- | --------------------------- |
| `schedule_viewed`            | Opens schedule page   | `week_offset`               |
| `schedule_day_tapped`        | Taps a specific day   | `day_index`, `session_type` |
| `schedule_day_detail_viewed` | Opens day detail page | `day_index`                 |

### Dashboard

| Event                     | Trigger                 | Properties                                                                             |
| ------------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| `dashboard_viewed`        | Opens dashboard         | -                                                                                      |
| `dashboard_card_tapped`   | Taps a card to navigate | `card_type` (strength / readiness / frequency / recent_workouts / external_activities) |
| `strength_scores_viewed`  | Opens strength page     | -                                                                                      |
| `muscle_readiness_viewed` | Readiness map loaded    | -                                                                                      |

### Stats & Progress

| Event                              | Trigger                 | Properties    |
| ---------------------------------- | ----------------------- | ------------- |
| `stats_viewed`                     | Opens stats page        | -             |
| `progress_viewed`                  | Opens progress page     | -             |
| `progress_photo_uploaded`          | Photo uploaded          | -             |
| `progress_photo_deleted`           | Photo removed           | -             |
| `progress_photo_comparison_viewed` | AI comparison triggered | `photo_count` |
| `photo_analysis_toggled`           | Toggle on/off           | `enabled`     |
| `exercises_viewed`                 | Opens exercise catalog  | -             |
| `activity_detail_viewed`           | Opens specific workout  | `activity_id` |

### Goals & Injuries

| Event                     | Trigger                 | Properties                                  |
| ------------------------- | ----------------------- | ------------------------------------------- |
| `goal_created`            | User/coach creates goal | `goal_type`                                 |
| `goal_progress_updated`   | Progress recorded       | `goal_id`, `progress_pct`                   |
| `goal_abandoned`          | Goal abandoned          | `goal_id`                                   |
| `injury_reported`         | Injury logged           | `body_part`, `severity`                     |
| `injury_resolved`         | Marked resolved         | `body_part`                                 |
| `injury_severity_updated` | Severity changed        | `body_part`, `old_severity`, `new_severity` |

### Check-ins

| Event                          | Trigger                       | Properties                                                        |
| ------------------------------ | ----------------------------- | ----------------------------------------------------------------- |
| `check_in_received`            | Coach sends proactive message | `trigger` (missed_session / milestone / streak / deload_reminder) |
| `check_in_read`                | User reads check-in           | `check_in_id`                                                     |
| `check_in_all_read`            | Marks all read                | `count`                                                           |
| `check_in_preferences_changed` | Toggle/frequency change       | `enabled`, `frequency`                                            |

### Settings & Account

| Event                        | Trigger             | Properties     |
| ---------------------------- | ------------------- | -------------- |
| `settings_viewed`            | Opens settings      | -              |
| `profile_viewed`             | Opens profile       | -              |
| `training_preferences_saved` | Preferences updated | changed fields |
| `equipment_settings_changed` | Equipment updated   | -              |
| `data_export_requested`      | Export initiated    | -              |
| `account_deleted`            | Account deletion    | -              |

### Integrations

| Event                    | Trigger                          | Properties                         |
| ------------------------ | -------------------------------- | ---------------------------------- |
| `calendar_connected`     | Google Calendar OAuth            | -                                  |
| `calendar_disconnected`  | Calendar removed                 | -                                  |
| `health_data_synced`     | iOS HealthKit sync               | `metrics` (sleep/hrv/steps/weight) |
| `tonal_reconnected`      | Re-auth via modal                | -                                  |
| `tonal_reconnect_failed` | Re-auth failed                   | `error`                            |
| `mcp_key_generated`      | MCP API key created              | -                                  |
| `mcp_key_revoked`        | MCP API key revoked              | -                                  |
| `push_token_registered`  | iOS push notification registered | -                                  |

### Admin

| Event                   | Trigger                 | Properties       |
| ----------------------- | ----------------------- | ---------------- |
| `impersonation_started` | Admin impersonates user | `target_user_id` |
| `impersonation_stopped` | Admin stops             | -                |

### System / Server-side Only

| Event                         | Trigger                      | Properties                               |
| ----------------------------- | ---------------------------- | ---------------------------------------- |
| `tonal_token_refresh_failed`  | Cron fails                   | `error`                                  |
| `tonal_token_refreshed`       | Token successfully refreshed | -                                        |
| `activation_check_completed`  | Activation cron runs         | `eligible_count`, `activated_count`      |
| `history_sync_completed`      | User history synced          | `user_id`, `new_workouts`                |
| `movement_catalog_synced`     | Daily movement sync          | `count`                                  |
| `workout_catalog_synced`      | Weekly workout sync          | `count`                                  |
| `data_retention_completed`    | Weekly cleanup               | `deleted_count`                          |
| `health_check_completed`      | System health                | `status`, `failures`                     |
| `ai_usage_recorded`           | Token/cost tracking          | `model`, `input_tokens`, `output_tokens` |
| `check_in_trigger_evaluated`  | 6h evaluation cycle          | `users_checked`, `check_ins_sent`        |
| `periodization_block_started` | New training block           | `block_type` (building/deload/testing)   |
| `periodization_week_advanced` | Week within block advances   | `week_number`                            |

## Verification

- Open app in dev, log in, send a chat message
- Check PostHog live events: should see `$pageview`, identify call, `message_sent`
- Network tab: requests go to `/ingest/*`, not `us.i.posthog.com`
- No automated tests for analytics (fire-and-forget, typed at compile time)
