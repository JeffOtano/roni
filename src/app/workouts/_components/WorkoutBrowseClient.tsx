"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { usePaginatedQuery } from "convex/react";
import { Loader2, SearchX } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { WorkoutFilters } from "./WorkoutFilters";
import { type WorkoutCardData, WorkoutLibraryCard } from "./WorkoutLibraryCard";

const PAGE_SIZE = 24;

/** Deterministic shuffle based on slug to avoid layout shift between renders. */
function shuffleBySlug(workouts: WorkoutCardData[]): WorkoutCardData[] {
  return [...workouts].sort((a, b) => {
    const hashA = a.slug.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    const hashB = b.slug.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    return hashA - hashB;
  });
}

interface Props {
  initialWorkouts: WorkoutCardData[];
}

export function WorkoutBrowseClient({ initialWorkouts }: Props) {
  const searchParams = useSearchParams();

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
    { initialNumItems: PAGE_SIZE },
  );

  // Use server-rendered data while the client query loads (preserves SEO).
  // Once the client query has results, it takes over for interactivity.
  const isClientReady = status !== "LoadingFirstPage";
  const rawWorkouts = isClientReady ? results : initialWorkouts;

  // Shuffle unfiltered results so the default view shows variety (not all Push first).
  // Uses a deterministic hash so order is stable across re-renders.
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
          Expert-designed workouts for every goal, muscle group, and experience level. Open any
          workout directly in your Tonal app.
        </p>
      </header>

      {/* Filters */}
      <div className="mb-8">
        <WorkoutFilters />
      </div>

      {/* Results bar */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm font-medium tabular-nums text-foreground">{workouts.length}</span>
        <span className="text-sm text-muted-foreground">
          workout{workouts.length !== 1 ? "s" : ""}
          {hasFilters ? " matching filters" : " loaded"}
          {isClientReady && status === "CanLoadMore" ? " so far" : ""}
        </span>
      </div>

      {/* Grid */}
      {workouts.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {workouts.map((workout) => (
              <WorkoutLibraryCard key={workout.slug} workout={workout} />
            ))}
          </div>

          {/* Pagination footer */}
          {isClientReady && (
            <div className="mt-10 flex justify-center">
              {status === "CanLoadMore" && (
                <button
                  onClick={() => loadMore(PAGE_SIZE)}
                  className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  Load more workouts
                </button>
              )}
              {status === "LoadingMore" && (
                <div
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  role="status"
                >
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>Loading more workouts...</span>
                </div>
              )}
              {status === "Exhausted" && results.length > PAGE_SIZE && (
                <p className="text-sm text-muted-foreground">All workouts loaded</p>
              )}
            </div>
          )}
        </>
      ) : (
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
      )}
    </div>
  );
}
