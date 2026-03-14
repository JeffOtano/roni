"use client";

import { Label } from "@/components/ui/label";

const DURATION_OPTIONS = [30, 45, 60] as const;

export type SessionDuration = (typeof DURATION_OPTIONS)[number];

export function SessionDurationField({
  value,
  onChange,
}: {
  readonly value: SessionDuration;
  readonly onChange: (v: SessionDuration) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>How long should each session be?</Label>
      <div className="flex flex-wrap gap-2 pt-1">
        {DURATION_OPTIONS.map((d) => (
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
            {d} min
          </button>
        ))}
      </div>
    </div>
  );
}
