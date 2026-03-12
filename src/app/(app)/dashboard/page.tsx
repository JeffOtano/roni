"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
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
// Async card — reduces per-card boilerplate
// ---------------------------------------------------------------------------

function AsyncCard<T>({
  state,
  refetch,
  title,
  tall,
  children,
}: {
  state: AsyncState<T>;
  refetch: () => void;
  title: string;
  tall?: boolean;
  children: (data: T) => React.ReactNode;
}) {
  if (state.status === "loading") return <DashboardCardSkeleton tall={tall} />;
  if (state.status === "error") return <DashboardCardError title={title} onRetry={refetch} />;
  return <>{children(state.data)}</>;
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

interface FrequencyEntry {
  targetArea: string;
  count: number;
  lastTrainedDate?: string;
}

export default function DashboardPage() {
  const strength = useActionData<{
    scores: StrengthScore[];
    distribution: StrengthDistribution;
  }>(useAction(api.dashboard.getStrengthData));
  const readiness = useActionData<MuscleReadiness>(useAction(api.dashboard.getMuscleReadiness));
  const workouts = useActionData<Activity[]>(useAction(api.dashboard.getWorkoutHistory));
  const frequency = useActionData<FrequencyEntry[]>(useAction(api.dashboard.getTrainingFrequency));

  const me = useQuery(api.users.getMe);
  const firstName = me?.tonalName?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Hey {firstName}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AsyncCard state={strength.state} refetch={strength.refetch} title="Strength Scores">
          {(d) => <StrengthScoreCard scores={d.scores} distribution={d.distribution} />}
        </AsyncCard>
        <AsyncCard state={readiness.state} refetch={readiness.refetch} title="Muscle Readiness">
          {(d) => <MuscleReadinessMap readiness={d} />}
        </AsyncCard>
        <AsyncCard state={frequency.state} refetch={frequency.refetch} title="Training Frequency">
          {(d) => <TrainingFrequencyChart data={d} />}
        </AsyncCard>
        <AsyncCard state={workouts.state} refetch={workouts.refetch} title="Recent Workouts" tall>
          {(d) => <RecentWorkoutsList workouts={d} />}
        </AsyncCard>
      </div>
    </div>
  );
}
