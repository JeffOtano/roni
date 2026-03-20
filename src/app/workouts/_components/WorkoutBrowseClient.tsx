"use client";

import { useSearchParams } from "next/navigation";
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

  const filtered = workouts.filter((w) => {
    if (goal && w.goal !== goal) return false;
    if (sessionType && w.sessionType !== sessionType) return false;
    if (duration && String(w.durationMinutes) !== duration) return false;
    if (level && w.level !== level) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Workout Library
        </h1>
        <p className="mt-2 text-muted-foreground">
          Expert-designed Tonal workouts for every goal, muscle group, and experience level.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8">
        <WorkoutFilters />
      </div>

      {/* Result count */}
      <p className="mb-6 text-sm text-muted-foreground">
        {filtered.length} workout{filtered.length !== 1 ? "s" : ""}
        {goal || sessionType || duration || level ? " matching filters" : ""}
      </p>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((workout) => (
            <WorkoutLibraryCard key={workout.slug} workout={workout} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <p className="text-muted-foreground">No workouts match the selected filters.</p>
          <button
            onClick={() => {
              window.location.href = "/workouts";
            }}
            className="mt-4 text-sm text-primary underline-offset-2 hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
