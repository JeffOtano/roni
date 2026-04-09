"use client";

import { useEffect, useRef, useState } from "react";
import type { WeekPlanPresentation } from "../../../convex/ai/schemas";
import { useAnalytics } from "@/lib/analytics";

const SPLIT_LABELS: Record<string, string> = {
  ppl: "Push/Pull/Legs",
  upper_lower: "Upper/Lower",
  full_body: "Full Body",
};

interface WeekPlanCardProps {
  plan: WeekPlanPresentation;
}

export function WeekPlanCard({ plan }: WeekPlanCardProps) {
  const [activeDay, setActiveDay] = useState(0);
  const day = plan.days[activeDay];
  const { track } = useAnalytics();
  const viewTrackedRef = useRef(false);

  useEffect(() => {
    if (!viewTrackedRef.current) {
      track("week_plan_card_viewed", { plan_id: plan.weekStartDate });
      viewTrackedRef.current = true;
    }
  }, [track, plan.weekStartDate]);

  const handleDayTap = (index: number, dayName: string) => {
    track("week_plan_day_tapped", {
      plan_id: plan.weekStartDate,
      day_index: index,
      day_name: dayName,
    });
    setActiveDay(index);
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/30 px-4 py-2.5">
        <p className="text-sm font-semibold text-foreground">
          Week of {plan.weekStartDate} &middot; {SPLIT_LABELS[plan.split] ?? plan.split}
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-1.5">
        {plan.days.map((d, i) => (
          <button
            key={i}
            onClick={() => handleDayTap(i, d.dayName)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              i === activeDay
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {d.dayName}
          </button>
        ))}
      </div>

      {day && (
        <div className="p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            {day.sessionType} &middot; {day.targetMuscles} &middot; {day.durationMinutes}min
          </p>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">Exercise</th>
                <th className="pb-2 text-center font-medium">Sets x Reps</th>
                <th className="pb-2 text-right font-medium">Target</th>
                <th className="pb-2 text-right font-medium">Last</th>
              </tr>
            </thead>
            <tbody>
              {day.exercises.map((ex, j) => (
                <tr key={j} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-2">
                    <span className="font-medium text-foreground">{ex.name}</span>
                    {ex.note && (
                      <span
                        className={`ml-2 text-xs ${
                          ex.note.toLowerCase().includes("pr")
                            ? "text-green-600 dark:text-green-400"
                            : ex.note.toLowerCase().includes("plateau")
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {ex.note}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-center text-muted-foreground">
                    {ex.reps
                      ? `${ex.sets}x${ex.reps}`
                      : ex.duration
                        ? `${ex.sets}x${ex.duration}s`
                        : `${ex.sets} sets`}
                  </td>
                  <td className="py-2 text-right font-medium text-foreground">
                    {ex.targetWeight ? `${ex.targetWeight} lbs` : "\u2014"}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">
                    {ex.lastWeight ? `${ex.lastWeight} lbs` : "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-border bg-muted/20 px-4 py-2.5">
        <p className="text-xs leading-relaxed text-muted-foreground">{plan.summary}</p>
      </div>
    </div>
  );
}
