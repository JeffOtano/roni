"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Clock, X } from "lucide-react";
import type { ScheduleDay } from "../../../convex/schedule";

type Status = ScheduleDay["derivedStatus"] | "missed";

const STATUS_CONFIG: Record<
  Exclude<Status, "rest">,
  { label: string; icon: typeof Check; className: string }
> = {
  completed: {
    label: "Completed",
    icon: Check,
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  },
  programmed: {
    label: "Scheduled",
    icon: Clock,
    className: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  },
  failed: {
    label: "Push failed",
    icon: X,
    className: "bg-red-500/15 text-red-400 border-red-500/20",
  },
  missed: {
    label: "Missed",
    icon: X,
    className: "bg-red-500/15 text-red-400 border-red-500/20",
  },
};

export function StatusBadge({ status }: { status: Status }) {
  if (status === "rest") return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("h-5 gap-1 rounded-md px-1.5 text-[10px] font-medium", config.className)}
    >
      <Icon className="size-2.5" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
