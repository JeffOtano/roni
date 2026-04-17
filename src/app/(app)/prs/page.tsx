"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { usePageView } from "@/lib/analytics";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AllTimePREntry, RecentPRSummary } from "../../../../convex/prs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  // Date strings are YYYY-MM-DD. Parse with T12:00 to avoid timezone-shift issues
  // where UTC midnight rolls back to the previous day in western timezones.
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Filter pill
// ---------------------------------------------------------------------------

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200",
        active
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "bg-muted/60 text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Recent PR row
// ---------------------------------------------------------------------------

function RecentPRRow({ pr }: { pr: RecentPRSummary["recentPRs"][number] }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4 text-chart-2" />
        <span className="text-sm font-semibold text-foreground">{pr.movementName}</span>
      </div>
      <div className="flex items-center gap-3 text-xs tabular-nums">
        <span className="text-muted-foreground">
          {pr.previousBestLbs} → {pr.newWeightLbs} lbs
        </span>
        <span className="font-medium text-chart-2">+{pr.improvementPct}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// All-time PR row
// ---------------------------------------------------------------------------

function AllTimePRRow({ entry }: { entry: AllTimePREntry }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-semibold text-foreground">{entry.movementName}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.muscleGroups.map((g) => (
            <Badge key={g} variant="secondary" className="text-[10px]">
              {g}
            </Badge>
          ))}
          <span className="text-[10px] text-muted-foreground/60">
            {entry.totalSessions} session{entry.totalSessions !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-sm font-bold tabular-nums text-foreground">
          {entry.bestWeightLbs} lbs
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          {formatDate(entry.achievedDate)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PRPageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6 lg:py-10">
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-8 h-4 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PRsPage() {
  usePageView("prs_viewed");

  const allTimePRs = useQuery(api.prs.getAllTimePRs);
  const recentSummary = useQuery(api.prs.getRecentPRSummary);
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);

  if (allTimePRs === undefined || recentSummary === undefined) {
    return <PRPageSkeleton />;
  }

  // Derive available muscle groups from data
  const muscleGroups = [...new Set(allTimePRs.flatMap((p) => p.muscleGroups))].sort();

  const filteredPRs = muscleFilter
    ? allTimePRs.filter((p) => p.muscleGroups.includes(muscleFilter))
    : allTimePRs;

  const chatPrompt = encodeURIComponent(
    "Tell me about my personal records and what I should focus on next",
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Personal Records</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your best lifts and recent breakthroughs.
        </p>
      </div>

      {allTimePRs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="mx-auto mb-3 size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No exercise data yet. Complete a workout to start tracking your records.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Recent PRs */}
          {recentSummary.recentPRs.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>
                  <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    Recent PRs
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {recentSummary.recentPRs.map((pr) => (
                  <RecentPRRow key={pr.movementId} pr={pr} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Summary stats */}
          <div className="mb-6 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {recentSummary.recentPRs.length > 0 && (
              <span className="flex items-center gap-1">
                <TrendingUp className="size-3 text-chart-2" />
                {recentSummary.recentPRs.length} PR{recentSummary.recentPRs.length !== 1 ? "s" : ""}
              </span>
            )}
            {recentSummary.steadyCount > 0 && <span>{recentSummary.steadyCount} progressing</span>}
            {recentSummary.plateauCount > 0 && <span>{recentSummary.plateauCount} plateaued</span>}
            {recentSummary.regressionCount > 0 && (
              <span className="flex items-center gap-1">
                <TrendingDown className="size-3 text-destructive" />
                {recentSummary.regressionCount} regressed
              </span>
            )}
          </div>

          {/* Muscle group filter */}
          {muscleGroups.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2">
              <FilterPill
                label="All"
                active={muscleFilter === null}
                onClick={() => setMuscleFilter(null)}
              />
              {muscleGroups.map((g) => (
                <FilterPill
                  key={g}
                  label={g}
                  active={muscleFilter === g}
                  onClick={() => setMuscleFilter(g)}
                />
              ))}
            </div>
          )}

          {/* All-time records */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  All-Time Records
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {filteredPRs.length > 0 ? (
                filteredPRs.map((entry) => <AllTimePRRow key={entry.movementId} entry={entry} />)
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No records for this muscle group.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Coach CTA */}
          <div className="mt-6">
            <Link
              href={`/chat?prompt=${chatPrompt}`}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <MessageSquare className="size-4" />
              Ask coach about your progress
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
