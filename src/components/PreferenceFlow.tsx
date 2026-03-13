"use client";

import { useState } from "react";
import type { ColdStartPreferences } from "@/lib/coldStartPreferences";
import {
  getStoredColdStartPreferences,
  setStoredColdStartPreferences,
} from "@/lib/coldStartPreferences";
import { PreferenceFlowDone } from "@/components/PreferenceFlowDone";
import { PreferenceFlowForm } from "@/components/PreferenceFlowForm";

interface PreferenceFlowProps {
  onComplete?: () => void;
}

export function PreferenceFlow({ onComplete }: PreferenceFlowProps) {
  const stored = getStoredColdStartPreferences();
  const [step, setStep] = useState<"form" | "done">(stored ? "done" : "form");

  const handleSubmit = (prefs: ColdStartPreferences) => {
    setStoredColdStartPreferences(prefs);
    setStep("done");
    onComplete?.();
  };

  if (step === "done") return <PreferenceFlowDone />;

  return (
    <PreferenceFlowForm
      initialGoal={stored?.goal ?? ""}
      initialDaysPerWeek={stored?.daysPerWeek ?? 3}
      initialInjuries={stored?.injuriesOrConstraints ?? ""}
      onSubmit={handleSubmit}
    />
  );
}
