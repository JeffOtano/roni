import { Suspense } from "react";
import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import { WorkoutBrowseClient } from "./_components/WorkoutBrowseClient";

export const metadata: Metadata = {
  title: "Free Tonal Workouts | tonal.coach",
  description:
    "Browse 800+ expert-designed Tonal workouts for every goal, muscle group, and experience level.",
  alternates: { canonical: "/workouts" },
};

export default async function WorkoutsPage() {
  const workouts = await fetchQuery(api.libraryWorkouts.listAll);

  return (
    <Suspense>
      <WorkoutBrowseClient workouts={workouts} />
    </Suspense>
  );
}
