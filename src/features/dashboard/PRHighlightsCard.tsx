"use client";

import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import type { RecentPRSummary } from "../../../convex/prs";

const RECENT_PR_DISPLAY_LIMIT = 3;

interface PRHighlightsCardProps {
  summary: RecentPRSummary;
}

export function PRHighlightsCard({ summary }: PRHighlightsCardProps) {
  if (summary.totalMovementsTracked === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No exercise data yet. Complete a workout to start tracking PRs.
      </p>
    );
  }

  const hasPRs = summary.recentPRs.length > 0;
  const displayPRs = summary.recentPRs.slice(0, RECENT_PR_DISPLAY_LIMIT);

  return (
    <div className="flex flex-col gap-3">
      {hasPRs ? (
        <div className="flex flex-col gap-2">
          {displayPRs.map((pr) => (
            <div
              key={pr.movementId}
              className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="size-3.5 text-chart-2" />
                <span className="text-sm font-medium text-foreground">{pr.movementName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                <span>{pr.newWeightLbs} lbs</span>
                <span className="text-chart-2">+{pr.improvementPct}%</span>
              </div>
            </div>
          ))}
          {summary.recentPRs.length > RECENT_PR_DISPLAY_LIMIT && (
            <p className="text-[11px] text-muted-foreground/60">
              +{summary.recentPRs.length - RECENT_PR_DISPLAY_LIMIT} more
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No new PRs — {summary.totalMovementsTracked} movements tracked.
        </p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
        {summary.steadyCount > 0 && <span>{summary.steadyCount} steady</span>}
        {summary.plateauCount > 0 && <span>{summary.plateauCount} plateaued</span>}
        {summary.regressionCount > 0 && <span>{summary.regressionCount} regressed</span>}
      </div>

      <Link
        href="/prs"
        className="mt-1 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        View all records <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
