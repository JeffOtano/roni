"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  getGoalLabel,
  getSessionTypeLabel,
  type LibraryGoal,
  type LibraryLevel,
  type LibrarySessionType,
} from "../../../../convex/coach/goalConfig";

const ALL_GOALS: LibraryGoal[] = [
  "build_muscle",
  "fat_loss",
  "strength",
  "endurance",
  "athletic",
  "general_fitness",
  "power",
  "functional",
  "mobility_flexibility",
  "sport_complement",
];

const ALL_SESSION_TYPES: LibrarySessionType[] = [
  "push",
  "pull",
  "legs",
  "upper",
  "lower",
  "full_body",
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "glutes_hamstrings",
  "chest_back",
  "mobility",
  "recovery",
];

const DURATION_OPTIONS = [
  { value: "20", label: "20 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60 min" },
] as const;

const LEVEL_OPTIONS: { value: LibraryLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-full border border-primary bg-primary/20 px-3 py-1 text-xs font-medium text-primary transition-colors"
          : "rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
      }
    >
      {label}
    </button>
  );
}

export function WorkoutFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeGoal = searchParams.get("goal") as LibraryGoal | null;
  const activeSessionType = searchParams.get("sessionType") as LibrarySessionType | null;
  const activeDuration = searchParams.get("duration");
  const activeLevel = searchParams.get("level") as LibraryLevel | null;

  function toggleParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get(key) === value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/workouts?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-3">
      {/* Row 1: Goals */}
      <div className="flex flex-wrap gap-2">
        {ALL_GOALS.map((goal) => (
          <Pill
            key={goal}
            label={getGoalLabel(goal)}
            active={activeGoal === goal}
            onClick={() => toggleParam("goal", goal)}
          />
        ))}
      </div>

      {/* Row 2: Session types */}
      <div className="flex flex-wrap gap-2">
        {ALL_SESSION_TYPES.map((type) => (
          <Pill
            key={type}
            label={getSessionTypeLabel(type)}
            active={activeSessionType === type}
            onClick={() => toggleParam("sessionType", type)}
          />
        ))}
      </div>

      {/* Row 3: Duration + Level */}
      <div className="flex flex-wrap gap-2">
        {DURATION_OPTIONS.map(({ value, label }) => (
          <Pill
            key={value}
            label={label}
            active={activeDuration === value}
            onClick={() => toggleParam("duration", value)}
          />
        ))}
        <span className="border-l border-border" aria-hidden />
        {LEVEL_OPTIONS.map(({ value, label }) => (
          <Pill
            key={value}
            label={label}
            active={activeLevel === value}
            onClick={() => toggleParam("level", value)}
          />
        ))}
      </div>
    </div>
  );
}
