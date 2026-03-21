"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ChevronDown, X } from "lucide-react";
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

interface FilterSelectProps {
  readonly label: string;
  readonly paramKey: string;
  readonly value: string | null;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly onChange: (key: string, value: string) => void;
}

function FilterSelect({ label, paramKey, value, options, onChange }: FilterSelectProps) {
  const isActive = value !== null;

  return (
    <div className="relative">
      <label className="sr-only" htmlFor={`filter-${paramKey}`}>
        {label}
      </label>
      <select
        id={`filter-${paramKey}`}
        value={value ?? ""}
        onChange={(e) => onChange(paramKey, e.target.value)}
        className={[
          "h-10 w-full cursor-pointer appearance-none rounded-lg border bg-card py-2 pr-9 pl-3 text-sm transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          isActive
            ? "border-primary/40 text-foreground"
            : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
        ].join(" ")}
        aria-label={`Filter by ${label.toLowerCase()}`}
      >
        <option value="">All {label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {/* Chevron icon overlay */}
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      {/* Active indicator dot */}
      {isActive && (
        <span
          className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export function WorkoutFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeGoal = searchParams.get("goal") as LibraryGoal | null;
  const activeSessionType = searchParams.get("sessionType") as LibrarySessionType | null;
  const activeDuration = searchParams.get("duration");
  const activeLevel = searchParams.get("level") as LibraryLevel | null;

  const hasActiveFilters =
    activeGoal !== null ||
    activeSessionType !== null ||
    activeDuration !== null ||
    activeLevel !== null;

  const activeCount = [activeGoal, activeSessionType, activeDuration, activeLevel].filter(
    Boolean,
  ).length;

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.push(qs ? `/workouts?${qs}` : "/workouts", { scroll: false });
    },
    [router, searchParams],
  );

  function clearAll() {
    router.push("/workouts", { scroll: false });
  }

  const goalOptions = ALL_GOALS.map((g) => ({ value: g, label: getGoalLabel(g) }));
  const sessionTypeOptions = ALL_SESSION_TYPES.map((s) => ({
    value: s,
    label: getSessionTypeLabel(s),
  }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FilterSelect
          label="Goal"
          paramKey="goal"
          value={activeGoal}
          options={goalOptions}
          onChange={setParam}
        />
        <FilterSelect
          label="Session Type"
          paramKey="sessionType"
          value={activeSessionType}
          options={sessionTypeOptions}
          onChange={setParam}
        />
        <FilterSelect
          label="Duration"
          paramKey="duration"
          value={activeDuration}
          options={DURATION_OPTIONS}
          onChange={setParam}
        />
        <FilterSelect
          label="Level"
          paramKey="level"
          value={activeLevel}
          options={LEVEL_OPTIONS}
          onChange={setParam}
        />
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {activeCount} filter{activeCount !== 1 ? "s" : ""} active
          </span>
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-3" aria-hidden="true" />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
