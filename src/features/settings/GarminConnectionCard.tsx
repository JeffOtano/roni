"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle2, Download, Info, Link2, Loader2, TriangleAlert, Unlink } from "lucide-react";
import { formatGarminBackfillNotice } from "./garminBackfillCopy";

// Garmin's user-level backfill cap is "1 month since first connection",
// so requesting 30 days keeps the call inside a single chunk and inside
// the documented per-user limit.
const BACKFILL_DAYS = 30;

export type GarminConnectionNotice = {
  kind: "success" | "error" | "warning";
  message: string;
};

type GarminAction = "connect" | "disconnect" | "backfill" | null;

const LABEL_ACRONYMS: Record<string, string> = {
  API: "API",
  GPS: "GPS",
  HRV: "HRV",
  MCT: "MCT",
  OAUTH: "OAuth",
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPermission(permission: string): string {
  return permission
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (word) =>
        LABEL_ACRONYMS[word.toUpperCase()] ??
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");
}

function formatDisconnectReason(
  reason?: "user_disconnected" | "permission_revoked" | "token_invalid",
) {
  if (!reason) return "";
  return formatPermission(reason);
}

function StatusMessage({ notice }: { notice: GarminConnectionNotice }) {
  const isError = notice.kind === "error";
  const isWarning = notice.kind === "warning";
  const Icon = isError ? TriangleAlert : notice.kind === "warning" ? Info : CheckCircle2;

  return (
    <Alert
      variant={isError ? "destructive" : "default"}
      className={cn(
        "mt-3",
        isWarning && "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
      )}
      aria-live={isError ? "assertive" : "polite"}
    >
      <Icon className="size-4" aria-hidden="true" />
      <AlertDescription className={cn(isWarning && "text-amber-900 dark:text-amber-200")}>
        {notice.message}
      </AlertDescription>
    </Alert>
  );
}

interface GarminConnectionCardProps {
  callbackNotice?: GarminConnectionNotice;
}

export function GarminConnectionCard({ callbackNotice }: GarminConnectionCardProps = {}) {
  const status = useQuery(api.garmin.connections.getMyGarminStatus, {});
  const startOAuth = useAction(api.garmin.oauthFlow.startGarminOAuth);
  const disconnect = useAction(api.garmin.registration.disconnectMyGarmin);
  const requestBackfill = useAction(api.garmin.backfill.requestGarminBackfill);

  const [activeAction, setActiveAction] = useState<GarminAction>(null);
  const [message, setMessage] = useState<GarminConnectionNotice | null>(null);
  const busy = activeAction !== null;

  const handleConnect = async () => {
    setActiveAction("connect");
    setMessage(null);
    try {
      const result = await startOAuth({});
      if (!result.success) {
        setMessage({ kind: "error", message: result.error });
        setActiveAction(null);
        return;
      }
      window.location.href = result.authorizeUrl;
    } catch (e) {
      setMessage({
        kind: "error",
        message: e instanceof Error ? e.message : "Failed to start Garmin OAuth",
      });
      setActiveAction(null);
    }
  };

  const handleDisconnect = async () => {
    setActiveAction("disconnect");
    setMessage(null);
    try {
      const result = await disconnect({});
      if (!result.success) {
        setMessage({ kind: "error", message: result.error });
        return;
      }
      setMessage({
        kind: result.warning ? "warning" : "success",
        message: result.warning ?? "Garmin disconnected.",
      });
    } catch (e) {
      setMessage({
        kind: "error",
        message: e instanceof Error ? e.message : "Failed to disconnect",
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleBackfill = async () => {
    setActiveAction("backfill");
    setMessage(null);
    try {
      const result = await requestBackfill({ days: BACKFILL_DAYS });
      if (!result.success) {
        setMessage({ kind: "error", message: result.error });
        return;
      }
      setMessage(formatGarminBackfillNotice(BACKFILL_DAYS, result));
    } catch (e) {
      setMessage({
        kind: "error",
        message: e instanceof Error ? e.message : "Backfill failed",
      });
    } finally {
      setActiveAction(null);
    }
  };

  const visibleMessage = message ?? callbackNotice ?? null;

  if (status === undefined) {
    return (
      <Card>
        <CardContent
          className="flex items-center gap-2 p-4 text-sm text-muted-foreground"
          aria-busy="true"
        >
          <Loader2 className="size-4 animate-spin" />
          Loading Garmin status...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        {status.state === "active" ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">Connected</p>
                <Badge variant="secondary">Garmin</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Since {formatDate(status.connectedAt)}
              </p>
              {status.permissions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {status.permissions.map((permission) => (
                    <Badge key={permission} variant="outline">
                      {formatPermission(permission)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:min-w-36">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                disabled={busy}
                onClick={handleBackfill}
              >
                {activeAction === "backfill" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                {activeAction === "backfill" ? "Syncing..." : `Sync last ${BACKFILL_DAYS}d`}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                disabled={busy}
                onClick={handleDisconnect}
              >
                {activeAction === "disconnect" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Unlink className="size-3.5" />
                )}
                {activeAction === "disconnect" ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {status.state === "disconnected" ? "Disconnected" : "Not connected"}
              </p>
              <p className="text-sm text-muted-foreground">
                {status.state === "disconnected"
                  ? `Disconnected ${formatDate(status.disconnectedAt)}${
                      status.reason ? ` (${formatDisconnectReason(status.reason)})` : ""
                    }`
                  : "Sync Garmin activities, sleep, HRV, and stress into Roni."}
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 sm:min-w-36"
              disabled={busy}
              onClick={handleConnect}
            >
              {activeAction === "connect" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Link2 className="size-3.5" />
              )}
              {activeAction === "connect" ? "Connecting..." : "Connect Garmin"}
            </Button>
          </div>
        )}

        {visibleMessage && <StatusMessage notice={visibleMessage} />}
      </CardContent>
    </Card>
  );
}
