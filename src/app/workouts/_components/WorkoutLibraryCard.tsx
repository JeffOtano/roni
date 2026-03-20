import Link from "next/link";
import { BarChart3, Clock, Dumbbell } from "lucide-react";
import {
  getGoalLabel,
  getSessionTypeLabel,
  type LibraryGoal,
  type LibraryLevel,
  type LibrarySessionType,
} from "../../../../convex/coach/goalConfig";

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
}

const LEVEL_COLORS: Record<LibraryLevel, string> = {
  beginner: "text-emerald-400",
  intermediate: "text-amber-400",
  advanced: "text-rose-400",
};

export function WorkoutLibraryCard({ workout }: { workout: WorkoutCardData }) {
  const levelColor =
    LEVEL_COLORS[(workout.level as LibraryLevel) ?? "intermediate"] ?? "text-muted-foreground";

  return (
    <Link
      href={`/workouts/${workout.slug}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-card/80"
    >
      {/* Tags */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {getSessionTypeLabel(workout.sessionType as LibrarySessionType)}
        </span>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {getGoalLabel(workout.goal as LibraryGoal)}
        </span>
      </div>

      {/* Title */}
      <h3 className="mb-2 text-sm font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary">
        {workout.title}
      </h3>

      {/* Description */}
      <p className="mb-4 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
        {workout.description}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {workout.durationMinutes}m
        </span>
        <span className={`capitalize ${levelColor}`}>{workout.level}</span>
        <span className="flex items-center gap-1">
          <Dumbbell className="h-3 w-3" />
          {workout.exerciseCount} exercises
        </span>
        <span className="flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          {workout.totalSets} sets
        </span>
      </div>
    </Link>
  );
}
