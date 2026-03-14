"use client";

import { StaleCta } from "@/components/StaleCta";

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
          return (
            <div key={targetArea} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{targetArea}</span>
                <span className="tabular-nums text-muted-foreground">
                  {count} {count === 1 ? "workout" : "workouts"}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/[0.04]">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <StaleCta data={data} />
    </div>
  );
}
