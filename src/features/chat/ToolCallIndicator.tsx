"use client";

import { WeekPlanCard } from "./WeekPlanCard";
import { ActionConfirmationBanner } from "./ActionConfirmationBanner";
import { extractBannerProps } from "./bannerExtractors";
import { weekPlanPresentationSchema } from "../../../convex/ai/schemas";
import type { WeekPlanPresentation } from "../../../convex/ai/schemas";

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
  output?: unknown;
}

export function ToolCallIndicator({ toolName, state, output }: ToolCallIndicatorProps) {
  const messages = TOOL_MESSAGES[toolName] ?? {
    running: `Running ${toolName}...`,
    done: `Ran ${toolName}`,
  };

  const isRunning = state === "input-streaming" || state === "input-available";
  const isDone = state === "output-available";

  // Special case: program_week shows WeekPlanCard when done
  if (toolName === "program_week" && isDone && output) {
    const data = output as Record<string, unknown>;
    const summary =
      data?.success && typeof data.summary === "object" && data.summary !== null
        ? (data.summary as Record<string, unknown>)
        : null;

    if (summary) {
      const splitResult = weekPlanPresentationSchema.shape.split.safeParse(summary.preferredSplit);
      if (!splitResult.success) return null;

      const days = Array.isArray(summary.days) ? summary.days : [];
      const plan: WeekPlanPresentation = {
        weekStartDate: String(summary.weekStartDate ?? ""),
        split: splitResult.data,
        days: days.map((day: Record<string, unknown>) => {
          const exercises = Array.isArray(day.exercises) ? day.exercises : [];
          return {
            dayName: String(day.dayName ?? ""),
            sessionType: String(day.sessionType ?? ""),
            targetMuscles: [
              ...new Set(
                exercises.flatMap((ex: Record<string, unknown>) =>
                  Array.isArray(ex.muscleGroups) ? ex.muscleGroups : [],
                ),
              ),
            ].join(", "),
            durationMinutes: Number(day.estimatedDuration ?? 0),
            exercises: exercises.map((ex: Record<string, unknown>) => ({
              name: String(ex.name ?? ""),
              sets: Number(ex.sets ?? 0),
              reps: Number(ex.reps ?? 0),
              targetWeight: typeof ex.targetWeight === "number" ? ex.targetWeight : undefined,
              lastWeight: typeof ex.lastWeight === "number" ? ex.lastWeight : undefined,
              note: [ex.suggestedTarget, ex.lastTime].filter(Boolean).join(" | ") || undefined,
            })),
          };
        }),
        summary: `${String(summary.preferredSplit).toUpperCase()} split - ${days.length} training days`,
      };

      return <WeekPlanCard plan={plan} />;
    }
  }

  // State-changing tools: show confirmation banner when done
  if (isDone) {
    const bannerProps = extractBannerProps(toolName, output);
    if (bannerProps) {
      return <ActionConfirmationBanner {...bannerProps} />;
    }
  }

  // Unified chip layout for both running and done
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
