"use client";

import Link from "next/link";

interface FrequencyEntry {
  targetArea: string;
  count: number;
  lastTrainedDate?: string;
}

interface TrainingFrequencyChartProps {
  data: FrequencyEntry[];
}

const BAR_COLORS = ["bg-primary", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

export function TrainingFrequencyChart({ data }: TrainingFrequencyChartProps) {
  const max = Math.max(...data.map((d) => d.count), 1);

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No workouts in the last 30 days.</p>;
  }

  return (
    <div>
      <p className="mb-4 text-xs text-muted-foreground">Last 30 days</p>
      <div className="flex flex-col gap-3.5">
        {data.map(({ targetArea, count }, i) => {
          const widthPct = Math.round((count / max) * 100);
          const color = BAR_COLORS[i % BAR_COLORS.length];
          const prompt = encodeURIComponent(`Program a ${targetArea.toLowerCase()} workout for me`);
          return (
            <Link
              key={targetArea}
              href={`/chat?prompt=${prompt}`}
              className="group -mx-1 flex cursor-pointer flex-col gap-1.5 rounded-lg px-1 py-1 transition-colors duration-150 hover:bg-muted/40"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-150">
                  {targetArea}
                </span>
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
            </Link>
          );
        })}
      </div>

      <Link
        href="/stats"
        className="mt-4 block text-xs text-muted-foreground/80 transition-colors duration-200 hover:text-foreground"
      >
        View all workouts &rarr;
      </Link>
    </div>
  );
}
