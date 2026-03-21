interface FaqItem {
  question: string;
  answer: string;
}

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
    faq?: FaqItem[];
  };
}

export function WorkoutJsonLd({ workout }: WorkoutJsonLdProps) {
  const schemas: object[] = [
    {
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
    },
  ];

  if (workout.faq && workout.faq.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: workout.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </>
  );
}
