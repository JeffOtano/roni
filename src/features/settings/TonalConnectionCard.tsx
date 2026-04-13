"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ReconnectModal } from "@/components/ReconnectModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link2, Loader2, RefreshCw } from "lucide-react";

const TONAL_REFRESH_RATE_LIMIT_MINUTES = 1;

export type TonalConnectionState =
  | {
      readonly state: "disconnected";
    }
  | {
      readonly state: "connected";
      readonly tonalEmail: string;
      readonly tonalName?: string;
      readonly tonalTokenExpired: boolean;
    }
  | {
      readonly state: "connectedWithoutEmail";
      readonly tonalName?: string;
      readonly tonalTokenExpired: boolean;
    };

type TonalConnectionCardProps = {
  readonly connection: TonalConnectionState;
};

type RefreshNotice = {
  readonly tone: "success" | "warning" | "error";
  readonly message: string;
};

function buildRefreshNotice(result: {
  readonly newWorkouts: number;
  readonly totalActivities: number;
}): RefreshNotice {
  if (result.totalActivities === 0) {
    return {
      tone: "warning",
      message: "Refresh finished, but Tonal still returned no workout history.",
    };
  }

  if (result.newWorkouts > 0) {
    return {
      tone: "success",
      message: `Tonal data refreshed. Synced ${result.newWorkouts} new workout${result.newWorkouts === 1 ? "" : "s"}.`,
    };
  }

  return {
    tone: "success",
    message: "Tonal data refreshed.",
  };
}

function buildRefreshErrorMessage(
  error: "session_expired" | "not_connected" | "rate_limited",
): string {
  if (error === "session_expired") {
    return "Your Tonal session expired. Reconnect to refresh data.";
  }

  if (error === "not_connected") {
    return "Connect Tonal before trying to refresh your data.";
  }

  // Keep this in sync with the refreshTonalData limiter in convex/rateLimits.ts.
  if (error === "rate_limited") {
    return `Refresh is rate-limited. Try again in ${TONAL_REFRESH_RATE_LIMIT_MINUTES} minute${TONAL_REFRESH_RATE_LIMIT_MINUTES === 1 ? "" : "s"}.`;
  }

  const _exhaustive: never = error;
  return _exhaustive;
}

function buildUnexpectedRefreshErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Failed to refresh Tonal data.";
  const normalized = message.toLowerCase();

  if (normalized.includes("session expired")) {
    return buildRefreshErrorMessage("session_expired");
  }

  if (normalized.includes("rate limit")) {
    return buildRefreshErrorMessage("rate_limited");
  }

  return "Failed to refresh Tonal data. Try again or reconnect.";
}

export function TonalConnectionCard({ connection }: TonalConnectionCardProps) {
  const refreshTonalData = useAction(api.tonal.refreshPublic.refreshTonalData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reconnectOpen, setReconnectOpen] = useState(false);
  const [notice, setNotice] = useState<RefreshNotice | null>(null);

  async function handleRefresh() {
    setIsRefreshing(true);
    setNotice(null);

    try {
      const result = await refreshTonalData({});

      if ("error" in result) {
        setNotice({
          tone: "error",
          message: buildRefreshErrorMessage(result.error),
        });
        return;
      }

      setNotice(buildRefreshNotice(result));
    } catch (error) {
      setNotice({
        tone: "error",
        message: buildUnexpectedRefreshErrorMessage(error),
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  if (connection.state === "disconnected") {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link2 className="size-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Not Connected</p>
                <p className="text-sm text-muted-foreground">
                  Link your Tonal account to get started
                </p>
              </div>
            </div>
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href="/connect-tonal" />}
            >
              Connect
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const refreshDisabled = connection.tonalTokenExpired || isRefreshing;

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(74,222,128,0.4)]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Connected</p>
              {connection.tonalName && (
                <p className="truncate text-sm text-muted-foreground">{connection.tonalName}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={handleRefresh}
              disabled={refreshDisabled}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="size-3.5" />
                  Refresh Data
                </>
              )}
            </Button>
            {connection.state === "connected" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReconnectOpen(true)}
              >
                Reconnect
              </Button>
            ) : (
              <Button
                nativeButton={false}
                type="button"
                variant="outline"
                size="sm"
                render={<Link href="/connect-tonal" />}
              >
                Reconnect
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Refresh pulls your latest workouts, volume, and strength history from Tonal.
            {connection.tonalTokenExpired &&
              " Your current Tonal session has expired, so reconnect first."}
          </p>

          {notice && (
            <p
              className={
                notice.tone === "error"
                  ? "text-xs text-destructive"
                  : notice.tone === "warning"
                    ? "text-xs text-amber-600 dark:text-amber-400"
                    : "text-xs text-green-600 dark:text-green-400"
              }
            >
              {notice.message}
            </p>
          )}
        </CardContent>
      </Card>

      {connection.state === "connected" && (
        <ReconnectModal
          tonalEmail={connection.tonalEmail}
          open={reconnectOpen}
          onDismiss={() => setReconnectOpen(false)}
        />
      )}
    </>
  );
}
