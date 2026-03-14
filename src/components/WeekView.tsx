"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DaySlot } from "@/components/DaySlot";
import type { Doc } from "../../convex/_generated/dataModel";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type WeekPlanDay = Doc<"weekPlans">["days"][number];

export function WeekView({ plan }: { plan: Doc<"weekPlans"> | null }) {
  const days = plan?.days ?? defaultEmptyDays();
  const weekStart = plan?.weekStartDate ?? getDefaultWeekStart();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
          This week
        </CardTitle>
        <p className="text-xs text-muted-foreground">Week of {formatWeekStart(weekStart)}</p>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((day, i) => (
            <DaySlot
              key={i}
              dayLabel={DAY_LABELS[i]}
              sessionType={day.sessionType}
              status={day.status}
              estimatedDuration={day.estimatedDuration}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function defaultEmptyDays(): WeekPlanDay[] {
  return Array.from({ length: 7 }, () => ({
    sessionType: "rest",
    status: "programmed",
  }));
}

function getDefaultWeekStart(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatWeekStart(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00Z");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
