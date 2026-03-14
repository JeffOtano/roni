"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GoalField } from "@/components/GoalField";
import { DaysPerWeekField } from "@/components/DaysPerWeekField";
import { InjuriesField } from "@/components/InjuriesField";
import {
  getStoredColdStartPreferences,
  setStoredColdStartPreferences,
} from "@/lib/coldStartPreferences";

export function PreferencesStep({ onComplete }: { readonly onComplete: () => void }) {
  const stored = getStoredColdStartPreferences();
  const [goal, setGoal] = useState(stored?.goal ?? "");
  const [daysPerWeek, setDaysPerWeek] = useState(stored?.daysPerWeek ?? 3);
  const [injuries, setInjuries] = useState(stored?.injuriesOrConstraints ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    setStoredColdStartPreferences({
      goal: goal.trim(),
      daysPerWeek,
      injuriesOrConstraints: injuries.trim(),
      completedAt: Date.now(),
    });
    onComplete();
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
          <InjuriesField value={injuries} onChange={setInjuries} />
          <Button type="submit" className="w-full" size="lg" disabled={!goal.trim()}>
            Save and continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
