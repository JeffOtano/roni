"use client";

import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useActionData } from "@/hooks/useActionData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardCardSkeleton } from "@/components/DashboardCardSkeleton";
import { DashboardCardError } from "@/components/DashboardCardError";
import { BarChart3, Clock, Dumbbell, TrendingUp, Weight } from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types (matches ProgressMetrics from convex/stats.ts)
// ---------------------------------------------------------------------------

interface ProgressMetrics {
  totalWorkouts: number;
  totalVolume: number;
  avgVolume: number;
  totalDuration: number;
  avgDuration: number;
  workoutsByTargetArea: Record<string, number>;
  workoutsPerWeek: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatVolume(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M`;
  if (lbs >= 1_000) return `${(lbs / 1_000).toFixed(1)}k`;
  return `${Math.round(lbs)}`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="text-xl font-bold tabular-nums text-foreground">
            {value}
            {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Distribution chart (horizontal bars)
// ---------------------------------------------------------------------------

const BAR_COLORS = ["bg-primary", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

function DistributionChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const max = Math.max(...entries.map(([, count]) => count), 1);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No workout data yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      {entries.map(([targetArea, count], i) => {
        const widthPct = Math.round((count / max) * 100);
        const color = BAR_COLORS[i % BAR_COLORS.length];
        return (
          <div key={targetArea} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{targetArea}</span>
              <span className="tabular-nums text-muted-foreground">
                {count} {count === 1 ? "workout" : "workouts"}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/50">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats content (render child of AsyncCard)
// ---------------------------------------------------------------------------

function StatsContent({ metrics }: { metrics: ProgressMetrics }) {
  return (
    <div className="space-y-6">
      {/* Key stat cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={Dumbbell} label="Total Workouts" value={String(metrics.totalWorkouts)} />
        <StatCard
          icon={Weight}
          label="Total Volume"
          value={formatVolume(metrics.totalVolume)}
          unit="lbs"
        />
        <StatCard icon={Clock} label="Avg Duration" value={formatDuration(metrics.avgDuration)} />
        <StatCard
          icon={TrendingUp}
          label="Per Week"
          value={metrics.workoutsPerWeek.toFixed(1)}
          unit="workouts"
        />
      </div>

      {/* Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            <BarChart3 className="size-4" />
            Training Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DistributionChart data={metrics.workoutsByTargetArea} />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StatsPage() {
  const metrics = useActionData<ProgressMetrics>(useAction(api.stats.getProgressMetrics));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Statistics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your training progress at a glance.</p>
      </div>

      {metrics.state.status === "loading" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <DashboardCardSkeleton key={i} />
          ))}
        </div>
      )}

      {metrics.state.status === "error" && (
        <DashboardCardError title="Statistics" onRetry={metrics.refetch} />
      )}

      {(metrics.state.status === "success" || metrics.state.status === "refreshing") && (
        <StatsContent metrics={metrics.state.data} />
      )}

      {/* Explore related pages */}
      <div className="mt-8 grid grid-cols-2 gap-3">
        <Link
          href="/strength"
          className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground ring-1 ring-border transition-all hover:bg-muted/80 hover:text-foreground"
        >
          Strength trends &rarr;
        </Link>
        <Link
          href="/exercises"
          className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground ring-1 ring-border transition-all hover:bg-muted/80 hover:text-foreground"
        >
          Browse exercises &rarr;
        </Link>
        <Link
          href="/progress"
          className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground ring-1 ring-border transition-all hover:bg-muted/80 hover:text-foreground"
        >
          Progress photos &rarr;
        </Link>
        <Link
          href={`/chat?prompt=${encodeURIComponent("Analyze my training over the last month")}`}
          className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground ring-1 ring-border transition-all hover:bg-muted/80 hover:text-foreground"
        >
          Ask coach for analysis &rarr;
        </Link>
      </div>
    </div>
  );
}
