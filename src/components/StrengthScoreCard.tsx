"use client";

import Link from "next/link";
import type { StrengthDistribution, StrengthScore } from "../../convex/tonal/types";
import { ProgressRing } from "@/components/ProgressRing";

interface StrengthScoreCardProps {
  scores: StrengthScore[];
  distribution: StrengthDistribution;
}

export function StrengthScoreCard({ scores, distribution }: StrengthScoreCardProps) {
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
        <div className="relative flex flex-col items-center">
          <ProgressRing
            score={distribution.overallScore}
            label="Overall"
            size={88}
            strokeWidth={7}
          />
        </div>

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
