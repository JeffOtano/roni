export const TRIGGER_LABELS: Record<string, string> = {
  missed_session: "Missed session",
  gap_3_days: "Training gap",
  tough_session_completed: "Tough session",
  weekly_recap: "Weekly recap",
  strength_milestone: "Milestone",
  plateau: "Plateau detected",
};

export const TRIGGER_SUBTITLES: Record<string, string> = {
  missed_session: "You missed a scheduled session",
  gap_3_days: "It's been a while since your last workout",
  tough_session_completed: "Great job on that tough session!",
  weekly_recap: "Your weekly training summary",
  strength_milestone: "You hit a strength milestone!",
  plateau: "Your progress has plateaued -- let's adjust",
};

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  missed_session: "I missed a scheduled workout",
  gap_3_days: "I haven't worked out in a few days",
  tough_session_completed: "I just finished a tough workout",
  weekly_recap: "my weekly training recap",
  strength_milestone: "a strength milestone I hit",
  plateau: "a potential plateau in my training",
};

export function buildChatPrompt(checkIn: {
  message: string;
  trigger: string;
  triggerContext?: string;
}): string {
  const context = TRIGGER_DESCRIPTIONS[checkIn.trigger] ?? "a recent check-in";
  const extra = checkIn.triggerContext ? ` (context: ${checkIn.triggerContext})` : "";
  return `You recently checked in about ${context}${extra}. Your message was: "${checkIn.message}" — what should I do about this? Give me specific actionable advice.`;
}
