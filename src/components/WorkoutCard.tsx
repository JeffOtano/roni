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
  return (
    <div className="my-2 rounded-lg border border-primary/30 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title ?? "Custom Workout"}</h3>
        <StatusBadge status={status} />
      </div>

      {exercises && exercises.length > 0 && (
        <ol className="mb-2 space-y-1 pl-5 text-sm">
          {exercises.map((ex, i) => (
            <li key={i} className="text-foreground/80">
              <span className="font-medium">{ex.exerciseName ?? ex.name ?? "Exercise"}</span>
              {ex.sets && ex.reps && (
                <span className="ml-1.5 text-muted-foreground">
                  — {ex.sets}&times;{ex.reps}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {estimatedDuration && (
        <p className="text-xs text-muted-foreground">~{Math.round(estimatedDuration / 60)} min</p>
      )}
    </div>
  );
}
