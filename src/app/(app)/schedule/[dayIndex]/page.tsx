"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { useAnalytics } from "@/lib/analytics";
import { useActionData } from "@/hooks/useActionData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorAlert } from "@/components/ErrorAlert";
import { StatusBadge } from "@/features/schedule/StatusBadge";
import { ArrowLeft, Clock, Dumbbell, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "../../../../../convex/_generated/api";
import type { ScheduleData } from "../../../../../convex/schedule";

import {
  ExerciseListWithSupersets,
  formatDayDate,
  formatDuration,
  ScheduleDetailSkeleton,
  SESSION_BADGE_COLORS,
  SESSION_LABELS,
  StatCard,
} from "./components";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ScheduleDayPage({ params }: { params: Promise<{ dayIndex: string }> }) {
  const { dayIndex: rawIndex } = use(params);
  const dayIndex = Number(rawIndex);
  const { track } = useAnalytics();

  useEffect(() => {
    track("schedule_day_detail_viewed", { day_index: dayIndex });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayIndex]);

  const schedule = useActionData<ScheduleData | null>(useAction(api.schedule.getScheduleData));

  if (schedule.state.status === "loading") return <ScheduleDetailSkeleton />;

  if (schedule.state.status === "error") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/schedule">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowLeft className="size-4" />
            Back to schedule
          </Button>
        </Link>
        <ErrorAlert message="Failed to load workout details." onRetry={schedule.refetch} />
      </div>
    );
  }

  const data = schedule.state.data;
  const day = data?.days.find((d) => d.dayIndex === dayIndex);

  if (!data || !day) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/schedule">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowLeft className="size-4" />
            Back to schedule
          </Button>
        </Link>
        <p className="py-8 text-center text-sm text-muted-foreground">
          No workout found for this day.
        </p>
      </div>
    );
  }

  const sessionLabel = SESSION_LABELS[day.sessionType] ?? day.sessionType;
  const badgeColor = SESSION_BADGE_COLORS[day.sessionType] ?? "";
  const isPast = new Date(day.date + "T23:59:59Z").getTime() < new Date().setHours(0, 0, 0, 0);
  const isMissed = isPast && day.derivedStatus === "programmed";
  const effectiveStatus = isMissed ? ("missed" as const) : day.derivedStatus;
  const chatPrompt = encodeURIComponent(
    `Tell me about my ${sessionLabel} workout on ${day.dayName}`,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Back navigation */}
      <Link href="/schedule">
        <Button variant="ghost" size="sm" className="mb-4 gap-2">
          <ArrowLeft className="size-4" />
          Back to schedule
        </Button>
      </Link>

      {/* Title + metadata */}
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {formatDayDate(day.date)}
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wider",
            badgeColor,
          )}
        >
          {sessionLabel}
        </Badge>
        <StatusBadge status={effectiveStatus} />
      </div>

      {day.workoutTitle && (
        <p className="mt-3 text-sm font-medium text-foreground/80">{day.workoutTitle}</p>
      )}

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {day.estimatedDuration != null && day.estimatedDuration > 0 && (
          <StatCard
            icon={<Clock className="size-4 text-primary" />}
            value={formatDuration(day.estimatedDuration)}
            label="Estimated duration"
          />
        )}
        <StatCard
          icon={<Dumbbell className="size-4 text-primary" />}
          value={String(day.exercises.length)}
          label={day.exercises.length === 1 ? "Exercise" : "Exercises"}
        />
      </div>

      {/* Full exercise list */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Exercises
        </h2>
        {day.exercises.length > 0 ? (
          <ExerciseListWithSupersets exercises={day.exercises} dayName={day.dayName} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Exercises will appear once this workout is programmed.
          </p>
        )}
      </div>

      {/* Ask coach CTA */}
      <div className="mt-8">
        <Link href={`/chat?prompt=${chatPrompt}`}>
          <Button variant="outline" className="gap-2">
            <MessageSquare className="size-4" />
            Ask coach about this workout
          </Button>
        </Link>
      </div>
    </div>
  );
}
