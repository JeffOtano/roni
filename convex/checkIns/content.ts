/**
 * Check-in message content per trigger. One default voice — no tone presets.
 * Spec 3.4: direct, knowledgeable, encouraging; like a good training partner.
 */

export type CheckInTrigger =
  | "missed_session"
  | "gap_3_days"
  | "tough_session_completed"
  | "weekly_recap"
  | "strength_milestone"
  | "plateau"
  | "high_external_load"
  | "consistency_streak";

/** Default copy for each trigger. No templating for now; can add placeholders later. */
export const CHECK_IN_MESSAGES: Record<CheckInTrigger, string> = {
  missed_session:
    "No worries — life happens. Ready to get back to it? I can adjust your week so you don't miss a beat.",
  gap_3_days:
    "It's been a few days since your last session. When you're ready, I can suggest a quick session that fits your day.",
  tough_session_completed:
    "That was a solid session. Your body's adapting. Rest up and we'll keep building.",
  weekly_recap:
    "Here's your week at a glance. Next week's plan is ready when you are — let me know if you want to tweak anything.",
  strength_milestone:
    "Your strength numbers are moving in the right direction. That's real progress.",
  plateau:
    "You've been at this weight for a few sessions. Options: add a set, bump weight slightly, or swap the exercise for a few weeks. Your call.",
  high_external_load:
    "You've had several intense sessions outside of Tonal recently. Your body might benefit from a lighter Tonal session or extra recovery today.",
  consistency_streak:
    "You've hit every programmed session for 3 weeks straight. That consistency is what drives real results. Keep it going.",
};

export function getMessageForTrigger(trigger: CheckInTrigger): string {
  return CHECK_IN_MESSAGES[trigger];
}
