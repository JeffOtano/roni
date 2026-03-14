"use client";

import Link from "next/link";
import type { StrengthDistribution, StrengthScore } from "../../../convex/tonal/types";
import { ProgressRing } from "@/components/ProgressRing";

const REGIONS = ["upper", "lower", "core"] as const;

function findScore(scores: readonly StrengthScore[], region: string): number {
  const r = region.toLowerCase();
  const match = scores.find((s) => {
    const key = (s.strengthBodyRegion ?? s.bodyRegionDisplay ?? "").toLowerCase();
    return key === r || key.startsWith(r) || key.includes(r);
  });
  return match?.score ?? 0;
}

interface StrengthOverviewProps {
  readonly scores: readonly StrengthScore[];
  readonly distribution: StrengthDistribution;
}

export function StrengthOverview({ scores, distribution }: StrengthOverviewProps) {
  return (
    <div>
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
        {REGIONS.map((region) => (
          <div key={region} className="flex flex-col items-center">
            <ProgressRing
              score={findScore(scores, region)}
              label={region.charAt(0).toUpperCase() + region.slice(1)}
            />
          </div>
        ))}
      </div>

      {distribution.percentile > 0 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          You rank in the{" "}
          <span className="font-semibold text-primary">
            {Math.round(distribution.percentile)}th
          </span>{" "}
          percentile
        </p>
      )}

      <div className="mt-4 flex justify-center">
        <Link
          href="/strength"
          className="text-xs font-medium text-primary/80 transition-colors hover:text-primary"
        >
          View full history &rarr;
        </Link>
      </div>
    </div>
  );
}
