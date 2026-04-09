"use client";

import { Label } from "@/components/ui/label";
import { DAYS_PER_WEEK_OPTIONS } from "@/lib/coldStartPreferences";

export function DaysPerWeekField({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>How many days per week do you want to train?</Label>
      <div className="flex flex-wrap gap-2 pt-1">
        {DAYS_PER_WEEK_OPTIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={`rounded-md border px-4 py-2 text-sm transition-colors ${
              value === d
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-muted/50"
            }`}
          >
            {d} days
          </button>
        ))}
      </div>
    </div>
  );
}
