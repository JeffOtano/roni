"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Doc } from "../../../../../convex/_generated/dataModel";
import { WeekView } from "@/components/WeekView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ErrorAlert } from "@/components/ErrorAlert";
import { CalendarCheck, Loader2 } from "lucide-react";

const CHAT_PROMPT_AFTER_PROGRAM = "My week is programmed. What should I know?";

function isPlanEmpty(plan: Doc<"weekPlans">): boolean {
  return plan.days.every((d) => d.sessionType === "rest");
}

function showProgramCta(plan: Doc<"weekPlans"> | null | undefined): boolean {
  if (plan === undefined) return false;
  if (plan === null) return true;
  return isPlanEmpty(plan);
}

export default function WeekPage() {
  const plan = useQuery(api.weekPlans.getCurrentWeekPlan);
  const programMyWeek = useAction(api.weekPlans.programMyWeek);

  const [isProgramming, setIsProgramming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successShown, setSuccessShown] = useState(false);

  const handleProgramWeek = useCallback(async () => {
    setErrorMessage(null);
    setIsProgramming(true);
    try {
      await programMyWeek();
      setSuccessShown(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to program your week.");
    } finally {
      setIsProgramming(false);
    }
  }, [programMyWeek]);

  const showCta = showProgramCta(plan);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Week view</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your training week at a glance. Session type and status per day.
        </p>
      </div>

      {showCta && (
        <Card className="mb-6">
          <CardHeader>
            <div
              className="flex size-10 items-center justify-center rounded-xl shadow-lg shadow-primary/10"
              style={{
                background: "linear-gradient(135deg, oklch(0.78 0.154 195), oklch(0.6 0.22 300))",
              }}
            >
              <CalendarCheck className="size-5 text-white" />
            </div>
            <CardTitle className="tracking-tight">Program your week</CardTitle>
            <CardDescription>
              Get a full week of workouts built for you and pushed to your Tonal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && <ErrorAlert message={errorMessage} onRetry={handleProgramWeek} />}
            {successShown && showCta && (
              <Alert>
                <AlertDescription>Your week is programmed. Refreshing…</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={handleProgramWeek}
              disabled={isProgramming}
              className="w-full sm:w-auto"
            >
              {isProgramming ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Programming…
                </>
              ) : (
                "Program my week"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {successShown && !showCta && (
        <Alert className="mb-6">
          <AlertDescription>
            Your week is programmed.{" "}
            <Link
              href={`/chat?prompt=${encodeURIComponent(CHAT_PROMPT_AFTER_PROGRAM)}`}
              className="font-medium underline underline-offset-2 hover:text-foreground"
            >
              Ask your coach what you should know.
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <WeekView plan={plan ?? null} />
    </div>
  );
}
