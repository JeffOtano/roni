import posthog from "posthog-js";
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
  message_sent: {
    message_length: number;
    has_images: boolean;
    image_count: number;
  };
  suggestion_tapped: { suggestion_text: string };
  thread_created: Record<string, never>;
  image_attached: { image_count: number };
  image_upload_failed: { error: string };

  // Workout plans
  week_plan_card_viewed: { plan_id: string };
  week_plan_day_tapped: {
    plan_id: string;
    day_index: number;
    day_name: string;
  };
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

  // Goals & injuries
  goal_created: { goal_type: string };
  goal_progress_updated: { goal_id: string; progress_pct: number };
  goal_abandoned: { goal_id: string };
  injury_reported: { body_part: string; severity: string };
  injury_resolved: { body_part: string };
  injury_severity_updated: {
    body_part: string;
    old_severity: string;
    new_severity: string;
  };

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
  tonal_reconnected: Record<string, never>;
  tonal_reconnect_failed: { error: string };

  // Public workout library
  workout_cta_clicked: { slug: string };
  workout_opened_in_tonal: { slug: string };
};

export function useAnalytics() {
  const track = useCallback(
    <E extends keyof AnalyticsEvents>(
      event: E,
      ...args: AnalyticsEvents[E] extends Record<string, never>
        ? []
        : [properties: AnalyticsEvents[E]]
    ) => {
      posthog.capture(event, args[0] as Record<string, unknown> | undefined);
    },
    [],
  );

  return { track };
}
