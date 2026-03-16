"use client";

import Link from "next/link";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useActionData } from "@/hooks/useActionData";
import { ScheduleDayCard } from "@/components/schedule/ScheduleDayCard";
import { Card, CardContent } from "@/components/ui/card";
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
      className="mx-auto max-w-5xl px-4 py-8 lg:px-6 lg:py-10"
      role="status"
      aria-label="Loading schedule"
    >
      <div className="mb-6 space-y-1.5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 7 }, (_, i) => (
          <Card key={i}>
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </CardContent>
          </Card>
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
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6 lg:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Schedule</h1>
      <Card className="mt-8">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">No workouts scheduled this week.</p>
          <Link
            href="/chat?prompt=Program%20my%20week%20please"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
          >
            <MessageSquare className="size-4" aria-hidden="true" />
            Talk to your coach
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ScheduleError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6 lg:py-10">
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
  const schedule = useActionData<ScheduleData | null>(useAction(api.schedule.getScheduleData));

  if (schedule.state.status === "loading") return <ScheduleSkeleton />;
  if (schedule.state.status === "error") return <ScheduleError onRetry={schedule.refetch} />;

  const data = schedule.state.data;
  if (!data) return <ScheduleEmpty />;

  const todayIndex = getTodayIndex(data.weekStartDate);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6 lg:py-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">{formatWeekRange(data.weekStartDate)}</p>
      </div>

      {/* Day cards grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.days.map((day) => (
          <ScheduleDayCard
            key={day.dayIndex}
            day={day}
            isToday={day.dayIndex === todayIndex}
            isPast={day.dayIndex < todayIndex}
          />
        ))}
      </div>
    </div>
  );
}
