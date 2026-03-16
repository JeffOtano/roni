"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function InjuriesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="injuries">Any injuries or areas to avoid? (optional)</Label>
      <Textarea
        id="injuries"
        placeholder="e.g. lower back, right shoulder..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="resize-none"
      />
    </div>
  );
}
