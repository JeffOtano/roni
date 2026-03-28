"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { useAnalytics } from "@/lib/analytics";
import { api } from "../../../../convex/_generated/api";
import { useActionData } from "@/hooks/useActionData";
import { ScheduleDayCard } from "@/components/schedule/ScheduleDayCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ArrowRight, MessageSquare } from "lucide-react";
import type { ScheduleData } from "../../../../convex/schedule";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeekRange(weekStartDate: string): string {
  const start = new Date(weekStartDate + "T12:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} \u2013 ${fmt(end)}`;
}

function getTodayIndex(weekStartDate: string): number {
  const start = new Date(weekStartDate + "T00:00:00Z");
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const diff = Math.floor((todayUtc.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff <= 6 ? diff : -1;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ScheduleSkeleton() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-8 lg:px-6 lg:py-10"
      role="status"
      aria-label="Loading schedule"
    >
      <div className="mb-8 space-y-1.5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-border">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-14 rounded-md" />
            </div>
            <Skeleton className="h-5 w-16 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="mt-2 h-7 w-24 rounded-md" />
          </div>
        ))}
        {Array.from({ length: 2 }, (_, i) => (
          <div key={`rest-${i}`} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function ScheduleEmpty() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6 lg:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Schedule</h1>
      <div className="mt-8 flex flex-col items-center gap-4 rounded-xl bg-card py-16 text-center ring-1 ring-border">
        <p className="text-sm text-muted-foreground">No workouts scheduled this week.</p>
        <Link
          href="/chat?prompt=Program%20my%20week%20please"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          Talk to your coach
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ScheduleError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6 lg:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Schedule</h1>
      <div className="mt-8">
        <ErrorAlert message="Failed to load your schedule." onRetry={onRetry} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SchedulePage() {
  const { track } = useAnalytics();

  useEffect(() => {
    track("schedule_viewed", { week_offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedule = useActionData<ScheduleData | null>(useAction(api.schedule.getScheduleData));

  if (schedule.state.status === "loading") return <ScheduleSkeleton />;
  if (schedule.state.status === "error") return <ScheduleError onRetry={schedule.refetch} />;

  const data = schedule.state.data;
  if (!data) return <ScheduleEmpty />;

  const todayIndex = getTodayIndex(data.weekStartDate);

  // Separate training and rest days for layout purposes
  const trainingDays = data.days.filter(
    (d) => d.sessionType !== "rest" && d.sessionType !== "recovery",
  );
  const restDays = data.days.filter(
    (d) => d.sessionType === "rest" || d.sessionType === "recovery",
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6 lg:py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">{formatWeekRange(data.weekStartDate)}</p>
      </div>

      {/* Training day cards */}
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        role="list"
        aria-label="Training days"
      >
        {trainingDays.map((day) => (
          <ScheduleDayCard
            key={day.dayIndex}
            day={day}
            isToday={day.dayIndex === todayIndex}
            isPast={day.dayIndex < todayIndex}
          />
        ))}
      </div>

      {/* Rest days - minimal rows */}
      {restDays.length > 0 && (
        <div className="mt-4 space-y-1" role="list" aria-label="Rest days">
          {restDays.map((day) => (
            <ScheduleDayCard
              key={day.dayIndex}
              day={day}
              isToday={day.dayIndex === todayIndex}
              isPast={day.dayIndex < todayIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
}
