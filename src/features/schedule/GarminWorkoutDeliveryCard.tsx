"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction, useQuery } from "convex/react";
import { AlertTriangle, CheckCircle2, Loader2, Send, Watch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { GarminWorkoutDeliverySummary } from "../../../convex/garmin/workoutDelivery";

interface GarminWorkoutDeliveryCardProps {
  workoutPlanId: Id<"workoutPlans">;
  scheduledDate: string;
  isPast: boolean;
}

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatShortDate(date: string | number): string {
  const parsed = typeof date === "number" ? new Date(date) : new Date(`${date}T12:00:00Z`);
  return shortDateFormatter.format(parsed);
}

function deliveryLabel(delivery: GarminWorkoutDeliverySummary | undefined): string {
  if (!delivery) return "Checking Garmin...";
  if (delivery.status === "sent") {
    return delivery.sentAt !== undefined
      ? `Sent on ${formatShortDate(delivery.sentAt)}`
      : `Sent for ${formatShortDate(delivery.scheduledDate)}`;
  }
  if (delivery.status === "sending") return "Sending...";
  if (delivery.status === "failed") return "Send failed";
  return "Ready";
}

function actionLabel({
  isLoading,
  isInFlight,
  isSent,
  isPast,
  hasWorkoutPermission,
}: {
  isLoading: boolean;
  isInFlight: boolean;
  isSent: boolean;
  isPast: boolean;
  hasWorkoutPermission: boolean;
}) {
  if (isLoading) return "Checking";
  if (isInFlight) return "Sending";
  if (isSent) return "Sent";
  if (isPast) return "Past date";
  return hasWorkoutPermission ? "Send to Garmin" : "Missing permission";
}

export function GarminWorkoutDeliveryCard({
  workoutPlanId,
  scheduledDate,
  isPast,
}: GarminWorkoutDeliveryCardProps) {
  const [isSending, setIsSending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const connection = useQuery(api.garmin.connections.getMyGarminStatus, {});
  const delivery = useQuery(api.garmin.workoutDelivery.getMyWorkoutDelivery, {
    workoutPlanId,
    scheduledDate,
  });
  const sendToGarmin = useAction(api.garmin.workoutDelivery.sendWorkoutPlanToGarmin);

  const isLoading = connection === undefined || delivery === undefined;
  const isSent = delivery?.status === "sent";
  const isInFlight = isSending || delivery?.status === "sending";
  const isConnected = connection?.state === "active";
  const hasWorkoutPermission =
    connection?.state === "active" && connection.permissions.includes("WORKOUT_IMPORT");
  const canSend = !isLoading && isConnected && hasWorkoutPermission && !isPast && !isSent;
  const visibleError = localError ?? (delivery?.status === "failed" ? delivery.errorReason : null);

  async function handleSend() {
    if (!canSend || isInFlight) return;
    setIsSending(true);
    setLocalError(null);
    try {
      const result = await sendToGarmin({ workoutPlanId, scheduledDate });
      if (!result.success) setLocalError(result.error);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Garmin send failed.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Card size="sm" className="mt-8">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Watch className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Garmin</p>
              <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px]">
                {deliveryLabel(delivery)}
              </Badge>
            </div>
            {visibleError ? (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="size-3" aria-hidden="true" />
                {visibleError}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Scheduled for {formatShortDate(scheduledDate)}
              </p>
            )}
          </div>
        </div>

        {!isConnected && !isLoading ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/settings" />}
          >
            Connect Garmin
          </Button>
        ) : (
          <Button
            type="button"
            variant={isSent ? "secondary" : "default"}
            size="sm"
            disabled={!canSend || isInFlight}
            onClick={handleSend}
          >
            {isInFlight ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : isSent ? (
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            ) : (
              <Send className="size-3.5" aria-hidden="true" />
            )}
            {actionLabel({ isLoading, isInFlight, isSent, isPast, hasWorkoutPermission })}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
