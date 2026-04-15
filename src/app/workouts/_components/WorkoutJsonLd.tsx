import { SITE_NAME, SITE_URL } from "@/lib/urls";

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
    goal: string;
    durationMinutes: number;
    level: string;
    totalSets: number;
    exerciseCount: number;
    targetMuscleGroups: string[];
    createdAt: number;
    faq?: FaqItem[];
  };
  sessionLabel: string;
  goalLabel: string;
}

export function WorkoutJsonLd({ workout, sessionLabel, goalLabel }: WorkoutJsonLdProps) {
  const schemas: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "ExercisePlan",
      name: workout.title,
      description: workout.description,
      url: `${SITE_URL}/workouts/${workout.slug}`,
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
        name: SITE_NAME,
        url: SITE_URL,
      },
      provider: {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
      },
    },
  ];

  schemas.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Workouts",
        item: `${SITE_URL}/workouts`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: sessionLabel,
        item: `${SITE_URL}/workouts?sessionType=${workout.sessionType}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: goalLabel,
        item: `${SITE_URL}/workouts?goal=${workout.goal}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: workout.title,
      },
    ],
  });

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
