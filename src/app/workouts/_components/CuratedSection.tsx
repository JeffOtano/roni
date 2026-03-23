import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { type WorkoutCardData, WorkoutLibraryCard } from "./WorkoutLibraryCard";

interface CuratedSectionProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly seeAllHref: string;
  readonly workouts: readonly WorkoutCardData[];
}

export function CuratedSection({ title, subtitle, seeAllHref, workouts }: CuratedSectionProps) {
  if (workouts.length < 3) return null;

  return (
    <section>
      {/* Header row */}
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Link
          href={seeAllHref}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          See all
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* Horizontal scroll container */}
      <div
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-0 sm:px-0"
        role="list"
      >
        {workouts.map((workout) => (
          <div key={workout.slug} className="w-[280px] shrink-0 snap-start" role="listitem">
            <WorkoutLibraryCard workout={workout} />
          </div>
        ))}
        {/* Spacer to ensure last card has room to scroll into view */}
        <div className="w-1 shrink-0 sm:hidden" aria-hidden="true" />
      </div>
    </section>
  );
}
