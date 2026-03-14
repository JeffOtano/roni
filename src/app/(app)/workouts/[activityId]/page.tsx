"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import type { SetActivity, WorkoutActivityDetail } from "../../../../../convex/tonal/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ArrowLeft, Clock, Dumbbell, MessageSquare, Weight } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function formatVolume(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M lbs`;
  if (lbs >= 1_000) return `${(lbs / 1_000).toFixed(1)}k lbs`;
  return `${Math.round(lbs)} lbs`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function groupSetsByBlock(sets: SetActivity[]): Map<number, SetActivity[]> {
  const blocks = new Map<number, SetActivity[]>();
  for (const set of sets) {
    const block = set.blockNumber;
    const existing = blocks.get(block);
    if (existing) {
      existing.push(set);
    } else {
      blocks.set(block, [set]);
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function WorkoutDetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Skeleton className="mb-6 h-8 w-48" />
      <Skeleton className="mb-2 h-5 w-64" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="mt-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Set row
// ---------------------------------------------------------------------------

function SetRow({ set }: { set: SetActivity }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="tabular-nums text-muted-foreground">
          {set.repetition}/{set.repetitionTotal}
        </span>
        <span className="text-foreground">{set.prescribedReps} reps</span>
        {set.weightPercentage != null && (
          <span className="tabular-nums text-muted-foreground">
            @ {Math.round(set.weightPercentage * 100)}%
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        {set.spotter && (
          <Badge variant="secondary" className="text-[10px]">
            Spotter
          </Badge>
        )}
        {set.eccentric && (
          <Badge variant="secondary" className="text-[10px]">
            Eccentric
          </Badge>
        )}
        {set.chains && (
          <Badge variant="secondary" className="text-[10px]">
            Chains
          </Badge>
        )}
        {set.warmUp && (
          <Badge variant="outline" className="text-[10px]">
            Warm-up
          </Badge>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WorkoutDetailPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = use(params);
  const getDetail = useAction(api.workoutDetail.getWorkoutDetail);

  const [state, setState] = useState<
    { status: "loading" } | { status: "success"; data: WorkoutActivityDetail } | { status: "error" }
  >({ status: "loading" });

  const fetch = useCallback(() => {
    setState({ status: "loading" });
    getDetail({ activityId }).then(
      (data: WorkoutActivityDetail) => setState({ status: "success", data }),
      () => setState({ status: "error" }),
    );
  }, [getDetail, activityId]);

  useEffect(() => {
    queueMicrotask(() => fetch());
  }, [fetch]);

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
        <ErrorAlert message="Failed to load workout details." onRetry={fetch} />
      </div>
    );
  }

  const detail = state.data;
  const blocks = groupSetsByBlock(detail.workoutSetActivity ?? []);
  const chatPrompt = encodeURIComponent(
    `Tell me about my workout on ${formatDate(detail.beginTime)}`,
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Back button */}
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="mb-4 gap-2">
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Button>
      </Link>

      {/* Title and date */}
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Workout Detail</h1>
      <p className="mt-1 text-sm text-muted-foreground">{formatDate(detail.beginTime)}</p>

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardContent className="flex flex-col items-center gap-1 py-3">
            <Clock className="size-4 text-primary" />
            <span className="text-lg font-bold tabular-nums text-foreground">
              {formatDuration(detail.totalDuration)}
            </span>
            <span className="text-[10px] text-muted-foreground">Duration</span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col items-center gap-1 py-3">
            <Weight className="size-4 text-primary" />
            <span className="text-lg font-bold tabular-nums text-foreground">
              {formatVolume(detail.totalVolume)}
            </span>
            <span className="text-[10px] text-muted-foreground">Volume</span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col items-center gap-1 py-3">
            <Dumbbell className="size-4 text-primary" />
            <span className="text-lg font-bold tabular-nums text-foreground">
              {detail.totalSets}
            </span>
            <span className="text-[10px] text-muted-foreground">Sets</span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex flex-col items-center gap-1 py-3">
            <span className="text-sm font-bold" style={{ color: "oklch(0.78 0.154 195)" }}>
              %
            </span>
            <span className="text-lg font-bold tabular-nums text-foreground">
              {Math.round(detail.percentCompleted)}%
            </span>
            <span className="text-[10px] text-muted-foreground">Completed</span>
          </CardContent>
        </Card>
      </div>

      {/* Exercise blocks */}
      <div className="mt-8 space-y-4">
        {Array.from(blocks.entries()).map(([blockNum, sets]) => (
          <Card key={blockNum}>
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Block {blockNum}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sets.map((set) => (
                <SetRow key={set.id} set={set} />
              ))}
            </CardContent>
          </Card>
        ))}

        {blocks.size === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No set data available for this workout.
          </p>
        )}
      </div>

      {/* Ask coach link */}
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
