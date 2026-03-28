"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { usePaginatedQuery } from "convex/react";
import { Loader2, SearchX } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { WorkoutFilters } from "./WorkoutFilters";
import { type WorkoutCardData, WorkoutLibraryCard } from "./WorkoutLibraryCard";
import { SessionTypeChips } from "./SessionTypeChips";
import { ActiveFilterPills } from "./ActiveFilterPills";
import { CuratedSection } from "./CuratedSection";

const PAGE_SIZE = 24;
const CURATED_PAGE_SIZE = 48;

function shuffleBySlug(workouts: WorkoutCardData[]): WorkoutCardData[] {
  return [...workouts].sort((a, b) => {
    const hashA = a.slug.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    const hashB = b.slug.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    return hashA - hashB;
  });
}

const CURATED_SECTIONS = [
  {
    title: "Quick Workouts",
    subtitle: "30 minutes or less",
    seeAllHref: "/workouts?duration=30",
    filter: (w: WorkoutCardData) => w.durationMinutes <= 30,
  },
  {
    title: "Build Muscle",
    subtitle: "Hypertrophy-focused training",
    seeAllHref: "/workouts?goal=build_muscle",
    filter: (w: WorkoutCardData) => w.goal === "build_muscle",
  },
  {
    title: "Beginner Friendly",
    subtitle: "Great starting points",
    seeAllHref: "/workouts?level=beginner",
    filter: (w: WorkoutCardData) => w.level === "beginner",
  },
  {
    title: "Full Body Sessions",
    subtitle: "Hit every muscle group",
    seeAllHref: "/workouts?sessionType=full_body",
    filter: (w: WorkoutCardData) => w.sessionType === "full_body",
  },
  {
    title: "Get Stronger",
    subtitle: "Heavy compounds, low reps",
    seeAllHref: "/workouts?goal=strength",
    filter: (w: WorkoutCardData) => w.goal === "strength",
  },
] as const;

interface Props {
  initialWorkouts: WorkoutCardData[];
}

export function WorkoutBrowseClient({ initialWorkouts }: Props) {
  const searchParams = useSearchParams();
  const hasAutoLoaded = useRef(false);

  const goal = searchParams.get("goal");
  const sessionType = searchParams.get("sessionType");
  const duration = searchParams.get("duration");
  const level = searchParams.get("level");

  const hasFilters = !!(goal || sessionType || duration || level);

  const { results, status, loadMore } = usePaginatedQuery(
    api.libraryWorkouts.listFiltered,
    {
      goal: goal ?? undefined,
      sessionType: sessionType ?? undefined,
      durationMinutes: duration ? Number(duration) : undefined,
      level: level ?? undefined,
    },
    { initialNumItems: hasFilters ? PAGE_SIZE : CURATED_PAGE_SIZE },
  );

  // Auto-load more data for curated sections (once)
  useEffect(() => {
    if (!hasFilters && status === "CanLoadMore" && !hasAutoLoaded.current) {
      hasAutoLoaded.current = true;
      loadMore(CURATED_PAGE_SIZE);
    }
  }, [hasFilters, status, loadMore]);

  const isClientReady = status !== "LoadingFirstPage";
  const rawWorkouts = isClientReady ? results : initialWorkouts;

  const workouts = useMemo(
    () => (hasFilters ? rawWorkouts : shuffleBySlug(rawWorkouts)),
    [rawWorkouts, hasFilters],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
      {/* Hero header */}
      <header className="mb-10">
        <h1
          className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          style={{
            background: "linear-gradient(135deg, var(--foreground) 40%, var(--primary))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Workout Library
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {hasFilters
            ? "Filtered results below. Use the chips and dropdowns to refine."
            : "Expert-designed workouts for every goal, muscle group, and experience level. Open any workout directly in your Tonal app."}
        </p>
      </header>

      {/* Body part chips (always visible) */}
      <div className="mb-6">
        <SessionTypeChips />
      </div>

      {hasFilters ? (
        /* ---- FILTERED VIEW ---- */
        <>
          <div className="mb-4">
            <WorkoutFilters />
          </div>
          <ActiveFilterPills />

          <div className="mb-6 mt-4 flex items-center gap-3">
            <span className="text-sm font-medium tabular-nums text-foreground">
              {workouts.length}
            </span>
            <span className="text-sm text-muted-foreground">
              workout{workouts.length !== 1 ? "s" : ""} matching filters
              {isClientReady && status === "CanLoadMore" ? " so far" : ""}
            </span>
          </div>

          {workouts.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {workouts.map((workout) => (
                  <WorkoutLibraryCard key={workout.slug} workout={workout} />
                ))}
              </div>
              <PaginationFooter
                status={status}
                isClientReady={isClientReady}
                resultCount={results.length}
                onLoadMore={() => loadMore(PAGE_SIZE)}
              />
            </>
          ) : (
            <EmptyState />
          )}
        </>
      ) : (
        /* ---- CURATED VIEW ---- */
        <>
          {CURATED_SECTIONS.map((section) => {
            // Prefer diversity (max 2 per session type) but fill remaining
            // slots from overflow so sections still render when the initial
            // page skews toward one session type.
            const matched = workouts.filter(section.filter);
            const counts = new Map<string, number>();
            const preferred: WorkoutCardData[] = [];
            const rest: WorkoutCardData[] = [];
            for (const w of matched) {
              const n = counts.get(w.sessionType) ?? 0;
              if (n < 2) {
                preferred.push(w);
                counts.set(w.sessionType, n + 1);
              } else {
                rest.push(w);
              }
            }
            const filtered = [...preferred, ...rest].slice(0, 8);
            return (
              <CuratedSection
                key={section.title}
                title={section.title}
                subtitle={section.subtitle}
                seeAllHref={section.seeAllHref}
                workouts={filtered}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

function PaginationFooter({
  status,
  isClientReady,
  resultCount,
  onLoadMore,
}: {
  status: string;
  isClientReady: boolean;
  resultCount: number;
  onLoadMore: () => void;
}) {
  if (!isClientReady) return null;
  return (
    <div className="mt-10 flex justify-center">
      {status === "CanLoadMore" && (
        <button
          onClick={onLoadMore}
          className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Load more workouts
        </button>
      )}
      {status === "LoadingMore" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>Loading more workouts...</span>
        </div>
      )}
      {status === "Exhausted" && resultCount > PAGE_SIZE && (
        <p className="text-sm text-muted-foreground">All workouts loaded</p>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
        <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-base font-medium text-foreground">No workouts match these filters</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Try broadening your search by removing a filter, or clear them all to see every workout.
      </p>
      <button
        onClick={() => {
          window.location.href = "/workouts";
        }}
        className="mt-6 inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        Clear all filters
      </button>
    </div>
  );
}
