"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ErrorAlert";
import { Calendar, CheckCircle2, Loader2, Unlink } from "lucide-react";
import { toast } from "sonner";

interface CalendarIntegrationProps {
  /** Success flag from OAuth redirect (e.g. ?calendar_connected=true) */
  justConnected?: boolean;
  /** Error message from OAuth redirect (e.g. ?calendar_error=...) */
  oauthError?: string | null;
}

export function CalendarIntegration({ justConnected, oauthError }: CalendarIntegrationProps) {
  const settings = useQuery(api.calendar.getCalendarSettings);
  const getAuthUrl = useAction(api.calendarActions.getAuthUrl);
  const disconnect = useMutation(api.calendar.disconnectCalendar);

  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(oauthError ?? null);
  const [showSuccess, setShowSuccess] = useState(justConnected === true);

  // Loading skeleton
  if (settings === undefined) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // settings is null when user has no profile
  if (settings === null) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Calendar className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Connect your Tonal account first to enable calendar integration.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      const url = await getAuthUrl({ origin: window.location.origin });
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start Google sign-in";
      setError(message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    setDisconnecting(true);
    try {
      await disconnect();
      setShowSuccess(false);
      toast.success("Calendar disconnected");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect calendar";
      setError(message);
    } finally {
      setDisconnecting(false);
    }
  };

  if (settings.connected) {
    return (
      <Card>
        <CardContent className="space-y-4 p-4">
          {/* Just-connected success banner */}
          {showSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Google Calendar connected successfully.</span>
              <button
                type="button"
                onClick={() => setShowSuccess(false)}
                className="ml-auto text-xs text-green-600/60 transition-colors hover:text-green-600 dark:text-green-400/60 dark:hover:text-green-400"
                aria-label="Dismiss success message"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Connected indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(74,222,128,0.4)]" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">Google Calendar connected</p>
                {settings.calendarId && settings.calendarId !== "primary" && (
                  <p className="text-sm text-muted-foreground">{settings.calendarId}</p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground transition-colors duration-200 hover:text-destructive"
              onClick={handleDisconnect}
              disabled={disconnecting}
              aria-label="Disconnect Google Calendar"
            >
              {disconnecting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Unlink className="size-3.5" />
              )}
              Disconnect
            </Button>
          </div>

          {/* Info about calendar integration */}
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Your coach can check your calendar for conflicts and add workouts when scheduling.
            </p>
          </div>

          {error && <ErrorAlert message={error} />}
        </CardContent>
      </Card>
    );
  }

  // Disconnected state
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Connect Google Calendar</p>
              <p className="text-sm text-muted-foreground">
                Automatically add workouts to your calendar
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="transition-all duration-200 hover:border-primary/40"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Connecting...</span>
              </span>
            ) : (
              "Connect"
            )}
          </Button>
        </div>
        {error && (
          <div className="mt-3">
            <ErrorAlert message={error} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
