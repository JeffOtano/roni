import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { BarChart3, Clock, Dumbbell, Layers } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import {
  getGoalLabel,
  getSessionTypeLabel,
  type LibraryGoal,
  type LibrarySessionType,
} from "../../../../convex/coach/goalConfig";
import { WorkoutBlockDisplay } from "../_components/WorkoutBlockDisplay";
import { WorkoutCtaBanner } from "../_components/WorkoutCtaBanner";
import { RelatedWorkouts } from "../_components/RelatedWorkouts";
import { WorkoutJsonLd } from "../_components/WorkoutJsonLd";

export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await fetchQuery(api.libraryWorkouts.getSlugs);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const workout = await fetchQuery(api.libraryWorkouts.getBySlug, { slug });
  if (!workout) return {};
  return {
    title: workout.metaTitle,
    description: workout.metaDescription || workout.description,
    alternates: { canonical: `/workouts/${slug}` },
  };
}

export default async function WorkoutDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workout = await fetchQuery(api.libraryWorkouts.getBySlug, { slug });

  if (!workout) notFound();

  const sessionLabel = getSessionTypeLabel(workout.sessionType as LibrarySessionType);
  const goalLabel = getGoalLabel(workout.goal as LibraryGoal);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <WorkoutJsonLd workout={workout} />

      {/* Breadcrumbs */}
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/workouts" className="hover:text-foreground">
          Workouts
        </Link>
        <span>/</span>
        <Link
          href={`/workouts?sessionType=${workout.sessionType}`}
          className="hover:text-foreground"
        >
          {sessionLabel}
        </Link>
        <span>/</span>
        <Link href={`/workouts?goal=${workout.goal}`} className="hover:text-foreground">
          {goalLabel}
        </Link>
        <span>/</span>
        <span>
          {workout.durationMinutes}min <span className="capitalize">{workout.level}</span>
        </span>
      </nav>

      {/* Title + description */}
      <h1 className="mb-3 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
        {workout.title}
      </h1>
      <p className="mb-8 text-sm leading-relaxed text-muted-foreground">{workout.description}</p>

      {/* Quick stats bar */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatPill
          icon={<Clock className="h-4 w-4" />}
          value={`${workout.durationMinutes}m`}
          label="Duration"
        />
        <StatPill
          icon={<Dumbbell className="h-4 w-4" />}
          value={String(workout.exerciseCount)}
          label="Exercises"
        />
        <StatPill
          icon={<BarChart3 className="h-4 w-4" />}
          value={String(workout.totalSets)}
          label="Total Sets"
        />
        <StatPill
          icon={<Layers className="h-4 w-4" />}
          value={workout.targetMuscleGroups.slice(0, 2).join(", ")}
          label="Muscles"
        />
      </div>

      {/* Equipment badges */}
      {workout.equipmentNeeded.length > 0 && (
        <div className="mb-8">
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Equipment
          </p>
          <div className="flex flex-wrap gap-1.5">
            {workout.equipmentNeeded.map((eq) => (
              <span
                key={eq}
                className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {eq}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Open in Tonal button */}
      {workout.tonalWorkoutId && (
        <a
          href={`https://link.tonal.com/custom-workout/${workout.tonalWorkoutId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-8 flex items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Open in Tonal
        </a>
      )}

      {/* Workout blocks */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Workout Plan</h2>
        <WorkoutBlockDisplay blocks={workout.blocks} movementDetails={workout.movementDetails} />
      </section>

      <WorkoutCtaBanner />

      <Suspense fallback={null}>
        <RelatedWorkouts slug={slug} />
      </Suspense>
    </div>
  );
}

function StatPill({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card p-3 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-bold tabular-nums text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
