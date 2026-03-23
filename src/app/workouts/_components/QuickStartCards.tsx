import Link from "next/link";
import { cn } from "@/lib/utils";

const GOALS = [
  {
    label: "Build Muscle",
    description: "Maximize growth with hypertrophy training",
    href: "/workouts?goal=build_muscle",
  },
  {
    label: "Get Stronger",
    description: "Heavy compounds, low reps, raw power",
    href: "/workouts?goal=strength",
  },
  {
    label: "Burn Fat",
    description: "High-intensity circuits to torch calories",
    href: "/workouts?goal=fat_loss",
  },
  {
    label: "Move Better",
    description: "Functional strength for everyday life",
    href: "/workouts?goal=functional",
  },
] as const;

export function QuickStartCards() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {GOALS.map((goal) => (
        <Link
          key={goal.href}
          href={goal.href}
          className={cn(
            "group flex flex-col justify-end rounded-xl border border-border bg-card p-5 sm:p-6",
            "min-h-[120px] sm:min-h-[140px]",
            "transition-all duration-200",
            "hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            "motion-reduce:hover:translate-y-0 motion-reduce:transition-none",
          )}
        >
          <h2 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
            {goal.label}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {goal.description}
          </p>
        </Link>
      ))}
    </div>
  );
}
