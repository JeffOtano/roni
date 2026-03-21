interface WorkoutJsonLdProps {
  workout: {
    slug: string;
    title: string;
    description: string;
    sessionType: string;
    durationMinutes: number;
    level: string;
    totalSets: number;
    exerciseCount: number;
    targetMuscleGroups: string[];
    createdAt: number;
  };
}

export function WorkoutJsonLd({ workout }: WorkoutJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ExercisePlan",
    name: workout.title,
    description: workout.description,
    url: `https://tonal.coach/workouts/${workout.slug}`,
    exerciseType: workout.sessionType,
    activityDuration: `PT${workout.durationMinutes}M`,
    intensity: workout.level,
    workload: `${workout.totalSets} sets across ${workout.exerciseCount} exercises`,
    educationalLevel: workout.level,
    keywords: [
      "Tonal workout",
      workout.sessionType,
      workout.level,
      ...workout.targetMuscleGroups,
    ].join(", "),
    datePublished: new Date(workout.createdAt).toISOString(),
    author: {
      "@type": "Organization",
      name: "tonal.coach",
      url: "https://tonal.coach",
    },
    provider: {
      "@type": "Organization",
      name: "tonal.coach",
      url: "https://tonal.coach",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
