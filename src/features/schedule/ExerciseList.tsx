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
      {visible.map((ex, i) => {
        const hasDynamicMode = ex.eccentric || ex.chains || ex.burnout || ex.dropSet;
        const modeTitle = [
          ex.eccentric && "Eccentric",
          ex.chains && "Chains",
          ex.burnout && "Burnout",
          ex.dropSet && "Drop Set",
        ]
          .filter(Boolean)
          .join(", ");
        return (
          <li
            key={`${ex.name}-${i}`}
            className={cn(
              "flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5",
              hasDynamicMode
                ? "bg-amber-500/5 ring-1 ring-inset ring-amber-500/20"
                : i % 2 === 0
                  ? "bg-white/3"
                  : "bg-transparent",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {hasDynamicMode && (
                <span
                  className="size-1.5 shrink-0 rounded-full bg-amber-400"
                  title={modeTitle}
                  aria-label={`Dynamic mode: ${modeTitle}`}
                />
              )}
              <span className="min-w-0 truncate text-xs font-medium text-foreground/80">
                {ex.name}
              </span>
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
              {ex.sets}&times;
              {ex.durationSeconds != null ? `${ex.durationSeconds}s` : (ex.reps ?? "--")}
            </span>
          </li>
        );
      })}
      {remaining > 0 && (
        <li className="px-2 pt-1 text-[10px] font-medium text-muted-foreground/50">
          +{remaining} more
        </li>
      )}
    </ul>
  );
}
