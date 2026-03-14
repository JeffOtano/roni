"use client";

import { Label } from "@/components/ui/label";

export const SPLIT_OPTIONS = [
  { value: "ppl", label: "Push / Pull / Legs" },
  { value: "upper_lower", label: "Upper / Lower" },
  { value: "full_body", label: "Full Body" },
] as const;

export type SplitValue = (typeof SPLIT_OPTIONS)[number]["value"];

export function SplitPreferenceField({
  value,
  onChange,
}: {
  readonly value: SplitValue;
  readonly onChange: (v: SplitValue) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Preferred training split</Label>
      <div className="grid gap-2 pt-1">
        {SPLIT_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              type="radio"
              name="split"
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
