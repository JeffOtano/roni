"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { X } from "lucide-react";
import {
  getGoalLabel,
  getSessionTypeLabel,
  type LibraryGoal,
  type LibraryLevel,
  type LibrarySessionType,
} from "../../../../convex/coach/goalConfig";

const LEVEL_LABELS: Record<LibraryLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const DURATION_LABELS: Record<string, string> = {
  "20": "20 min",
  "30": "30 min",
  "45": "45 min",
  "60": "60 min",
};

function getFilterLabel(key: string, value: string): string {
  switch (key) {
    case "goal":
      return getGoalLabel(value as LibraryGoal);
    case "sessionType":
      return getSessionTypeLabel(value as LibrarySessionType);
    case "level":
      return LEVEL_LABELS[value as LibraryLevel] ?? value;
    case "duration":
      return DURATION_LABELS[value] ?? `${value} min`;
    default:
      return value;
  }
}

const TRACKED_PARAMS = ["goal", "sessionType", "duration", "level"] as const;

export function ActiveFilterPills() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeFilters: { key: string; value: string }[] = [];
  for (const key of TRACKED_PARAMS) {
    const value = searchParams.get(key);
    if (value !== null) activeFilters.push({ key, value });
  }

  const removeFilter = useCallback(
    (key: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      const qs = params.toString();
      router.push(qs ? `/workouts?${qs}` : "/workouts", { scroll: false });
    },
    [router, searchParams],
  );

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Active filters">
      {activeFilters.map(({ key, value }) => (
        <span
          key={key}
          role="listitem"
          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
        >
          {getFilterLabel(key, value)}
          <button
            type="button"
            onClick={() => removeFilter(key)}
            className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label={`Remove ${getFilterLabel(key, value)} filter`}
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}
