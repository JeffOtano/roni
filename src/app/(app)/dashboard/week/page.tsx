"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { EnrichedWeekPlan } from "@/components/WeekView";
import { WeekView } from "@/components/WeekView";
import { WeekViewSkeleton } from "@/components/WeekViewSkeleton";
import { DashboardCardError } from "@/components/DashboardCardError";
import { useActionData } from "@/hooks/useActionData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ErrorAlert } from "@/components/ErrorAlert";
import { CalendarCheck, Loader2 } from "lucide-react";

const CHAT_PROMPT_AFTER_PROGRAM = "My week is programmed. What should I know?";

export default function WeekPage() {
  const enrichedAction = useAction(api.weekPlanEnriched.getWeekPlanEnriched);
  const {
    state: planState,
    refetch,
    lastUpdatedAt,
  } = useActionData<EnrichedWeekPlan | null>(enrichedAction);

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
      refetch();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to program your week.");
    } finally {
      setIsProgramming(false);
    }
  }, [programMyWeek, refetch]);

  const plan =
    planState.status === "success" || planState.status === "refreshing" ? planState.data : null;
  const showCta = shouldShowProgramCta(planState);

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
                <AlertDescription>Your week is programmed. Refreshing...</AlertDescription>
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
                  Programming...
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

      {planState.status === "loading" && <WeekViewSkeleton />}
      {planState.status === "error" && <DashboardCardError title="Week Plan" onRetry={refetch} />}
      {(planState.status === "success" || planState.status === "refreshing") && (
        <WeekView plan={plan} />
      )}

      {lastUpdatedAt && planState.status !== "loading" && planState.status !== "error" && (
        <p className="mt-3 text-[10px] text-muted-foreground/60">
          Synced with Tonal {formatRelativeTime(lastUpdatedAt)}
        </p>
      )}
    </div>
  );
}

function shouldShowProgramCta(state: { status: string; data?: EnrichedWeekPlan | null }): boolean {
  if (state.status === "loading") return false;
  if (state.status === "error") return false;

  const data = "data" in state ? state.data : null;
  if (data === null || data === undefined) return true;
  return data.days.every((d) => d.sessionType === "rest");
}

function formatRelativeTime(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}
