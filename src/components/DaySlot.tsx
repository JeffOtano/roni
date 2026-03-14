"use client";

import { Badge } from "@/components/ui/badge";
import type { Doc } from "../../convex/_generated/dataModel";

type WeekPlanDay = Doc<"weekPlans">["days"][number];

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

const STATUS_VARIANTS: Record<
  "programmed" | "completed" | "missed" | "rescheduled",
  "secondary" | "default" | "destructive" | "outline"
> = {
  programmed: "secondary",
  completed: "default",
  missed: "destructive",
  rescheduled: "outline",
};

function formatSessionType(sessionType: WeekPlanDay["sessionType"]): string {
  return SESSION_LABELS[sessionType] ?? sessionType;
}

function formatDuration(minutes: number | undefined): string {
  if (minutes == null) return "";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function DaySlot({
  dayLabel,
  sessionType,
  status,
  estimatedDuration,
}: {
  dayLabel: string;
  sessionType: WeekPlanDay["sessionType"];
  status: WeekPlanDay["status"];
  estimatedDuration: number | undefined;
}) {
  const variant = STATUS_VARIANTS[status];
  const durationStr = formatDuration(estimatedDuration);

  return (
    <li className="rounded-xl border border-white/[0.06] bg-muted/30 p-3.5 transition-all hover:border-white/[0.12] hover:bg-muted/50">
      <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {dayLabel}
      </div>
      <div className="font-semibold tracking-tight text-foreground">
        {formatSessionType(sessionType)}
      </div>
      {durationStr && sessionType !== "rest" && (
        <div className="mt-1 text-xs text-muted-foreground">{durationStr}</div>
      )}
      <Badge variant={variant} className="mt-2.5 text-[10px] capitalize">
        {status}
      </Badge>
    </li>
  );
}
