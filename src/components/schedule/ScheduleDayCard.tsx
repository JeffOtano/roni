"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check, Clock, MessageSquare, X } from "lucide-react";
import type { ScheduleDay } from "../../../convex/schedule";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_LABELS: Record<string, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper",
  lower: "Lower",
  full_body: "Full Body",
  recovery: "Recovery",
  rest: "Rest",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusIndicator({ status }: { status: ScheduleDay["derivedStatus"] }) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
          <Check className="size-3.5" aria-hidden="true" />
          Completed
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
          <X className="size-3.5" aria-hidden="true" />
          Failed to push
        </span>
      );
    case "programmed":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
          <Clock className="size-3.5" aria-hidden="true" />
          Scheduled
        </span>
      );
    default:
      return null;
  }
}

function MissedIndicator() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
      <X className="size-3.5" aria-hidden="true" />
      Missed
    </span>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ScheduleDayCard({
  day,
  isToday,
  isPast,
}: {
  day: ScheduleDay;
  isToday: boolean;
  isPast: boolean;
}) {
  const isRest = day.sessionType === "rest" || day.sessionType === "recovery";
  const isMissed = isPast && day.derivedStatus === "programmed" && !isRest;
  const sessionLabel = SESSION_LABELS[day.sessionType] ?? day.sessionType;

  return (
    <Card
      className={cn(
        "transition-colors duration-200",
        isToday && "ring-1 ring-primary/40 shadow-[0_0_12px_-4px_var(--primary)]",
        isMissed && "opacity-75",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold", isToday ? "text-primary" : "text-foreground")}>
            {day.dayName}
            {isToday && <span className="ml-1.5 text-xs font-normal text-primary/70">Today</span>}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(day.date)}</p>
        </div>

        {!isRest && (
          <Badge variant="secondary" className="shrink-0 text-[10px] uppercase tracking-wider">
            {sessionLabel}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {isRest ? (
          <p className="text-sm text-muted-foreground/60">Rest</p>
        ) : (
          <>
            {/* Status */}
            {isMissed ? <MissedIndicator /> : <StatusIndicator status={day.derivedStatus} />}

            {/* Workout title */}
            {day.workoutTitle && (
              <p className="text-sm font-medium text-foreground/90 leading-snug">
                {day.workoutTitle}
              </p>
            )}

            {/* Exercise list */}
            {day.exercises.length > 0 && (
              <ul className="space-y-0.5" aria-label={`Exercises for ${day.dayName}`}>
                {day.exercises.map((ex, i) => (
                  <li
                    key={`${ex.name}-${i}`}
                    className="text-xs text-muted-foreground leading-relaxed"
                  >
                    {ex.name}
                    <span className="ml-1 text-muted-foreground/50">
                      {ex.sets}x{ex.reps ?? "--"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Duration */}
            {day.estimatedDuration != null && day.estimatedDuration > 0 && (
              <p className="text-xs text-muted-foreground/60">
                ~{formatDuration(day.estimatedDuration)}
              </p>
            )}

            {/* Action link */}
            <div className="pt-1">
              {day.derivedStatus === "completed" && day.tonalWorkoutId ? (
                <Link
                  href={`/workouts/${day.tonalWorkoutId}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-150 hover:text-primary/80"
                >
                  View workout
                </Link>
              ) : (
                <Link
                  href={`/chat?prompt=${encodeURIComponent(`Tell me about my ${sessionLabel} workout on ${day.dayName}`)}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
                >
                  <MessageSquare className="size-3" aria-hidden="true" />
                  Ask coach
                </Link>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
