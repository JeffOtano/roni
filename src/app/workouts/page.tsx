import { Suspense } from "react";
import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import { WorkoutBrowseClient } from "./_components/WorkoutBrowseClient";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Free Tonal Workouts | tonal.coach",
  description:
    "Browse 800+ expert-designed Tonal workouts for every goal, muscle group, and experience level.",
  alternates: { canonical: "/workouts" },
};

export default async function WorkoutsPage() {
  const initialPage = await fetchQuery(api.libraryWorkouts.listFiltered, {
    paginationOpts: { numItems: 24, cursor: null },
  });

  return (
    <Suspense>
      <WorkoutBrowseClient initialWorkouts={initialPage.page} />
    </Suspense>
  );
}
