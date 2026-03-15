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
import { ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

interface FrequencyEntry {
  targetArea: string;
  count: number;
  lastTrainedDate?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ---------------------------------------------------------------------------
// Quick navigation pills
// ---------------------------------------------------------------------------

const NAV_PILLS = [
  { label: "View stats", href: "/stats" },
  { label: "Strength trends", href: "/strength" },
  { label: "Browse exercises", href: "/exercises" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6 lg:py-10">
      {/* Greeting section */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Coach CTA */}
      <Link
        href="/chat?prompt=Based%20on%20my%20current%20data%2C%20what%20should%20I%20do%20today%3F"
        className="mb-6 flex items-center justify-between rounded-xl border border-primary/10 bg-primary/[0.03] px-4 py-3.5 transition-colors duration-200 hover:bg-primary/[0.06]"
      >
        <span className="text-sm font-medium text-foreground/90">Talk to your coach</span>
        <ArrowRight className="size-4 text-primary" />
      </Link>

      {/* Quick-access navigation */}
      <nav aria-label="Quick links" className="mb-8 flex flex-wrap gap-2">
        {NAV_PILLS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="rounded-full bg-muted/50 px-4 py-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted/80 hover:text-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Dashboard grid */}
      <div className="grid gap-5 sm:grid-cols-2">
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
