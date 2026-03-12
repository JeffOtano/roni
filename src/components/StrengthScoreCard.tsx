"use client";

import Link from "next/link";
import type { StrengthDistribution, StrengthScore } from "../../convex/tonal/types";

// ---------------------------------------------------------------------------
// SVG radial progress ring
// ---------------------------------------------------------------------------

function ProgressRing({
  score,
  maxScore = 500,
  size = 80,
  strokeWidth = 6,
  label,
}: {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
  label: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / maxScore, 1);
  const offset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        {/* Progress ring */}
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
          className="text-chart-1 transition-all duration-700"
        />
      </svg>
      {/* Score number overlay */}
      <div
        className="absolute flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-lg font-bold text-foreground">{score}</span>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StrengthScoreCard
// ---------------------------------------------------------------------------

interface StrengthScoreCardProps {
  scores: StrengthScore[];
  distribution: StrengthDistribution;
}

export function StrengthScoreCard({ scores, distribution }: StrengthScoreCardProps) {
  // Map scores by body region for easy lookup
  const scoreMap: Record<string, number> = {};
  for (const s of scores) {
    scoreMap[s.strengthBodyRegion?.toLowerCase() ?? s.bodyRegionDisplay?.toLowerCase()] = s.score;
  }

  const regions = [
    { key: "upper", label: "Upper" },
    { key: "lower", label: "Lower" },
    { key: "core", label: "Core" },
  ];

  const percentile = distribution.percentile;
  const percentileLabel =
    percentile <= 50 ? `Top ${100 - percentile}%` : `Top ${100 - percentile}%`;

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md hover:shadow-black/10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Strength Scores
        </h2>
        <span className="rounded-full bg-chart-1/15 px-2.5 py-0.5 text-xs font-medium text-chart-1">
          {percentileLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* Overall — slightly larger */}
        <div className="relative flex flex-col items-center">
          <ProgressRing
            score={distribution.overallScore}
            label="Overall"
            size={88}
            strokeWidth={7}
          />
        </div>

        {/* Regional scores */}
        {regions.map(({ key, label }) => (
          <div key={key} className="relative flex flex-col items-center">
            <ProgressRing score={scoreMap[key] ?? 0} label={label} />
          </div>
        ))}
      </div>

      <Link
        href={`/chat?prompt=${encodeURIComponent("Tell me about my strength score trends")}`}
        className="mt-3 block text-xs text-primary hover:underline"
      >
        Ask coach about your strength trends &rarr;
      </Link>
    </div>
  );
}
