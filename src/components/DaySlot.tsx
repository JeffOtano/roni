"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, Clock, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type DerivedStatus = "rest" | "programmed" | "completed" | "failed";

const SESSION_LABELS: Record<string, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper",
  lower: "Lower",
  full_body: "Full body",
  recovery: "Recovery",
  rest: "Rest",
};

function formatSessionType(sessionType: string): string {
  return SESSION_LABELS[sessionType] ?? sessionType;
}

function formatDuration(minutes: number | undefined): string {
  if (minutes == null) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface DaySlotProps {
  dayLabel: string;
  sessionType: string;
  derivedStatus: DerivedStatus;
  estimatedDuration?: number;
  tonalWorkoutId?: string;
}

function StatusBadge({ status }: { status: DerivedStatus }) {
  switch (status) {
    case "rest":
      return (
        <Badge variant="secondary" className="text-[10px] text-muted-foreground/70">
          <Minus className="mr-0.5 size-2.5" />
          Rest
        </Badge>
      );
    case "programmed":
      return (
        <Badge variant="secondary" className="text-[10px]">
          <Clock className="mr-0.5 size-2.5" />
          Scheduled
        </Badge>
      );
    case "completed":
      return (
        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-[10px] text-emerald-400">
          <Check className="mr-0.5 size-2.5" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="text-[10px]">
          <AlertCircle className="mr-0.5 size-2.5" />
          Push failed
        </Badge>
      );
  }
}

function DaySlotContent({
  dayLabel,
  sessionType,
  derivedStatus,
  estimatedDuration,
}: Omit<DaySlotProps, "tonalWorkoutId">) {
  const durationStr = formatDuration(estimatedDuration);
  const isRest = derivedStatus === "rest";
  const isCompleted = derivedStatus === "completed";
  const isFailed = derivedStatus === "failed";

  return (
    <li
      className={cn(
        "rounded-xl border p-3.5 transition-colors duration-150",
        isRest && "border-white/4 bg-muted/15 opacity-60",
        derivedStatus === "programmed" &&
          "border-l-2 border-l-primary/40 border-t-white/6 border-r-white/6 border-b-white/6 bg-muted/30 hover:border-t-white/12 hover:border-r-white/12 hover:border-b-white/12 hover:bg-muted/50",
        isCompleted &&
          "border-emerald-500/20 bg-emerald-500/6 shadow-[0_0_12px_oklch(0.72_0.17_160/0.08)]",
        isFailed && "border-destructive/30 bg-destructive/6",
      )}
    >
      <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {dayLabel}
      </div>
      <div
        className={cn(
          "font-semibold tracking-tight",
          isRest ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {formatSessionType(sessionType)}
      </div>
      {durationStr && !isRest && (
        <div className="mt-1 text-xs text-muted-foreground">{durationStr}</div>
      )}
      <div className="mt-2.5">
        <StatusBadge status={derivedStatus} />
      </div>
    </li>
  );
}

export function DaySlot(props: DaySlotProps) {
  const { tonalWorkoutId, ...rest } = props;

  if (tonalWorkoutId) {
    return (
      <Link
        href={`/workouts/${tonalWorkoutId}`}
        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <DaySlotContent {...rest} />
      </Link>
    );
  }

  return <DaySlotContent {...rest} />;
}
