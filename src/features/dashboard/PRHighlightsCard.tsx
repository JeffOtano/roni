"use client";

import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import type { RecentPRSummary } from "../../../convex/prs";

/** Recent PRs listed underneath the hero, not counting the hero itself. */
const REST_DISPLAY_LIMIT = 3;

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

  if (summary.recentPRs.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          No new PRs yet — {summary.totalMovementsTracked} movements tracked.
        </p>
        <TrendLegend summary={summary} />
        <ViewAllCta totalMovements={summary.totalMovementsTracked} />
      </div>
    );
  }

  // Lead with the biggest weight in the recent-PR window — the most
  // motivational moment — and list the rest underneath.
  const sorted = [...summary.recentPRs].sort((a, b) => b.newWeightLbs - a.newWeightLbs);
  const [hero, ...rest] = sorted;
  const shownRest = rest.slice(0, REST_DISPLAY_LIMIT);
  const hiddenCount = rest.length - shownRest.length;

  return (
    <div className="flex flex-col gap-4">
      <HeroPR pr={hero} />

      {shownRest.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {shownRest.map((pr) => (
            <li key={pr.movementId} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate text-foreground">{pr.movementName}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {pr.newWeightLbs} lbs
              </span>
              <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-chart-2">
                +{pr.improvementPct}%
              </span>
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className="text-2xs text-muted-foreground/60">
              +{hiddenCount} more new PR{hiddenCount === 1 ? "" : "s"}
            </li>
          )}
        </ul>
      )}

      <TrendLegend summary={summary} />
      <ViewAllCta totalMovements={summary.totalMovementsTracked} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents (local — only used here)
// ---------------------------------------------------------------------------

function HeroPR({ pr }: { pr: RecentPRSummary["recentPRs"][number] }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-chart-5/25 bg-gradient-to-br from-chart-5/15 via-chart-5/5 to-transparent px-4 py-3.5">
      {/* Subtle radial glow behind the trophy */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-chart-5/25 blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Trophy className="size-3.5 text-chart-5" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-chart-5">
              Top recent PR
            </span>
          </div>
          <p className="mt-1.5 truncate text-sm font-medium text-foreground">{pr.movementName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end leading-tight">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {pr.newWeightLbs}
            <span className="ml-1 text-xs font-normal text-muted-foreground">lbs</span>
          </span>
          <span className="text-xs font-semibold tabular-nums text-chart-2">
            +{pr.improvementPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

function TrendLegend({ summary }: { summary: RecentPRSummary }) {
  const hasAny = summary.steadyCount > 0 || summary.plateauCount > 0 || summary.regressionCount > 0;
  if (!hasAny) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground/70">
      {summary.steadyCount > 0 && <span>{summary.steadyCount} steady</span>}
      {summary.plateauCount > 0 && <span>{summary.plateauCount} plateaued</span>}
      {summary.regressionCount > 0 && <span>{summary.regressionCount} regressed</span>}
    </div>
  );
}

function ViewAllCta({ totalMovements }: { totalMovements: number }) {
  return (
    <Link
      href="/prs"
      className="group inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 hover:border-chart-5/35 hover:bg-chart-5/5 hover:text-chart-5"
    >
      View all {totalMovements} record{totalMovements === 1 ? "" : "s"}
      <ArrowRight className="size-3 transition-transform duration-150 group-hover:translate-x-0.5" />
    </Link>
  );
}
