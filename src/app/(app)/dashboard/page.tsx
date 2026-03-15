"use client";

import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type {
  Activity,
  MuscleReadiness,
  StrengthDistribution,
  StrengthScore,
} from "../../../../convex/tonal/types";
import { StrengthScoreCard } from "@/components/StrengthScoreCard";
import { MuscleReadinessMap } from "@/components/MuscleReadinessMap";
import { TrainingFrequencyChart } from "@/components/TrainingFrequencyChart";
import { RecentWorkoutsList } from "@/components/RecentWorkoutsList";
import { AsyncCard } from "@/components/AsyncCard";
import { useActionData } from "@/hooks/useActionData";
import { ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

interface FrequencyEntry {
  targetArea: string;
  count: number;
  lastTrainedDate?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ---------------------------------------------------------------------------
// Smart coaching summary — synthesizes readiness, workouts, and frequency
// ---------------------------------------------------------------------------

/** Map Tonal target areas to muscle readiness keys. */
const AREA_TO_MUSCLES: Record<string, string[]> = {
  "Full Body": [
    "Chest",
    "Shoulders",
    "Back",
    "Triceps",
    "Biceps",
    "Quads",
    "Glutes",
    "Hamstrings",
    "Calves",
  ],
  "Upper Body": ["Chest", "Shoulders", "Back", "Triceps", "Biceps"],
  "Lower Body": ["Quads", "Glutes", "Hamstrings", "Calves"],
  Chest: ["Chest"],
  Back: ["Back"],
  Shoulders: ["Shoulders"],
  Arms: ["Triceps", "Biceps"],
  Legs: ["Quads", "Glutes", "Hamstrings", "Calves"],
  Core: ["Abs", "Obliques"],
};

function buildCoachingSummary(
  readiness: MuscleReadiness,
  workouts: Activity[],
  frequency: FrequencyEntry[],
): { message: string; chatPrompt: string } {
  const entries = Object.entries(readiness)
    .map(([muscle, value]) => ({ muscle, value: value as number }))
    .sort((a, b) => b.value - a.value);

  const freshest = entries[0];
  const freshMuscles = entries.filter((e) => e.value >= 85);

  // Days since last workout
  let daysSinceLast: number | null = null;
  if (workouts.length > 0) {
    const lastTime = new Date(workouts[0].activityTime).getTime();
    daysSinceLast = Math.floor((Date.now() - lastTime) / (1000 * 60 * 60 * 24));
  }

  // Workouts this week (last 7 days)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekCount = workouts.filter((w) => new Date(w.activityTime).getTime() > weekAgo).length;

  // Find undertrained muscle groups (>7 days since last trained)
  const staleGroups = frequency.filter((f) => {
    if (!f.lastTrainedDate) return true;
    const elapsed = Date.now() - new Date(f.lastTrainedDate).getTime();
    return elapsed > 7 * 24 * 60 * 60 * 1000;
  });

  // Build contextual message
  let message: string;
  let chatPrompt: string;

  if (staleGroups.length > 0 && freshest) {
    const staleTarget = staleGroups[0].targetArea;
    const staleDays = staleGroups[0].lastTrainedDate
      ? Math.round(
          (Date.now() - new Date(staleGroups[0].lastTrainedDate).getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;

    // Find the freshest muscle that belongs to the stale training area
    const relevantMuscles = AREA_TO_MUSCLES[staleTarget] ?? [];
    const relevantFreshest =
      relevantMuscles.length > 0
        ? (entries.find((e) => relevantMuscles.includes(e.muscle)) ?? freshest)
        : freshest;

    const daysText = staleDays ? ` in ${staleDays} days` : " recently";
    message = `You haven't trained ${staleTarget.toLowerCase()}${daysText}. Your ${relevantFreshest.muscle.toLowerCase()} is at ${relevantFreshest.value}% readiness — a great time to hit it.`;
    chatPrompt = `I haven't trained ${staleTarget.toLowerCase()}${daysText} and my ${relevantFreshest.muscle.toLowerCase()} readiness is ${relevantFreshest.value}%. Program me a workout for today.`;
  } else if (daysSinceLast !== null && daysSinceLast >= 2 && freshMuscles.length > 0) {
    const muscleList = freshMuscles
      .slice(0, 2)
      .map((m) => m.muscle.toLowerCase())
      .join(" and ");
    message = `Your ${muscleList} ${freshMuscles.length === 1 ? "is" : "are"} fresh (${freshMuscles[0].value}%). Last workout was ${daysSinceLast} days ago — great recovery window.`;
    chatPrompt = `My ${muscleList} readiness is high (${freshMuscles[0].value}%) and I last worked out ${daysSinceLast} days ago. Based on my readiness, program me a workout for today.`;
  } else if (weekCount >= 3) {
    message = `${weekCount} workouts this week, nice consistency. Your ${freshest.muscle.toLowerCase()} is the freshest at ${freshest.value}%.`;
    chatPrompt = `I've done ${weekCount} workouts this week and my ${freshest.muscle.toLowerCase()} is at ${freshest.value}% readiness. Based on my readiness, program me a workout for today.`;
  } else if (freshest) {
    message = `Your ${freshest.muscle.toLowerCase()} is at ${freshest.value}% readiness — ready for a solid session.`;
    chatPrompt = "Based on my current muscle readiness, program me a workout for today.";
  } else {
    message = "Ready to train? Let your coach build something for you.";
    chatPrompt = "Based on my current muscle readiness, program me a workout for today.";
  }

  return { message, chatPrompt };
}

// ---------------------------------------------------------------------------
// Quick navigation pills
// ---------------------------------------------------------------------------

const NAV_PILLS = [
  { label: "View stats", href: "/stats" },
  { label: "Strength trends", href: "/strength" },
  { label: "Browse exercises", href: "/exercises" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const strength = useActionData<{
    scores: StrengthScore[];
    distribution: StrengthDistribution;
  }>(useAction(api.dashboard.getStrengthData));
  const readiness = useActionData<MuscleReadiness>(useAction(api.dashboard.getMuscleReadiness));
  const workouts = useActionData<Activity[]>(useAction(api.dashboard.getWorkoutHistory));
  const frequency = useActionData<FrequencyEntry[]>(useAction(api.dashboard.getTrainingFrequency));

  const me = useQuery(api.users.getMe);
  const firstName = me?.tonalName?.split(" ")[0] ?? "there";

  // Derive coaching summary when all data is loaded
  const allLoaded =
    (readiness.state.status === "success" || readiness.state.status === "refreshing") &&
    (workouts.state.status === "success" || workouts.state.status === "refreshing") &&
    (frequency.state.status === "success" || frequency.state.status === "refreshing");

  const summary = allLoaded
    ? buildCoachingSummary(
        (readiness.state as { data: MuscleReadiness }).data,
        (workouts.state as { data: Activity[] }).data,
        (frequency.state as { data: FrequencyEntry[] }).data,
      )
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-6 lg:py-10">
      {/* Greeting section */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Smart coaching insight */}
      {summary && (
        <div className="mb-6 rounded-xl border border-primary/10 bg-primary/[0.03] px-4 py-3.5 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="text-sm leading-relaxed text-foreground/90">{summary.message}</p>
          <Link
            href={`/chat?prompt=${encodeURIComponent(summary.chatPrompt)}`}
            className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors duration-200 hover:text-primary/80"
          >
            Let&apos;s train
            <ArrowRight className="size-3" />
          </Link>
        </div>
      )}

      {/* Quick-access navigation */}
      <nav aria-label="Quick links" className="mb-8 flex flex-wrap gap-2">
        {NAV_PILLS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="rounded-full bg-muted/50 px-4 py-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted/80 hover:text-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Dashboard grid */}
      <div className="grid gap-5 sm:grid-cols-2">
        <AsyncCard
          state={strength.state}
          refetch={strength.refetch}
          lastUpdatedAt={strength.lastUpdatedAt}
          title="Strength Scores"
        >
          {(d) => <StrengthScoreCard scores={d.scores} distribution={d.distribution} />}
        </AsyncCard>
        <AsyncCard
          state={readiness.state}
          refetch={readiness.refetch}
          lastUpdatedAt={readiness.lastUpdatedAt}
          title="Muscle Readiness"
        >
          {(d) => <MuscleReadinessMap readiness={d} />}
        </AsyncCard>
        <AsyncCard
          state={frequency.state}
          refetch={frequency.refetch}
          lastUpdatedAt={frequency.lastUpdatedAt}
          title="Training Frequency"
        >
          {(d) => <TrainingFrequencyChart data={d} />}
        </AsyncCard>
        <AsyncCard
          state={workouts.state}
          refetch={workouts.refetch}
          lastUpdatedAt={workouts.lastUpdatedAt}
          title="Recent Workouts"
          tall
        >
          {(d) => <RecentWorkoutsList workouts={d} />}
        </AsyncCard>
      </div>
    </div>
  );
}
