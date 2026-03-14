"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ErrorAlert";
import { Dumbbell, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types (matches CatalogEntry from convex/workoutDetail.ts)
// ---------------------------------------------------------------------------

interface CatalogEntry {
  id: string;
  name: string;
  muscleGroups: string[];
  skillLevel: number;
  thumbnailMediaUrl: string;
  onMachine: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MUSCLE_GROUPS = [
  "Chest",
  "Back",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Abs",
  "Calves",
] as const;

const SKILL_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Intermediate",
  3: "Advanced",
};

// ---------------------------------------------------------------------------
// Exercise thumbnail
// ---------------------------------------------------------------------------

function ExerciseThumbnail({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted/50">
        <Dumbbell className="size-5 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} demonstration`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-14 shrink-0 rounded-lg bg-muted/50 object-cover"
    />
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ExerciseGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exercise card
// ---------------------------------------------------------------------------

function ExerciseCard({ movement }: { movement: CatalogEntry }) {
  const skillLabel = SKILL_LABELS[movement.skillLevel] ?? `Level ${movement.skillLevel}`;

  return (
    <Card className="transition-all duration-200 hover:scale-[1.01]">
      <CardContent className="flex gap-3.5 p-3">
        <ExerciseThumbnail src={movement.thumbnailMediaUrl} name={movement.name} />

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-tight text-foreground">{movement.name}</h3>
            {movement.onMachine && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                On-machine
              </Badge>
            )}
          </div>

          {/* Muscle groups */}
          <div className="flex flex-wrap gap-1">
            {movement.muscleGroups.map((mg) => (
              <span
                key={mg}
                className="rounded-md bg-muted/60 px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
              >
                {mg}
              </span>
            ))}
          </div>

          {/* Skill level + action */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[1, 2, 3].map((level) => (
                  <div
                    key={level}
                    className={cn(
                      "h-1.5 w-4 rounded-full",
                      level <= movement.skillLevel ? "bg-primary" : "bg-muted/60",
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{skillLabel}</span>
            </div>
            <Link
              href={`/chat?prompt=${encodeURIComponent(`Build me a workout that includes ${movement.name}`)}`}
              className="text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              Program with this &rarr;
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type FetchState =
  | { status: "loading" }
  | { status: "success"; data: CatalogEntry[] }
  | { status: "error" };

export default function ExercisesPage() {
  const getCatalog = useAction(api.workoutDetail.getExerciseCatalog);
  const searchParams = useSearchParams();

  const initialMuscleGroup = searchParams.get("muscleGroup");

  const [search, setSearch] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<string | null>(initialMuscleGroup);
  const [state, setState] = useState<FetchState>({ status: "loading" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchExercises = useCallback(
    (searchTerm: string, muscle: string | null) => {
      setState((prev) => (prev.status === "success" ? prev : { status: "loading" }));
      const args: Record<string, string | undefined> = {};
      if (searchTerm) args.search = searchTerm;
      if (muscle) args.muscleGroup = muscle;

      getCatalog(args as never).then(
        (data: CatalogEntry[]) => setState({ status: "success", data }),
        () => setState({ status: "error" }),
      );
    },
    [getCatalog],
  );

  // Initial fetch with URL params
  const initialFetched = useRef(false);
  useEffect(() => {
    if (initialFetched.current) return;
    initialFetched.current = true;
    fetchExercises("", initialMuscleGroup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchExercises(value, muscleGroup);
    }, 300);
  };

  // Filter change is immediate
  const handleMuscleGroupChange = (group: string | null) => {
    setMuscleGroup(group);
    fetchExercises(search, group);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6 lg:py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Exercise Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse all available movements and exercises.
          </p>
        </div>
        <Link
          href={`/chat?prompt=${encodeURIComponent("Program me a workout")}`}
          className="rounded-full bg-muted/50 px-4 py-2 text-xs text-muted-foreground ring-1 ring-border transition-all hover:bg-muted/80 hover:text-foreground"
        >
          Ask coach to build a workout &rarr;
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Muscle group filter pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => handleMuscleGroupChange(null)}
          className={cn(
            "rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200",
            muscleGroup === null
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-muted/60 text-muted-foreground hover:bg-muted",
          )}
        >
          All
        </button>
        {MUSCLE_GROUPS.map((group) => (
          <button
            key={group}
            onClick={() => handleMuscleGroupChange(muscleGroup === group ? null : group)}
            className={cn(
              "rounded-full px-3.5 py-2 text-xs font-medium transition-all duration-200",
              muscleGroup === group
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "bg-muted/60 text-muted-foreground hover:bg-muted",
            )}
          >
            {group}
          </button>
        ))}
      </div>

      {/* Content */}
      {state.status === "loading" && <ExerciseGridSkeleton />}

      {state.status === "error" && (
        <ErrorAlert
          message="Failed to load exercises."
          onRetry={() => fetchExercises(search, muscleGroup)}
        />
      )}

      {state.status === "success" && state.data.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <Dumbbell className="mb-4 size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">No exercises found</p>
          <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search or filter.</p>
        </div>
      )}

      {state.status === "success" && state.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.data.map((movement) => (
            <ExerciseCard key={movement.id} movement={movement} />
          ))}
        </div>
      )}
    </div>
  );
}
