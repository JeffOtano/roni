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

const CHART_PADDING = { top: 20, right: 16, bottom: 40, left: 44 };
const CHART_HEIGHT = 280;

function formatChartDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface LineChartProps {
  history: StrengthScoreHistoryEntry[];
}

function StrengthLineChart({ history }: LineChartProps) {
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

  // Compute bounds
  const allScores = sorted.flatMap((e) => [e.overall, e.upper, e.lower, e.core]);
  const minScore = Math.max(0, Math.min(...allScores) - 10);
  const maxScore = Math.max(...allScores) + 10;
  const scoreRange = maxScore - minScore || 1;

  const drawW = 100 - CHART_PADDING.left - CHART_PADDING.right;
  const drawH = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  function toX(index: number): number {
    return CHART_PADDING.left + (index / (sorted.length - 1)) * drawW;
  }

  function toY(score: number): number {
    return CHART_PADDING.top + drawH - ((score - minScore) / scoreRange) * drawH;
  }

  function buildPath(key: "overall" | "upper" | "lower" | "core"): string {
    return sorted
      .map((entry, i) => {
        const x = toX(i);
        const y = toY(entry[key]);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }

  // Y-axis labels
  const ySteps = 5;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) =>
    Math.round(minScore + (scoreRange / ySteps) * i),
  );

  // X-axis labels (show max ~6)
  const xStep = Math.max(1, Math.floor(sorted.length / 6));
  const xLabels = sorted.filter((_, i) => i % xStep === 0 || i === sorted.length - 1);

  const lines: Array<{ key: "overall" | "upper" | "lower" | "core"; label: string }> = [
    { key: "overall", label: "Overall" },
    { key: "upper", label: "Upper" },
    { key: "lower", label: "Lower" },
    { key: "core", label: "Core" },
  ];

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height: CHART_HEIGHT }}
      >
        {/* Grid lines */}
        {yLabels.map((val) => (
          <line
            key={val}
            x1={CHART_PADDING.left}
            x2={100 - CHART_PADDING.right}
            y1={toY(val)}
            y2={toY(val)}
            stroke="currentColor"
            strokeWidth={0.15}
            className="text-white/8"
          />
        ))}

        {/* Y-axis labels */}
        {yLabels.map((val) => (
          <text
            key={`y-${val}`}
            x={CHART_PADDING.left - 3}
            y={toY(val)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            fontSize={3}
          >
            {val}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((entry, i) => {
          const idx = sorted.indexOf(entry);
          return (
            <text
              key={`x-${i}`}
              x={toX(idx)}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={2.8}
            >
              {formatChartDate(entry.activityTime)}
            </text>
          );
        })}

        {/* Lines */}
        {lines.map(({ key }) => (
          <path
            key={key}
            d={buildPath(key)}
            fill="none"
            stroke={CHART_COLORS[key]}
            strokeWidth={0.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        {lines.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="h-0.5 w-4 rounded-full"
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
          const scoreMap: Record<string, number> = {};
          for (const s of d.scores) {
            scoreMap[s.strengthBodyRegion?.toLowerCase() ?? s.bodyRegionDisplay?.toLowerCase()] =
              s.score;
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
                    score={scoreMap[region] ?? 0}
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
    </div>
  );
}
