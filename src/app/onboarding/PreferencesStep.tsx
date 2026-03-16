"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GoalField } from "./GoalField";
import { DaysPerWeekField } from "./DaysPerWeekField";
import { InjuriesField } from "./InjuriesField";
import { type SessionDuration, SessionDurationField } from "./SessionDurationField";
import { SplitPreferenceField, type SplitValue } from "./SplitPreferenceField";
import { Loader2 } from "lucide-react";
import { getTrainingDayIndices } from "../../../convex/coach/weekProgrammingHelpers";

export function PreferencesStep({ onComplete }: { readonly onComplete: () => void }) {
  const [goal, setGoal] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [injuries, setInjuries] = useState("");
  const [sessionDuration, setSessionDuration] = useState<SessionDuration>(45);
  const [split, setSplit] = useState<SplitValue>("ppl");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completeOnboarding = useMutation(api.userProfiles.completeOnboarding);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || saving) return;

    setSaving(true);
    setError(null);
    try {
      await completeOnboarding({
        goal: goal.trim(),
        injuries: injuries.trim() || undefined,
        preferredSplit: split,
        trainingDays: getTrainingDayIndices(daysPerWeek),
        sessionDurationMinutes: sessionDuration,
      });
      onComplete();
    } catch {
      setError("Failed to save preferences. Please try again.");
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Set Your Preferences</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A few quick questions so I can program your first AI workout.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <GoalField value={goal} onChange={setGoal} />
          <DaysPerWeekField value={daysPerWeek} onChange={setDaysPerWeek} />
          <SessionDurationField value={sessionDuration} onChange={setSessionDuration} />
          <SplitPreferenceField value={split} onChange={setSplit} />
          <InjuriesField value={injuries} onChange={setInjuries} />
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={!goal.trim() || saving}>
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
