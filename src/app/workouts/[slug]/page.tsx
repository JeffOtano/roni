import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { ArrowLeft, BarChart3, Clock, Dumbbell, Layers } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import {
  getGoalLabel,
  getSessionTypeLabel,
  type LibraryGoal,
  type LibrarySessionType,
} from "../../../../convex/coach/goalConfig";
import { WorkoutBlockDisplay } from "../_components/WorkoutBlockDisplay";
import { WorkoutCtaBanner } from "../_components/WorkoutCtaBanner";
import { OpenInTonalButton } from "../_components/OpenInTonalButton";
import { RelatedWorkouts } from "../_components/RelatedWorkouts";
import { WorkoutJsonLd } from "../_components/WorkoutJsonLd";

export const revalidate = 3600;

export async function generateStaticParams() {
  // Skip pre-rendering on preview builds -- pages will be generated on-demand via ISR
  if (process.env.VERCEL_ENV === "preview") return [];

  try {
    const allSlugs: string[] = [];
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const result: { slugs: string[]; isDone: boolean; continueCursor: string } = await fetchQuery(
        api.libraryWorkouts.getSlugsPage,
        {
          paginationOpts: { numItems: 100, cursor },
        },
      );
      allSlugs.push(...result.slugs);
      isDone = result.isDone;
      cursor = result.continueCursor;
    }
    return allSlugs.map((slug) => ({ slug }));
  } catch (error) {
    console.error(
      "generateStaticParams: failed to fetch slugs, falling back to on-demand ISR",
      error,
    );
    return [];
  }
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
      <WorkoutJsonLd workout={workout} sessionLabel={sessionLabel} goalLabel={goalLabel} />

      {/* Back + Breadcrumbs */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/workouts"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All Workouts
        </Link>
        <span className="text-xs text-border">|</span>
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
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
      </div>

      {/* Title + description */}
      <h1 className="mb-3 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
        {workout.title}
      </h1>
      <p className="mb-4 text-base leading-relaxed text-muted-foreground">{workout.description}</p>

      {/* Who is this for */}
      {workout.whoIsThisFor && (
        <p className="mb-8 text-sm italic text-muted-foreground">{workout.whoIsThisFor}</p>
      )}

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
          <p className="mb-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Equipment
          </p>
          <div className="flex flex-wrap gap-1.5">
            {workout.equipmentNeeded.map((eq) => (
              <span
                key={eq}
                className="rounded-full border border-border bg-muted px-3 py-1 text-sm text-muted-foreground"
              >
                {eq}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Workout blocks */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Workout Plan</h2>
        {workout.restGuidance && (
          <p className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            {workout.restGuidance}
          </p>
        )}
        <WorkoutBlockDisplay blocks={workout.blocks} movementDetails={workout.movementDetails} />
      </section>

      {/* Workout rationale */}
      {workout.workoutRationale && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          <h3 className="mb-2 text-base font-semibold text-foreground">Why this order</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {workout.workoutRationale}
          </p>
        </div>
      )}

      <WorkoutCtaBanner slug={slug} />

      {/* Open in Tonal button */}
      {workout.tonalDeepLinkUrl && (
        <OpenInTonalButton href={workout.tonalDeepLinkUrl} slug={slug} />
      )}

      {/* FAQ */}
      {workout.faq && workout.faq.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {workout.faq.map((item, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-5">
                <h3 className="mb-2 text-base font-semibold text-foreground">{item.question}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <Suspense fallback={null}>
        <RelatedWorkouts slug={slug} />
      </Suspense>
    </div>
  );
}

function StatPill({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-4 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-base font-bold tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
