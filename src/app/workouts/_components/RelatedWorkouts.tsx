import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { WorkoutLibraryCard } from "./WorkoutLibraryCard";

interface RelatedWorkoutsProps {
  slug: string;
}

export async function RelatedWorkouts({ slug }: RelatedWorkoutsProps) {
  const related = await fetchQuery(api.libraryWorkouts.getRelated, { slug, limit: 3 });

  if (related.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-4 text-lg font-semibold">Related Workouts</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((workout) => (
          <WorkoutLibraryCard
            key={workout.slug}
            workout={{
              slug: workout.slug,
              title: workout.title,
              description: "",
              sessionType: workout.sessionType,
              goal: workout.goal,
              durationMinutes: workout.durationMinutes,
              level: workout.level,
              exerciseCount: workout.exerciseCount,
              totalSets: 0,
            }}
          />
        ))}
      </div>
    </section>
  );
}
