"use client";

import { Label } from "@/components/ui/label";
import { GOAL_OPTIONS } from "@/lib/coldStartPreferences";

export function GoalField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="goal">What&apos;s your main training goal?</Label>
      <div className="grid gap-2 pt-1">
        {GOAL_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              type="radio"
              name="goal"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="size-4"
            />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
