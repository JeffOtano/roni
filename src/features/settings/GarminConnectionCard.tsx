"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link2, Loader2, Unlink } from "lucide-react";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function GarminConnectionCard() {
  const status = useQuery(api.garmin.connections.getMyGarminStatus, {});
  const startOAuth = useAction(api.garmin.oauthFlow.startGarminOAuth);
  const disconnect = useMutation(api.garmin.connections.disconnectMyGarmin);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await startOAuth({});
      if (!result.success) {
        setError(result.error);
        setBusy(false);
        return;
      }
      window.location.href = result.authorizeUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start Garmin OAuth");
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await disconnect({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setBusy(false);
    }
  };

  if (status === undefined) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading Garmin status…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        {status.state === "active" ? (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Connected</p>
              <p className="truncate text-sm text-muted-foreground">
                Garmin user {status.garminUserId} · since {formatDate(status.connectedAt)}
              </p>
              {status.permissions.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground/80">
                  Permissions: {status.permissions.join(", ")}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={handleDisconnect}
            >
              <Unlink className="size-3.5" />
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {status.state === "disconnected" ? "Disconnected" : "Not connected"}
              </p>
              <p className="text-sm text-muted-foreground">
                {status.state === "disconnected"
                  ? `Disconnected ${formatDate(status.disconnectedAt)}${
                      status.reason ? ` (${status.reason.replaceAll("_", " ")})` : ""
                    }`
                  : "Sync Garmin activities, sleep, HRV, and stress into Roni."}
              </p>
            </div>
            <Button size="sm" className="gap-1.5" disabled={busy} onClick={handleConnect}>
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Link2 className="size-3.5" />
              )}
              Connect Garmin
            </Button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
