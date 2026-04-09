"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { useAnalytics } from "@/lib/analytics";
import type {
  EnrichedSetActivity,
  EnrichedWorkoutDetail,
} from "../../../../../convex/workoutDetail";

import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ArrowLeft, Clock, Dumbbell, MessageSquare, Repeat, Target, Weight } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";

import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatVolume,
  MovementCard,
  StatCard,
  TimeBreakdownBar,
  WorkoutDetailSkeleton,
  workoutTypeLabel,
} from "./components";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupSetsByMovement(sets: EnrichedSetActivity[]): Map<string, EnrichedSetActivity[]> {
  const groups = new Map<string, EnrichedSetActivity[]>();
  for (const set of sets) {
    const existing = groups.get(set.movementId);
    if (existing) {
      existing.push(set);
    } else {
      groups.set(set.movementId, [set]);
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WorkoutDetailPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const { track } = useAnalytics();
  const getDetail = useAction(api.workoutDetail.getWorkoutDetail);

  const [state, setState] = useState<
    { status: "loading" } | { status: "success"; data: EnrichedWorkoutDetail } | { status: "error" }
  >({ status: "loading" });

  const fetchData = useCallback(() => {
    setState({ status: "loading" });
    getDetail({ activityId }).then(
      (data) => {
        if (!data || data.totalVolume === 0) {
          setState({ status: "error" });
        } else {
          setState({ status: "success", data });
        }
      },
      () => setState({ status: "error" }),
    );
  }, [getDetail, activityId]);

  useEffect(() => {
    track("activity_detail_viewed", { activity_id: activityId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId]);

  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  if (state.status === "loading") return <WorkoutDetailSkeleton />;

  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Button>
        </Link>
        <ErrorAlert message="Failed to load workout details." onRetry={fetchData} />
      </div>
    );
  }

  const detail = state.data;
  const setsByMovement = groupSetsByMovement(detail.workoutSetActivity ?? []);
  const chatPrompt = encodeURIComponent(
    `Tell me about my workout on ${formatDate(detail.beginTime)}`,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="mb-4 gap-2">
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Button>
      </Link>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {workoutTypeLabel(detail.workoutType)}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(detail.beginTime)}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Clock className="size-4 text-primary" />}
          value={formatDuration(detail.totalDuration)}
          label="Duration"
          sublabel={`${formatDuration(detail.activeDuration)} active`}
        />
        <StatCard
          icon={<Weight className="size-4 text-primary" />}
          value={formatVolume(detail.totalVolume)}
          label="Volume"
        />
        <StatCard
          icon={<Dumbbell className="size-4 text-primary" />}
          value={String(detail.totalSets)}
          label="Sets"
        />
        <StatCard
          icon={<Repeat className="size-4 text-primary" />}
          value={String(detail.totalReps)}
          label="Reps"
        />
        <StatCard
          icon={<Target className="size-4 text-primary" />}
          value={String(detail.totalMovements)}
          label="Movements"
        />
        <StatCard
          icon={<span className="text-sm font-bold text-primary">%</span>}
          value={`${Math.round(detail.percentCompleted)}%`}
          label="Completed"
        />
      </div>

      <div className="mt-4">
        <TimeBreakdownBar
          activeDuration={detail.activeDuration}
          restDuration={detail.restDuration}
        />
      </div>

      <div className="mt-8 space-y-4">
        {detail.movementSummaries.map((summary) => (
          <MovementCard
            key={summary.movementId}
            summary={summary}
            sets={setsByMovement.get(summary.movementId) ?? []}
          />
        ))}

        {detail.movementSummaries.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No exercise data available for this workout.
          </p>
        )}
      </div>

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
