"use client";

import Link from "next/link";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type {
  StrengthDistribution,
  StrengthScore,
  StrengthScoreHistoryEntry,
} from "../../../../convex/tonal/types";
import { useActionData } from "@/hooks/useActionData";
import { AsyncCard } from "@/components/AsyncCard";
import { ProgressRing } from "@/components/ProgressRing";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

// ---------------------------------------------------------------------------
// SVG Line Chart
// ---------------------------------------------------------------------------

const CHART_COLORS = {
  overall: "oklch(0.78 0.154 195)",
  upper: "oklch(0.65 0.19 265)",
  lower: "oklch(0.6 0.22 300)",
  core: "oklch(0.8 0.16 85)",
} as const;

const VB_W = 800;
const VB_H = 300;
const PAD = { top: 24, right: 24, bottom: 44, left: 52 };

function formatChartDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const LINES: Array<{ key: "overall" | "upper" | "lower" | "core"; label: string }> = [
  { key: "overall", label: "Overall" },
  { key: "upper", label: "Upper" },
  { key: "lower", label: "Lower" },
  { key: "core", label: "Core" },
];

function StrengthLineChart({ history }: { history: StrengthScoreHistoryEntry[] }) {
  if (history.length < 2) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Not enough data to chart. Keep training!
      </p>
    );
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.activityTime).getTime() - new Date(b.activityTime).getTime(),
  );

  const allScores = sorted.flatMap((e) => [e.overall, e.upper, e.lower, e.core]);
  const minScore = Math.max(0, Math.min(...allScores) - 10);
  const maxScore = Math.max(...allScores) + 10;
  const range = maxScore - minScore || 1;
  const drawW = VB_W - PAD.left - PAD.right;
  const drawH = VB_H - PAD.top - PAD.bottom;

  const toX = (i: number) => PAD.left + (i / (sorted.length - 1)) * drawW;
  const toY = (s: number) => PAD.top + drawH - ((s - minScore) / range) * drawH;

  const buildPath = (key: "overall" | "upper" | "lower" | "core") =>
    sorted.map((e, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(e[key])}`).join(" ");

  const ySteps = 5;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) =>
    Math.round(minScore + (range / ySteps) * i),
  );
  const xStep = Math.max(1, Math.floor(sorted.length / 6));
  const xIndices = sorted
    .map((_, i) => i)
    .filter((i) => i % xStep === 0 || i === sorted.length - 1);

  return (
    <div>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" style={{ maxHeight: 340 }}>
        {yLabels.map((val) => (
          <line
            key={val}
            x1={PAD.left}
            x2={VB_W - PAD.right}
            y1={toY(val)}
            y2={toY(val)}
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-white/8"
          />
        ))}
        {yLabels.map((val) => (
          <text
            key={`y-${val}`}
            x={PAD.left - 8}
            y={toY(val)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            fontSize={11}
          >
            {val}
          </text>
        ))}
        {xIndices.map((idx) => (
          <text
            key={`x-${idx}`}
            x={toX(idx)}
            y={VB_H - 10}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={11}
          >
            {formatChartDate(sorted[idx].activityTime)}
          </text>
        ))}
        {LINES.map(({ key }) => (
          <path
            key={key}
            d={buildPath(key)}
            fill="none"
            stroke={CHART_COLORS[key]}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>

      <div className="mt-4 flex flex-wrap justify-center gap-5">
        {LINES.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <div
              className="h-0.5 w-5 rounded-full"
              style={{ backgroundColor: CHART_COLORS[key] }}
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StrengthPage() {
  const strengthHistory = useActionData<StrengthScoreHistoryEntry[]>(
    useAction(api.stats.getStrengthHistory),
  );
  const currentStrength = useActionData<{
    scores: StrengthScore[];
    distribution: StrengthDistribution;
  }>(useAction(api.dashboard.getStrengthData));

  const chatPrompt = encodeURIComponent("How are my strength scores trending over time?");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6 lg:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Strength History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track how your strength scores evolve over time.
          </p>
        </div>
        <Link href={`/chat?prompt=${chatPrompt}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="size-4" />
            Ask coach about trends
          </Button>
        </Link>
      </div>

      {/* Current scores */}
      <AsyncCard
        state={currentStrength.state}
        refetch={currentStrength.refetch}
        lastUpdatedAt={currentStrength.lastUpdatedAt}
        title="Current Scores"
      >
        {(d) => {
          function findScore(region: string): number {
            const r = region.toLowerCase();
            const match = d.scores.find((s) => {
              const key = (s.strengthBodyRegion ?? s.bodyRegionDisplay ?? "").toLowerCase();
              return key === r || key.startsWith(r) || key.includes(r);
            });
            return match?.score ?? 0;
          }

          return (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex flex-col items-center">
                <ProgressRing
                  score={d.distribution.overallScore}
                  label="Overall"
                  size={96}
                  strokeWidth={8}
                  glow
                />
              </div>
              {(["upper", "lower", "core"] as const).map((region) => (
                <div key={region} className="flex flex-col items-center">
                  <ProgressRing
                    score={findScore(region)}
                    label={region.charAt(0).toUpperCase() + region.slice(1)}
                  />
                </div>
              ))}
            </div>
          );
        }}
      </AsyncCard>

      {/* History chart */}
      <div className="mt-5">
        <AsyncCard
          state={strengthHistory.state}
          refetch={strengthHistory.refetch}
          lastUpdatedAt={strengthHistory.lastUpdatedAt}
          title="Score Trends"
          tall
        >
          {(d) => <StrengthLineChart history={d} />}
        </AsyncCard>
      </div>

      {/* Action links */}
      <div className="mt-8 flex flex-wrap gap-2">
        {(currentStrength.state.status === "success" ||
          currentStrength.state.status === "refreshing") &&
          (() => {
            const d = currentStrength.state.data;
            const regions = (["upper", "lower", "core"] as const).map((r) => {
              const match = d.scores.find((s) => {
                const key = (s.strengthBodyRegion ?? s.bodyRegionDisplay ?? "").toLowerCase();
                return key === r || key.startsWith(r) || key.includes(r);
              });
              return { name: r, score: match?.score ?? 0 };
            });
            const weakest = regions.reduce((a, b) => (a.score <= b.score ? a : b));
            return (
              <Link
                href={`/chat?prompt=${encodeURIComponent(`My ${weakest.name} body is my weakest area. Program a workout to improve it.`)}`}
                className="rounded-full bg-white/[0.04] px-3.5 py-1.5 text-xs text-muted-foreground ring-1 ring-white/[0.06] transition-all hover:bg-white/[0.08] hover:text-foreground"
              >
                Program for weak areas &rarr;
              </Link>
            );
          })()}
        <Link
          href="/stats"
          className="rounded-full bg-white/[0.04] px-3.5 py-1.5 text-xs text-muted-foreground ring-1 ring-white/[0.06] transition-all hover:bg-white/[0.08] hover:text-foreground"
        >
          View full stats &rarr;
        </Link>
        <Link
          href="/exercises"
          className="rounded-full bg-white/[0.04] px-3.5 py-1.5 text-xs text-muted-foreground ring-1 ring-white/[0.06] transition-all hover:bg-white/[0.08] hover:text-foreground"
        >
          Browse exercises &rarr;
        </Link>
      </div>
    </div>
  );
}
