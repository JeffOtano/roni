"use client";

import { cn } from "@/lib/utils";
import type { ScheduleExercise } from "../../../convex/schedule";

const MAX_VISIBLE = 4;

export function ExerciseList({
  exercises,
  dayName,
}: {
  exercises: readonly ScheduleExercise[];
  dayName: string;
}) {
  if (exercises.length === 0) {
    return (
      <p className="py-2 text-xs text-muted-foreground/50 italic">
        Exercises will appear once programmed.
      </p>
    );
  }

  const visible = exercises.slice(0, MAX_VISIBLE);
  const remaining = exercises.length - MAX_VISIBLE;

  return (
    <ul className="space-y-0" aria-label={`Exercises for ${dayName}`}>
      {visible.map((ex, i) => (
        <li
          key={`${ex.name}-${i}`}
          className={cn(
            "flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5",
            i % 2 === 0 ? "bg-white/[0.03]" : "bg-transparent",
          )}
        >
          <span className="min-w-0 truncate text-xs font-medium text-foreground/80">{ex.name}</span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
            {ex.sets}&times;{ex.reps ?? "--"}
          </span>
        </li>
      ))}
      {remaining > 0 && (
        <li className="px-2 pt-1 text-[10px] font-medium text-muted-foreground/50">
          +{remaining} more
        </li>
      )}
    </ul>
  );
}
