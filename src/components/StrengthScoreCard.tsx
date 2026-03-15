"use client";

import Link from "next/link";
import type { StrengthDistribution, StrengthScore } from "../../convex/tonal/types";
import { ProgressRing } from "@/components/ProgressRing";

interface StrengthScoreCardProps {
  scores: StrengthScore[];
  distribution: StrengthDistribution;
}

export function StrengthScoreCard({ scores, distribution }: StrengthScoreCardProps) {
  function findScore(region: string): number {
    const r = region.toLowerCase();
    const match = scores.find((s) => {
      const key = (s.strengthBodyRegion || s.bodyRegionDisplay || "").toLowerCase();
      return key === r || key.startsWith(r) || key.includes(r);
    });
    return match?.score ?? 0;
  }

  const regions = [
    { key: "upper", label: "Upper" },
    { key: "lower", label: "Lower" },
    { key: "core", label: "Core" },
  ];

  const percentile = distribution.percentile;
  const percentileLabel = `Top ${100 - percentile}%`;

  return (
    <div>
      {/* Percentile badge */}
      <div className="mb-4 flex justify-end">
        <span className="rounded-full bg-gradient-to-r from-primary/20 to-chart-2/20 px-3 py-0.5 text-xs font-semibold text-primary ring-1 ring-primary/20">
          {percentileLabel}
        </span>
      </div>

      {/* Rings grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col items-center">
          <ProgressRing
            score={distribution.overallScore}
            label="Overall"
            size={96}
            strokeWidth={8}
            glow
          />
        </div>

        {regions.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center">
            <ProgressRing score={findScore(key)} label={label} />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Link
          href={`/chat?prompt=${encodeURIComponent("Tell me about my strength score trends")}`}
          className="text-xs text-primary/80 transition-colors duration-200 hover:text-primary"
        >
          Ask coach about trends &rarr;
        </Link>
        <Link
          href="/strength"
          className="text-xs text-primary/80 transition-colors duration-200 hover:text-primary"
        >
          View strength history &rarr;
        </Link>
      </div>
    </div>
  );
}
