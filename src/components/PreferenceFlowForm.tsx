"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ColdStartPreferences } from "@/lib/coldStartPreferences";
import { GoalField } from "@/components/GoalField";
import { DaysPerWeekField } from "@/components/DaysPerWeekField";
import { InjuriesField } from "@/components/InjuriesField";

interface PreferenceFlowFormProps {
  initialGoal: string;
  initialDaysPerWeek: number;
  initialInjuries: string;
  onSubmit: (prefs: ColdStartPreferences) => void;
}

export function PreferenceFlowForm({
  initialGoal,
  initialDaysPerWeek,
  initialInjuries,
  onSubmit,
}: PreferenceFlowFormProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [daysPerWeek, setDaysPerWeek] = useState(initialDaysPerWeek);
  const [injuriesOrConstraints, setInjuriesOrConstraints] = useState(initialInjuries);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    onSubmit({
      goal: goal.trim(),
      daysPerWeek,
      injuriesOrConstraints: injuriesOrConstraints.trim(),
      completedAt: Date.now(),
    });
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">Let&apos;s set you up</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A few quick questions so I can program your first AI workout.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <GoalField value={goal} onChange={setGoal} />
            <DaysPerWeekField value={daysPerWeek} onChange={setDaysPerWeek} />
            <InjuriesField value={injuriesOrConstraints} onChange={setInjuriesOrConstraints} />
            <Button type="submit" className="w-full" size="lg" disabled={!goal.trim()}>
              Save and continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
