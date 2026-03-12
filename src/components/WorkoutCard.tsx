"use client";

import { Badge } from "@/components/ui/badge";

interface WorkoutExercise {
  exerciseName?: string;
  name?: string;
  sets?: number;
  reps?: number;
}

interface WorkoutCardProps {
  title?: string;
  exercises?: WorkoutExercise[];
}

export function WorkoutCard({ title, exercises }: WorkoutCardProps) {
  return (
    <div className="mt-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-card-foreground">
          {title ?? "Custom Workout"}
        </span>
        <Badge variant="secondary" className="text-xs">
          Pushed to Tonal
        </Badge>
      </div>
      {exercises && exercises.length > 0 && (
        <ul className="mt-2 space-y-1">
          {exercises.map((ex, i) => (
            <li
              key={i}
              className="text-xs text-muted-foreground"
            >
              {ex.exerciseName ?? ex.name ?? `Exercise ${i + 1}`}
              {ex.sets && ex.reps ? ` - ${ex.sets}x${ex.reps}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
