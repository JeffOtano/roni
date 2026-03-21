import Link from "next/link";
import { ArrowRight, Clock, Dumbbell, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getGoalLabel,
  getSessionTypeLabel,
  type LibraryEquipmentConfig,
  type LibraryGoal,
  type LibraryLevel,
  type LibrarySessionType,
} from "../../../../convex/coach/goalConfig";

const EQUIPMENT_LABELS: Record<LibraryEquipmentConfig, string> = {
  handles_only: "Handles",
  handles_bar: "Handles + Bar",
  full_accessories: "Full Kit",
  bodyweight_only: "Bodyweight",
};

export interface WorkoutCardData {
  slug: string;
  title: string;
  description: string;
  sessionType: string;
  goal: string;
  durationMinutes: number;
  level: string;
  exerciseCount: number;
  totalSets: number;
  equipmentConfig?: string;
}

const LEVEL_CONFIG: Record<LibraryLevel, { dot: string; text: string }> = {
  beginner: {
    dot: "bg-emerald-400",
    text: "text-emerald-400",
  },
  intermediate: {
    dot: "bg-amber-400",
    text: "text-amber-400",
  },
  advanced: {
    dot: "bg-rose-400",
    text: "text-rose-400",
  },
};

export function WorkoutLibraryCard({ workout }: { readonly workout: WorkoutCardData }) {
  const levelConfig = LEVEL_CONFIG[workout.level as LibraryLevel] ?? LEVEL_CONFIG.intermediate;

  return (
    <Link
      href={`/workouts/${workout.slug}`}
      className={cn(
        "group relative flex flex-col rounded-xl border border-border bg-card p-5",
        "ring-1 ring-transparent transition-all duration-200",
        "hover:border-foreground/15 hover:shadow-lg hover:shadow-black/5",
        "hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "motion-reduce:hover:translate-y-0 motion-reduce:transition-none",
      )}
    >
      {/* Tags row */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {getSessionTypeLabel(workout.sessionType as LibrarySessionType)}
        </span>
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {getGoalLabel(workout.goal as LibraryGoal)}
        </span>
        {workout.equipmentConfig && (
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {EQUIPMENT_LABELS[workout.equipmentConfig as LibraryEquipmentConfig] ??
              workout.equipmentConfig}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-1 text-sm font-semibold leading-snug tracking-tight text-foreground transition-colors duration-150 group-hover:text-primary">
        {workout.title}
      </h3>

      {/* Description - single line on cards, full text lives on detail page */}
      {workout.description.trim() !== "" && (
        <p className="mb-3 line-clamp-1 text-xs leading-relaxed text-muted-foreground">
          {workout.description}
        </p>
      )}

      {/* Spacer to push stats to bottom */}
      <div className="flex-1" />

      {/* Stats footer */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="size-3 shrink-0" aria-hidden="true" />
          {workout.durationMinutes}m
        </span>
        <span className="flex items-center gap-1">
          <Dumbbell className="size-3 shrink-0" aria-hidden="true" />
          {workout.exerciseCount} ex
        </span>
        {workout.totalSets > 0 && (
          <span className="flex items-center gap-1">
            <Layers className="size-3 shrink-0" aria-hidden="true" />
            {workout.totalSets} sets
          </span>
        )}
        <span className={cn("flex items-center gap-1 capitalize", levelConfig.text)}>
          <span
            className={cn("inline-block size-1.5 rounded-full", levelConfig.dot)}
            aria-hidden="true"
          />
          {workout.level}
        </span>
      </div>

      {/* Hover arrow indicator */}
      <ArrowRight
        className="absolute top-5 right-5 size-4 text-muted-foreground/0 transition-all duration-150 group-hover:text-muted-foreground motion-reduce:transition-none"
        aria-hidden="true"
      />
    </Link>
  );
}
