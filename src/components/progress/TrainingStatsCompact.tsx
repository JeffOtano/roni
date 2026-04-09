"use client";

import Link from "next/link";
import { Clock, Dumbbell, TrendingUp, Weight } from "lucide-react";

interface ProgressMetrics {
  readonly totalWorkouts: number;
  readonly totalVolume: number;
  readonly avgDuration: number;
  readonly workoutsPerWeek: number;
  readonly workoutsByTargetArea: Record<string, number>;
}

const BAR_COLORS = ["bg-primary", "bg-chart-2", "bg-chart-3", "bg-chart-4"];
const TOP_N = 4;

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

interface StatCellProps {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
}

function StatCell({ icon: Icon, label, value, unit }: StatCellProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3 ring-1 ring-border">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-lg font-bold tabular-nums text-foreground">
          {value}
          {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

interface TrainingStatsCompactProps {
  readonly metrics: ProgressMetrics;
}

export function TrainingStatsCompact({ metrics }: TrainingStatsCompactProps) {
  const entries = Object.entries(metrics.workoutsByTargetArea)
    .sort(([, a], [, b]) => b - a)
    .slice(0, TOP_N);
  const max = Math.max(...entries.map(([, count]) => count), 1);

  return (
    <div>
      {/* 2x2 stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCell icon={Dumbbell} label="Total Workouts" value={String(metrics.totalWorkouts)} />
        <StatCell
          icon={Weight}
          label="Total Volume"
          value={formatVolume(metrics.totalVolume)}
          unit="lbs"
        />
        <StatCell icon={Clock} label="Avg Duration" value={formatDuration(metrics.avgDuration)} />
        <StatCell
          icon={TrendingUp}
          label="Per Week"
          value={metrics.workoutsPerWeek.toFixed(1)}
          unit="/wk"
        />
      </div>

      {/* Compact distribution bars (top 4) */}
      {entries.length > 0 && (
        <div className="mt-5 flex flex-col gap-2.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Top training areas
          </p>
          {entries.map(([area, count], i) => {
            const widthPct = Math.round((count / max) * 100);
            return (
              <div key={area} className="flex items-center gap-3">
                <span className="w-16 shrink-0 truncate text-xs text-foreground sm:w-20">
                  {area}
                </span>
                <div className="h-1.5 flex-1 rounded-full bg-muted/50">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${BAR_COLORS[i % BAR_COLORS.length]}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex justify-center">
        <Link
          href="/stats"
          className="text-xs font-medium text-primary/80 transition-colors hover:text-primary"
        >
          View full stats &rarr;
        </Link>
      </div>
    </div>
  );
}
