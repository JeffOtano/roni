"use client";

import { WorkoutCard } from "./WorkoutCard";

const TOOL_MESSAGES: Record<string, { running: string; done: string }> = {
  search_exercises: {
    running: "Searching exercises...",
    done: "Searched exercises",
  },
  get_strength_scores: {
    running: "Checking strength scores...",
    done: "Checked strength scores",
  },
  get_strength_history: {
    running: "Reviewing strength history...",
    done: "Reviewed strength history",
  },
  get_muscle_readiness: {
    running: "Checking muscle readiness...",
    done: "Checked muscle readiness",
  },
  get_workout_history: {
    running: "Reviewing workout history...",
    done: "Reviewed workout history",
  },
  get_workout_detail: {
    running: "Loading workout details...",
    done: "Loaded workout details",
  },
  get_training_frequency: {
    running: "Analyzing training frequency...",
    done: "Analyzed training frequency",
  },
  create_workout: {
    running: "Creating workout...",
    done: "Created workout",
  },
  delete_workout: {
    running: "Deleting workout...",
    done: "Deleted workout",
  },
  estimate_duration: {
    running: "Estimating duration...",
    done: "Estimated duration",
  },
};

interface ToolCallIndicatorProps {
  toolName: string;
  state: string;
  input?: unknown;
}

export function ToolCallIndicator({ toolName, state, input }: ToolCallIndicatorProps) {
  const messages = TOOL_MESSAGES[toolName] ?? {
    running: `Running ${toolName}...`,
    done: `Ran ${toolName}`,
  };

  const isRunning = state === "input-streaming" || state === "input-available";
  const isDone = state === "output-available";

  // Special case: create_workout shows WorkoutCard when done
  if (toolName === "create_workout" && isDone && input) {
    const data = input as {
      name?: string;
      exercises?: Array<{
        exerciseName?: string;
        name?: string;
        sets?: number;
        reps?: number;
      }>;
    };
    return <WorkoutCard title={data.name} exercises={data.exercises} />;
  }

  if (isRunning) {
    return (
      <div className="my-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-gradient-to-br from-primary to-[oklch(0.6_0.22_300)] opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-gradient-to-br from-primary to-[oklch(0.6_0.22_300)]" />
        </span>
        <span className="animate-pulse">{messages.running}</span>
      </div>
    );
  }

  if (isDone) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border-l-2 border-primary/40 bg-primary/5 px-2.5 py-1 text-xs text-muted-foreground transition-all duration-200">
        <span className="text-primary">&check;</span>
        {messages.done}
      </span>
    );
  }

  return null;
}
