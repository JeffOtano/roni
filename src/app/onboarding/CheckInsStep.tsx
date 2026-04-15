"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "every_other_day", label: "Every other day" },
  { value: "weekly", label: "Weekly" },
] as const;

type Frequency = (typeof FREQUENCY_OPTIONS)[number]["value"];

export function CheckInsStep({ onComplete }: { readonly onComplete: () => void }) {
  const [enabled, setEnabled] = useState(true);
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePreferences = useMutation(api.checkIns.updatePreferences);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);
    try {
      await updatePreferences({ enabled, frequency });
      setSaving(false);
      onComplete();
    } catch (err) {
      console.error("Failed to save check-in preferences:", err);
      setError("Failed to save preferences. Please try again.");
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Proactive check-ins</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your coach can send you proactive messages after missed sessions, strength milestones,
            and weekly recaps.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setEnabled(true)}
              aria-pressed={enabled}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
                enabled
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              <Bell className="size-5" />
              Enable check-ins
            </button>
            <button
              type="button"
              onClick={() => setEnabled(false)}
              aria-pressed={!enabled}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
                !enabled
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              <BellOff className="size-5" />
              Not right now
            </button>
          </div>

          {enabled && (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground">Frequency</p>
              <div className="flex gap-2">
                {FREQUENCY_OPTIONS.map(({ value, label }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={frequency === value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFrequency(value)}
                    aria-pressed={frequency === value}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                You can change this anytime in Settings.
              </p>
            </div>
          )}

          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save and continue"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
