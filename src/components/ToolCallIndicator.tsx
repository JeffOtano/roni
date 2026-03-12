"use client";

import { WorkoutCard } from "@/components/WorkoutCard";

const TOOL_MESSAGES: Record<string, string> = {
  search_exercises: "Searching exercises...",
  get_strength_scores: "Checking strength scores...",
  get_strength_history: "Loading strength history...",
  get_muscle_readiness: "Checking muscle readiness...",
  get_workout_history: "Looking at workout history...",
  get_workout_detail: "Loading workout details...",
  get_training_frequency: "Analyzing training frequency...",
  create_workout: "Creating workout on Tonal...",
  delete_workout: "Deleting workout...",
  estimate_duration: "Estimating duration...",
};

interface ToolCallIndicatorProps {
  toolName: string;
  state: string;
  input?: unknown;
}

export function ToolCallIndicator({
  toolName,
  state,
  input,
}: ToolCallIndicatorProps) {
  const message = TOOL_MESSAGES[toolName] ?? `Running ${toolName}...`;
  const isLoading =
    state === "input-streaming" || state === "input-available";
  const hasOutput = state === "output-available";

  if (hasOutput && toolName === "create_workout") {
    const args = input as {
      name?: string;
      exercises?: Array<{
        exerciseName?: string;
        name?: string;
        sets?: number;
        reps?: number;
      }>;
    } | undefined;
    return (
      <WorkoutCard
        title={args?.name}
        exercises={args?.exercises}
      />
    );
  }

  if (hasOutput) {
    return null;
  }

  return (
    <div className="my-1 flex items-center gap-2 text-xs text-muted-foreground">
      {isLoading && (
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground" />
      )}
      <span>{message}</span>
    </div>
  );
}
