"use client";

import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { StrengthDistribution, StrengthScore } from "../../../../convex/tonal/types";
import Link from "next/link";
import { useActionData } from "@/hooks/useActionData";
import { AsyncCard } from "@/components/AsyncCard";
import { StrengthOverview } from "@/components/progress/StrengthOverview";
import { TrainingStatsCompact } from "@/components/progress/TrainingStatsCompact";
import { ProgressPhotosSection } from "@/components/progress/ProgressPhotosSection";

const NAV_PILL =
  "rounded-full bg-muted/50 px-4 py-2 text-xs text-muted-foreground ring-1 ring-border transition-all hover:bg-muted/80 hover:text-foreground";

const SECTION_HEADING =
  "border-l-2 border-primary/30 pl-3 text-sm font-semibold text-muted-foreground";

interface ProgressMetrics {
  totalWorkouts: number;
  totalVolume: number;
  avgVolume: number;
  totalDuration: number;
  avgDuration: number;
  workoutsByTargetArea: Record<string, number>;
  workoutsPerWeek: number;
}

export default function ProgressPage() {
  const strengthData = useActionData<{
    scores: StrengthScore[];
    distribution: StrengthDistribution;
  }>(useAction(api.dashboard.getStrengthData));

  const metricsData = useActionData<ProgressMetrics>(useAction(api.stats.getProgressMetrics));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Your Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your strength, stats, and visible changes
        </p>
      </div>

      {/* Section 1: Strength Overview */}
      <section>
        <h2 className={SECTION_HEADING}>Strength</h2>
        <div className="mt-3">
          <AsyncCard
            state={strengthData.state}
            refetch={strengthData.refetch}
            lastUpdatedAt={strengthData.lastUpdatedAt}
            title="Current Scores"
          >
            {(d) => <StrengthOverview scores={d.scores} distribution={d.distribution} />}
          </AsyncCard>
        </div>
      </section>

      {/* Section 2: Training Stats */}
      <section className="mt-10">
        <h2 className={SECTION_HEADING}>Training Stats</h2>
        <div className="mt-3">
          <AsyncCard
            state={metricsData.state}
            refetch={metricsData.refetch}
            lastUpdatedAt={metricsData.lastUpdatedAt}
            title="Training Overview"
          >
            {(d) => <TrainingStatsCompact metrics={d} />}
          </AsyncCard>
        </div>
      </section>

      {/* Section 3: Progress Photos */}
      <section className="mt-10">
        <h2 className={SECTION_HEADING}>Progress Photos</h2>
        <p className="mt-1 pl-3 text-xs text-muted-foreground">Only you can see these</p>
        <div className="mt-3">
          <ProgressPhotosSection />
        </div>
      </section>

      {/* Bottom navigation links */}
      <div className="mt-10 flex flex-wrap gap-2">
        <Link href="/strength" className={NAV_PILL}>
          Strength history &rarr;
        </Link>
        <Link href="/exercises" className={NAV_PILL}>
          Browse exercises &rarr;
        </Link>
        <Link
          href={`/chat?prompt=${encodeURIComponent("Analyze my overall progress and suggest what to focus on next")}`}
          className={NAV_PILL}
        >
          Ask coach about progress &rarr;
        </Link>
      </div>
    </div>
  );
}
