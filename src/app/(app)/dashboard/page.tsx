"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type {
  Activity,
  MuscleReadiness,
  StrengthDistribution,
  StrengthScore,
} from "../../../../convex/tonal/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ErrorAlert";
import { StrengthScoreCard } from "@/components/StrengthScoreCard";
import { MuscleReadinessMap } from "@/components/MuscleReadinessMap";
import { TrainingFrequencyChart } from "@/components/TrainingFrequencyChart";
import { RecentWorkoutsList } from "@/components/RecentWorkoutsList";

// ---------------------------------------------------------------------------
// Loading skeleton shared across cards
// ---------------------------------------------------------------------------

function DashboardCardSkeleton({ tall }: { tall?: boolean }) {
  return (
    <Card className={tall ? "min-h-[300px]" : "min-h-[200px]"}>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function DashboardCardError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ErrorAlert message="Failed to load data." onRetry={onRetry} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Async data hook for actions (avoids setState-in-effect lint rule)
// ---------------------------------------------------------------------------

type AsyncState<T> = { status: "loading" } | { status: "success"; data: T } | { status: "error" };

function useActionData<T>(actionFn: (...args: [Record<string, never>]) => Promise<T>): {
  state: AsyncState<T>;
  refetch: () => void;
} {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    actionFn({}).then(
      (data) => {
        if (!cancelled && mountedRef.current) setState({ status: "success", data });
      },
      () => {
        if (!cancelled && mountedRef.current) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [actionFn]);

  const refetch = useCallback(() => {
    setState({ status: "loading" });
    actionFn({}).then(
      (data) => {
        if (mountedRef.current) setState({ status: "success", data });
      },
      () => {
        if (mountedRef.current) setState({ status: "error" });
      },
    );
  }, [actionFn]);

  return { state, refetch };
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

interface FrequencyEntry {
  targetArea: string;
  count: number;
}

export default function DashboardPage() {
  const getStrengthData = useAction(api.dashboard.getStrengthData);
  const getMuscleReadiness = useAction(api.dashboard.getMuscleReadiness);
  const getWorkoutHistory = useAction(api.dashboard.getWorkoutHistory);
  const getTrainingFrequency = useAction(api.dashboard.getTrainingFrequency);

  const strength = useActionData<{
    scores: StrengthScore[];
    distribution: StrengthDistribution;
  }>(getStrengthData);

  const readiness = useActionData<MuscleReadiness>(getMuscleReadiness);
  const workouts = useActionData<Activity[]>(getWorkoutHistory);
  const frequency = useActionData<FrequencyEntry[]>(getTrainingFrequency);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-xl font-semibold text-foreground">Training Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Strength Scores */}
        {strength.state.status === "loading" && <DashboardCardSkeleton />}
        {strength.state.status === "error" && (
          <DashboardCardError title="Strength Scores" onRetry={strength.refetch} />
        )}
        {strength.state.status === "success" && (
          <StrengthScoreCard
            scores={strength.state.data.scores}
            distribution={strength.state.data.distribution}
          />
        )}

        {/* Muscle Readiness */}
        {readiness.state.status === "loading" && <DashboardCardSkeleton />}
        {readiness.state.status === "error" && (
          <DashboardCardError title="Muscle Readiness" onRetry={readiness.refetch} />
        )}
        {readiness.state.status === "success" && (
          <MuscleReadinessMap readiness={readiness.state.data} />
        )}

        {/* Training Frequency */}
        {frequency.state.status === "loading" && <DashboardCardSkeleton />}
        {frequency.state.status === "error" && (
          <DashboardCardError title="Training Frequency" onRetry={frequency.refetch} />
        )}
        {frequency.state.status === "success" && (
          <TrainingFrequencyChart data={frequency.state.data} />
        )}

        {/* Recent Workouts */}
        {workouts.state.status === "loading" && <DashboardCardSkeleton tall />}
        {workouts.state.status === "error" && (
          <DashboardCardError title="Recent Workouts" onRetry={workouts.refetch} />
        )}
        {workouts.state.status === "success" && (
          <RecentWorkoutsList workouts={workouts.state.data} />
        )}
      </div>
    </div>
  );
}
