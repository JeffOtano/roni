"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Check } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";
import { getStoredColdStartPreferences } from "@/lib/coldStartPreferences";
import { cn } from "@/lib/utils";
import { ConnectStep } from "./ConnectStep";
import { PreferencesStep } from "./PreferencesStep";
import { ReadyStep } from "./ReadyStep";

type Step = 1 | 2 | 3;

const STEP_LABELS = [
  { num: 1 as const, label: "Connect Tonal" },
  { num: 2 as const, label: "Preferences" },
  { num: 3 as const, label: "Ready" },
];

export default function OnboardingPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const router = useRouter();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  if (authLoading) return <PageLoader />;
  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  // Wait for user data before deciding initial step
  if (me === undefined) return <PageLoader />;

  return (
    <OnboardingFlow
      hasTonalProfile={!!me?.hasTonalProfile}
      firstName={me?.tonalName?.split(" ")[0]}
    />
  );
}

function OnboardingFlow({
  hasTonalProfile,
  firstName,
}: {
  readonly hasTonalProfile: boolean;
  readonly firstName: string | undefined;
}) {
  const hasPrefs = !!getStoredColdStartPreferences();

  // Determine initial step based on existing state
  const initialStep: Step = !hasTonalProfile ? 1 : !hasPrefs ? 2 : 3;
  const [step, setStep] = useState<Step>(initialStep);

  return (
    <div className="w-full max-w-lg">
      <StepIndicator currentStep={step} />
      {step === 1 && <ConnectStep onComplete={() => setStep(2)} />}
      {step === 2 && <PreferencesStep onComplete={() => setStep(3)} />}
      {step === 3 && <ReadyStep firstName={firstName} />}
    </div>
  );
}

function StepIndicator({ currentStep }: { readonly currentStep: Step }) {
  return (
    <div className="mb-10 flex items-center gap-2">
      {STEP_LABELS.map(({ num, label }, i) => (
        <Fragment key={num}>
          {i > 0 && (
            <div
              className={cn(
                "h-px flex-1 transition-colors duration-500",
                num <= currentStep ? "bg-primary" : "bg-border",
              )}
            />
          )}
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                num < currentStep &&
                  "bg-primary text-primary-foreground shadow-md shadow-primary/25",
                num === currentStep &&
                  "border-2 border-primary text-primary shadow-md shadow-primary/20",
                num > currentStep && "border border-border text-muted-foreground",
              )}
            >
              {num < currentStep ? <Check className="size-4" /> : num}
            </div>
            <span
              className={cn(
                "hidden text-sm font-medium sm:inline transition-colors duration-300",
                num <= currentStep ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
