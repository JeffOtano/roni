"use client";

import { cn } from "@/lib/utils";

function scoreColor(score: number, maxScore: number): string {
  const pct = score / maxScore;
  if (pct >= 0.7) return "text-primary";
  if (pct >= 0.4) return "text-chart-5";
  return "text-chart-4";
}

export function ProgressRing({
  score,
  maxScore = 500,
  size = 80,
  strokeWidth = 6,
  label,
  glow,
}: {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
  label: string;
  glow?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / maxScore, 1);
  const offset = circumference * (1 - progress);
  const color = scoreColor(score, maxScore);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-border"
          />
          {/* Active arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn(color, "transition-all duration-700")}
          />
        </svg>
        {/* Score number overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "font-bold tabular-nums text-foreground",
              size >= 96 ? "text-2xl" : "text-lg",
            )}
          >
            {score}
          </span>
        </div>
        {/* Optional glow effect for the Overall ring */}
        {glow && (
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              boxShadow:
                "0 0 20px oklch(0.78 0.154 195 / 0.15), 0 0 40px oklch(0.78 0.154 195 / 0.05)",
            }}
          />
        )}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
