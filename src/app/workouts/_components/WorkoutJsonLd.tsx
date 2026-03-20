interface WorkoutJsonLdProps {
  workout: {
    title: string;
    description: string;
    sessionType: string;
    durationMinutes: number;
    level: string;
    totalSets: number;
  };
}

export function WorkoutJsonLd({ workout }: WorkoutJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ExercisePlan",
    name: workout.title,
    description: workout.description,
    exerciseType: workout.sessionType,
    activityDuration: `PT${workout.durationMinutes}M`,
    intensity: workout.level,
    workload: `${workout.totalSets} total sets`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
