"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Check } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";
import { useAnalytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { ConnectStep } from "./ConnectStep";
import { PreferencesStep } from "./PreferencesStep";
import { ReadyStep } from "./ReadyStep";
import { GeminiKeyStep } from "./GeminiKeyStep";

type StepId = "connect" | "preferences" | "byok" | "ready";

interface StepDef {
  id: StepId;
  label: string;
}

const BASE_STEPS: readonly StepDef[] = [
  { id: "connect", label: "Connect Tonal" },
  { id: "preferences", label: "Preferences" },
  { id: "ready", label: "Ready" },
];

const BYOK_STEPS: readonly StepDef[] = [
  { id: "connect", label: "Connect Tonal" },
  { id: "preferences", label: "Preferences" },
  { id: "byok", label: "Gemini key" },
  { id: "ready", label: "Ready" },
];

export default function OnboardingPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const router = useRouter();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const byokStatus = useQuery(api.byok.getBYOKStatus, isAuthenticated ? {} : "skip");

  if (authLoading) return <PageLoader />;
  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  if (me === undefined || byokStatus === undefined) return <PageLoader />;

  const needsByokStep = byokStatus.requiresBYOK && !byokStatus.hasKey;
  const steps = needsByokStep ? BYOK_STEPS : BASE_STEPS;

  return (
    <OnboardingFlow
      steps={steps}
      hasTonalProfile={!!me?.hasTonalProfile}
      onboardingCompleted={!!me?.onboardingCompleted}
      needsByokStep={needsByokStep}
      firstName={me?.tonalName?.split(" ")[0]}
    />
  );
}

function pickInitialStepIndex(
  steps: readonly StepDef[],
  hasTonalProfile: boolean,
  onboardingCompleted: boolean,
  needsByokStep: boolean,
): number {
  if (!hasTonalProfile) return steps.findIndex((s) => s.id === "connect");
  if (!onboardingCompleted) return steps.findIndex((s) => s.id === "preferences");
  if (needsByokStep) return steps.findIndex((s) => s.id === "byok");
  return steps.findIndex((s) => s.id === "ready");
}

function OnboardingFlow({
  steps: initialSteps,
  hasTonalProfile,
  onboardingCompleted,
  needsByokStep,
  firstName,
}: {
  readonly steps: readonly StepDef[];
  readonly hasTonalProfile: boolean;
  readonly onboardingCompleted: boolean;
  readonly needsByokStep: boolean;
  readonly firstName: string | undefined;
}) {
  // Freeze steps at mount. Saving the Gemini key mid-flow invalidates the
  // parent's byokStatus query, which would otherwise shrink steps from 4 to
  // 3 on the very tick that advance() bumps stepIndex to 3, leaving the
  // flow rendering BASE_STEPS[3] === undefined (blank screen).
  const [steps] = useState<readonly StepDef[]>(() => initialSteps);
  const [stepIndex, setStepIndex] = useState<number>(() =>
    pickInitialStepIndex(steps, hasTonalProfile, onboardingCompleted, needsByokStep),
  );
  const { track } = useAnalytics();
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    track("onboarding_started");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advance = () => {
    const completed = steps[stepIndex];
    track("onboarding_step_completed", { step: completed.label });

    const nextIndex = stepIndex + 1;
    const nextStep = steps[nextIndex];
    if (nextStep?.id === "ready") {
      track("onboarding_completed", {
        duration_seconds: Math.round((Date.now() - startTimeRef.current) / 1000),
      });
    }

    setStepIndex(nextIndex);
  };

  const currentStep = steps[stepIndex];

  return (
    <div className="w-full max-w-lg">
      <StepIndicator steps={steps} currentIndex={stepIndex} />
      {currentStep?.id === "connect" && <ConnectStep onComplete={advance} />}
      {currentStep?.id === "preferences" && <PreferencesStep onComplete={advance} />}
      {currentStep?.id === "byok" && <GeminiKeyStep onComplete={advance} />}
      {currentStep?.id === "ready" && <ReadyStep firstName={firstName} />}
    </div>
  );
}

function StepIndicator({
  steps,
  currentIndex,
}: {
  readonly steps: readonly StepDef[];
  readonly currentIndex: number;
}) {
  return (
    <div className="mb-10 flex items-center gap-2">
      {steps.map(({ id, label }, i) => {
        const displayNum = i + 1;
        return (
          <Fragment key={id}>
            {i > 0 && (
              <div
                className={cn(
                  "h-px flex-1 transition-colors duration-500",
                  i <= currentIndex ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300",
                  i < currentIndex &&
                    "bg-primary text-primary-foreground shadow-md shadow-primary/25",
                  i === currentIndex &&
                    "border-2 border-primary text-primary shadow-md shadow-primary/20",
                  i > currentIndex && "border border-border text-muted-foreground",
                )}
              >
                {i < currentIndex ? <Check className="size-4" /> : displayNum}
              </div>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline transition-colors duration-300",
                  i <= currentIndex ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
