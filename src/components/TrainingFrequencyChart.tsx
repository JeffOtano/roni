"use client";

import { useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// TrainingFrequencyChart — horizontal bar chart (pure CSS)
// ---------------------------------------------------------------------------

interface FrequencyEntry {
  targetArea: string;
  count: number;
  lastTrainedDate?: string;
}

interface TrainingFrequencyChartProps {
  data: FrequencyEntry[];
}

const BAR_COLORS = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

function StaleCta({ data }: { data: FrequencyEntry[] }) {
  const [now] = useState(() => Date.now());
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const stale = data.find(
    (d) => d.lastTrainedDate && new Date(d.lastTrainedDate).getTime() < sevenDaysAgo,
  );
  if (!stale) return null;
  const days = Math.round(
    (now - new Date(stale.lastTrainedDate!).getTime()) / (1000 * 60 * 60 * 24),
  );
  const prompt = encodeURIComponent(
    `I haven't trained ${stale.targetArea.toLowerCase()} in ${days} days. Can you suggest a workout?`,
  );
  return (
    <Link
      href={`/chat?prompt=${prompt}`}
      className="mt-3 block text-xs text-primary hover:underline"
    >
      You haven&apos;t hit {stale.targetArea.toLowerCase()} in {days} days — ask coach &rarr;
    </Link>
  );
}

export function TrainingFrequencyChart({ data }: TrainingFrequencyChartProps) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md hover:shadow-black/10">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Training Frequency
        <span className="ml-2 text-xs font-normal normal-case">(last 30 days)</span>
      </h2>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workouts in the last 30 days.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map(({ targetArea, count }, i) => {
            const widthPct = Math.round((count / max) * 100);
            const color = BAR_COLORS[i % BAR_COLORS.length];
            return (
              <div key={targetArea} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{targetArea}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {count} {count === 1 ? "workout" : "workouts"}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${color}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StaleCta data={data} />
    </div>
  );
}
