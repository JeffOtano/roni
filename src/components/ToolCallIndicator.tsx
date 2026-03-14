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
  check_calendar: {
    running: "Checking your calendar...",
    done: "Checked your calendar",
  },
  create_calendar_event: {
    running: "Adding to your calendar...",
    done: "Added to calendar",
  },
  get_available_slots: {
    running: "Finding free time slots...",
    done: "Found available times",
  },
  program_week: {
    running: "Programming your week...",
    done: "Week programmed",
  },
  get_week_plan_details: {
    running: "Loading week plan...",
    done: "Loaded week plan",
  },
  delete_week_plan: {
    running: "Deleting week plan...",
    done: "Deleted week plan",
  },
  swap_exercise: {
    running: "Swapping exercise...",
    done: "Swapped exercise",
  },
  move_session: {
    running: "Moving session...",
    done: "Moved session",
  },
  adjust_session_duration: {
    running: "Adjusting session...",
    done: "Adjusted session",
  },
  approve_week_plan: {
    running: "Pushing workouts to your Tonal...",
    done: "Workouts pushed to Tonal",
  },
  get_workout_performance: {
    running: "Analyzing your performance...",
    done: "Performance analyzed",
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

  // Unified chip layout for both running and done (prevents layout shift during transitions)
  if (isRunning) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
        role="status"
      >
        <span
          className="inline-block size-1.5 rounded-full bg-primary motion-safe:animate-[tool-pulse_2s_ease-in-out_infinite]"
          aria-hidden="true"
        />
        {messages.running}
      </span>
    );
  }

  if (isDone) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
        <span className="text-primary" aria-hidden="true">
          &#10003;
        </span>
        {messages.done}
      </span>
    );
  }

  return null;
}
