"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Clock, Eye, MessageSquare, Moon } from "lucide-react";
import { ExerciseList } from "./ExerciseList";
import { StatusBadge } from "./StatusBadge";
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

/** Left-border accent color per session type for instant visual grouping. */
const SESSION_BORDER_COLORS: Record<string, string> = {
  push: "border-l-blue-500",
  pull: "border-l-purple-500",
  legs: "border-l-emerald-500",
  upper: "border-l-orange-400",
  lower: "border-l-teal-400",
  full_body: "border-l-pink-500",
};

/** Badge background tint per session type. */
const SESSION_BADGE_COLORS: Record<string, string> = {
  push: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  pull: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  legs: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  upper: "bg-orange-400/15 text-orange-300 border-orange-400/20",
  lower: "bg-teal-400/15 text-teal-300 border-teal-400/20",
  full_body: "bg-pink-500/15 text-pink-400 border-pink-500/20",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Rest day row (minimal treatment)
// ---------------------------------------------------------------------------

function RestDayRow({ day, isToday }: { day: ScheduleDay; isToday: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-4 py-3",
        isToday ? "bg-muted/60 ring-1 ring-primary/20" : "bg-transparent",
      )}
      role="listitem"
      aria-label={`${day.dayName}, ${formatDate(day.date)} — Rest day`}
    >
      <Moon className="size-3.5 text-muted-foreground/40" aria-hidden="true" />
      <span
        className={cn("text-sm font-medium", isToday ? "text-primary" : "text-muted-foreground/60")}
      >
        {day.dayName}
        {isToday && <span className="ml-1.5 text-xs font-normal text-primary/70">Today</span>}
      </span>
      <span className="text-xs text-muted-foreground/40">{formatDate(day.date)}</span>
      <span className="ml-auto text-xs text-muted-foreground/40 italic">Rest</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Training day card
// ---------------------------------------------------------------------------

function TrainingDayCard({
  day,
  isToday,
  isPast,
}: {
  day: ScheduleDay;
  isToday: boolean;
  isPast: boolean;
}) {
  const isMissed = isPast && day.derivedStatus === "programmed";
  const sessionLabel = SESSION_LABELS[day.sessionType] ?? day.sessionType;
  const borderColor = SESSION_BORDER_COLORS[day.sessionType] ?? "border-l-muted";
  const badgeColor = SESSION_BADGE_COLORS[day.sessionType] ?? "";
  const effectiveStatus = isMissed ? ("missed" as const) : day.derivedStatus;

  return (
    <article
      className={cn(
        "group/card relative flex flex-col rounded-xl border-l-[3px] bg-card text-card-foreground ring-1 ring-border transition-all duration-200",
        borderColor,
        isToday && ["ring-primary/30", "shadow-[0_0_20px_-4px_var(--primary)]", "scale-[1.01]"],
        !isToday && "shadow-lg shadow-black/5 hover:ring-foreground/15",
        isMissed && "opacity-60",
      )}
      aria-label={`${day.dayName}, ${formatDate(day.date)} — ${sessionLabel}`}
      aria-current={isToday ? "date" : undefined}
    >
      {/* Stretched link — covers the card for click/tap to detail view */}
      <Link
        href={`/schedule/${day.dayIndex}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={`View ${day.dayName} workout details`}
        tabIndex={0}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-semibold leading-tight",
              isToday ? "text-primary" : "text-foreground",
            )}
          >
            {day.dayName}
            {isToday && (
              <span className="ml-1.5 rounded-sm bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Today
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/60">{formatDate(day.date)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Duration pill */}
          {day.estimatedDuration != null && day.estimatedDuration > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <Clock className="size-2.5" aria-hidden="true" />
              {formatDuration(day.estimatedDuration)}
            </span>
          )}
          {/* Session type badge */}
          <Badge
            variant="outline"
            className={cn(
              "h-5 rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-wider",
              badgeColor,
            )}
          >
            {sessionLabel}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 px-4 pb-3">
        {/* Status */}
        <StatusBadge status={effectiveStatus} />

        {/* Workout title */}
        {day.workoutTitle && (
          <p className="text-sm font-medium leading-snug text-foreground/90">{day.workoutTitle}</p>
        )}

        {/* Exercises */}
        <ExerciseList exercises={day.exercises} dayName={day.dayName} />
      </div>

      {/* Footer action — relative z-10 lifts above the stretched link */}
      <div className="relative z-10 border-t border-border/50 px-4 py-2.5">
        {day.derivedStatus === "completed" && day.tonalWorkoutId ? (
          <Button
            variant="ghost"
            size="xs"
            className="h-7 gap-1.5"
            render={<Link href={`/activity/${day.tonalWorkoutId}`} />}
          >
            <Eye className="size-3" aria-hidden="true" />
            View workout
          </Button>
        ) : (
          <Button
            variant="outline"
            size="xs"
            className="h-7 gap-1.5"
            render={
              <Link
                href={`/chat?prompt=${encodeURIComponent(`Tell me about my ${sessionLabel} workout on ${day.dayName}`)}`}
              />
            }
          >
            <MessageSquare className="size-3" aria-hidden="true" />
            Ask coach
          </Button>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Public component
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

  if (isRest) {
    return <RestDayRow day={day} isToday={isToday} />;
  }

  return <TrainingDayCard day={day} isToday={isToday} isPast={isPast} />;
}
