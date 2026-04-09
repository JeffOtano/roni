"use client";

import { StatusBadge } from "@/components/StatusBadge";

interface WorkoutExercise {
  exerciseName?: string;
  name?: string;
  sets?: number;
  reps?: number;
}

interface WorkoutCardProps {
  title?: string;
  exercises?: WorkoutExercise[];
  status?: "draft" | "pushed" | "completed" | "deleted";
  estimatedDuration?: number;
}

export function WorkoutCard({
  title,
  exercises,
  status = "pushed",
  estimatedDuration,
}: WorkoutCardProps) {
  const exerciseCount = exercises?.length ?? 0;

  return (
    <div className="my-2 max-w-sm rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {title ?? "Custom Workout"}
        </h3>
        <StatusBadge status={status} />
      </div>

      {exercises && exerciseCount > 0 && (
        <ol className="mb-2 space-y-1 pl-5 text-sm">
          {exercises.map((ex, i) => (
            <li key={i} className="text-foreground/80">
              <span className="font-medium">{ex.exerciseName ?? ex.name ?? "Exercise"}</span>
              {ex.sets && ex.reps && (
                <span className="ml-1.5 text-muted-foreground">
                  {ex.sets}&times;{ex.reps}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {exerciseCount > 0 && <span>{exerciseCount} exercises</span>}
        {estimatedDuration != null && estimatedDuration > 0 && (
          <span>~{Math.round(estimatedDuration / 60)} min</span>
        )}
      </div>
    </div>
  );
}
