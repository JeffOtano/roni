"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { usePageView } from "@/lib/analytics";
import type {
  MuscleReadiness,
  StrengthDistribution,
  StrengthScore,
} from "../../../../convex/tonal/types";
import type { DashboardExternalActivity, DashboardWorkout } from "../../../../convex/dashboard";
import type { RecentPRSummary } from "../../../../convex/prs";
import { StrengthScoreCard } from "@/features/dashboard/StrengthScoreCard";
import { MuscleReadinessMap } from "@/features/dashboard/MuscleReadinessMap";
import { TrainingFrequencyChart } from "@/features/dashboard/TrainingFrequencyChart";
import { RecentWorkoutsList } from "@/features/dashboard/RecentWorkoutsList";
import { ExternalActivitiesList } from "@/features/dashboard/ExternalActivitiesList";
import { PRHighlightsCard } from "@/features/dashboard/PRHighlightsCard";
import { AsyncCard } from "@/components/AsyncCard";
import { useActionData } from "@/hooks/useActionData";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCardSkeleton } from "@/features/dashboard/DashboardCardSkeleton";

// ---------------------------------------------------------------------------
// QueryCard -- lightweight wrapper for reactive Convex query data
// ---------------------------------------------------------------------------

function QueryCard<T>({
  data,
  title,
  tall,
  wide,
  children,
}: {
  data: T | undefined;
  title: string;
  tall?: boolean;
  /** Span both columns on the 2-col dashboard grid. */
  wide?: boolean;
  children: (data: T) => React.ReactNode;
}) {
  if (data === undefined) return <DashboardCardSkeleton tall={tall} wide={wide} />;

  return (
    <Card className={cn("animate-in fade-in duration-300", wide && "sm:col-span-2")}>
      <CardHeader>
        <CardTitle>
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className={tall ? "min-h-[220px]" : ""}>{children(data)}</CardContent>
    </Card>
  );
}

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
  { label: "Personal records", href: "/prs" },
  { label: "Browse exercises", href: "/exercises" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  usePageView("dashboard_viewed");

  // Strength data stays as action (needs distribution from Tonal API)
  const strength = useActionData<{
    scores: StrengthScore[];
    distribution: StrengthDistribution;
  }>(useAction(api.dashboard.getStrengthData));

  // These 4 are now reactive queries reading from sync tables
  const readiness = useQuery(api.dashboard.getMuscleReadiness);
  const workouts = useQuery(api.dashboard.getWorkoutHistory);
  const frequency = useQuery(api.dashboard.getTrainingFrequency);
  const externalActivities = useQuery(api.dashboard.getExternalActivities);
  const prSummary = useQuery(api.prs.getRecentPRSummary);

  const me = useQuery(api.users.getMe);
  const firstName = me?.tonalName?.split(" ")[0] ?? "there";

  // Trigger backfill for users who connected before the sync feature
  const triggerBackfill = useMutation(api.dashboard.triggerBackfillIfNeeded);
  const backfillTriggered = useRef(false);
  useEffect(() => {
    if (backfillTriggered.current) return;
    if (me?.hasTonalProfile && workouts !== undefined && workouts.length === 0) {
      backfillTriggered.current = true;
      triggerBackfill();
    }
  }, [me, workouts, triggerBackfill]);

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
        className="mb-6 flex items-center justify-between rounded-xl border border-primary/10 bg-primary/3 px-4 py-3.5 transition-colors duration-200 hover:bg-primary/[0.06]"
      >
        <span className="text-sm font-medium text-foreground/90">Talk to your coach</span>
        <ArrowRight className="size-4 text-primary" aria-hidden="true" />
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
        <QueryCard<MuscleReadiness | null> data={readiness} title="Muscle Readiness">
          {(d) =>
            d ? (
              <MuscleReadinessMap readiness={d} />
            ) : (
              <p className="text-sm text-muted-foreground">No readiness data yet.</p>
            )
          }
        </QueryCard>
        <QueryCard<FrequencyEntry[]> data={frequency} title="Training Frequency">
          {(d) => <TrainingFrequencyChart data={d} />}
        </QueryCard>
        <QueryCard<DashboardWorkout[]> data={workouts} title="Recent Workouts" tall>
          {(d) => <RecentWorkoutsList workouts={d} />}
        </QueryCard>
        <QueryCard<RecentPRSummary> data={prSummary} title="Personal Records" wide>
          {(d) => <PRHighlightsCard summary={d} />}
        </QueryCard>
        <QueryCard<DashboardExternalActivity[]> data={externalActivities} title="Other Activities">
          {(d) => <ExternalActivitiesList activities={d} />}
        </QueryCard>
      </div>
    </div>
  );
}
