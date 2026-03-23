"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { getSessionTypeLabel, type LibrarySessionType } from "../../../../convex/coach/goalConfig";

const COMPOUND: LibrarySessionType[] = ["push", "pull", "legs", "upper", "lower", "full_body"];
const ISOLATION: LibrarySessionType[] = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "glutes_hamstrings",
  "chest_back",
];

function Chip({
  sessionType,
  isActive,
}: {
  readonly sessionType: LibrarySessionType;
  readonly isActive: boolean;
}) {
  const href = isActive ? "/workouts" : `/workouts?sessionType=${sessionType}`;
  const label = getSessionTypeLabel(sessionType);

  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-sm font-medium",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "motion-reduce:transition-none",
        isActive
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
      )}
      aria-current={isActive ? "true" : undefined}
    >
      {label}
    </Link>
  );
}

export function SessionTypeChips() {
  const searchParams = useSearchParams();
  const active = searchParams.get("sessionType") as LibrarySessionType | null;

  return (
    <nav
      aria-label="Filter by session type"
      className="flex items-center gap-2 overflow-x-auto pb-1"
    >
      {COMPOUND.map((st) => (
        <Chip key={st} sessionType={st} isActive={active === st} />
      ))}
      <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
      {ISOLATION.map((st) => (
        <Chip key={st} sessionType={st} isActive={active === st} />
      ))}
    </nav>
  );
}
