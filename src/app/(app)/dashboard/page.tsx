"use client";

import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type {
  Activity,
  MuscleReadiness,
  StrengthDistribution,
  StrengthScore,
} from "../../../../convex/tonal/types";
import { StrengthScoreCard } from "@/components/StrengthScoreCard";
import { MuscleReadinessMap } from "@/components/MuscleReadinessMap";
import { TrainingFrequencyChart } from "@/components/TrainingFrequencyChart";
import { RecentWorkoutsList } from "@/components/RecentWorkoutsList";
import { AsyncCard } from "@/components/AsyncCard";
import { useActionData } from "@/hooks/useActionData";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Hey {firstName}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Link href="/dashboard/week">
          <Button variant="outline" size="sm" className="gap-2">
            <CalendarDays className="size-4" />
            Program your week
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AsyncCard
          state={strength.state}
          refetch={strength.refetch}
          lastUpdatedAt={strength.lastUpdatedAt}
          title="Strength Scores"
        >
          {(d) => <StrengthScoreCard scores={d.scores} distribution={d.distribution} />}
        </AsyncCard>
        <AsyncCard
          state={readiness.state}
          refetch={readiness.refetch}
          lastUpdatedAt={readiness.lastUpdatedAt}
          title="Muscle Readiness"
        >
          {(d) => <MuscleReadinessMap readiness={d} />}
        </AsyncCard>
        <AsyncCard
          state={frequency.state}
          refetch={frequency.refetch}
          lastUpdatedAt={frequency.lastUpdatedAt}
          title="Training Frequency"
        >
          {(d) => <TrainingFrequencyChart data={d} />}
        </AsyncCard>
        <AsyncCard
          state={workouts.state}
          refetch={workouts.refetch}
          lastUpdatedAt={workouts.lastUpdatedAt}
          title="Recent Workouts"
          tall
        >
          {(d) => <RecentWorkoutsList workouts={d} />}
        </AsyncCard>
      </div>
    </div>
  );
}
