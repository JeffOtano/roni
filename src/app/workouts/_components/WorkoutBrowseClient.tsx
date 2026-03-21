"use client";

import { useSearchParams } from "next/navigation";
import { SearchX } from "lucide-react";
import { WorkoutFilters } from "./WorkoutFilters";
import { type WorkoutCardData, WorkoutLibraryCard } from "./WorkoutLibraryCard";

interface Props {
  workouts: WorkoutCardData[];
}

export function WorkoutBrowseClient({ workouts }: Props) {
  const searchParams = useSearchParams();

  const goal = searchParams.get("goal");
  const sessionType = searchParams.get("sessionType");
  const duration = searchParams.get("duration");
  const level = searchParams.get("level");

  const hasFilters = !!(goal || sessionType || duration || level);

  const filtered = workouts.filter((w) => {
    if (goal && w.goal !== goal) return false;
    if (sessionType && w.sessionType !== sessionType) return false;
    if (duration && String(w.durationMinutes) !== duration) return false;
    if (level && w.level !== level) return false;
    return true;
  });

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
          {workouts.length.toLocaleString()}+ expert-designed workouts for every goal, muscle group,
          and experience level. Open any workout directly in your Tonal app.
        </p>
      </header>

      {/* Filters */}
      <div className="mb-8">
        <WorkoutFilters />
      </div>

      {/* Results bar */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm font-medium tabular-nums text-foreground">{filtered.length}</span>
        <span className="text-sm text-muted-foreground">
          workout{filtered.length !== 1 ? "s" : ""}
          {hasFilters ? " matching filters" : " available"}
        </span>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((workout) => (
            <WorkoutLibraryCard key={workout.slug} workout={workout} />
          ))}
        </div>
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
