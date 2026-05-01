"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function StatusCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm font-medium">{children}</div>
      </CardContent>
    </Card>
  );
}

function formatCountdown(timestamp: number): string {
  const diff = timestamp - Date.now();
  const absDiff = Math.abs(diff);
  const hours = Math.floor(absDiff / 3_600_000);
  const minutes = Math.floor((absDiff % 3_600_000) / 60_000);
  const label = `${hours}h ${minutes}m`;
  return diff > 0 ? `expires in ${label}` : `expired ${label} ago`;
}

function isExpired(timestamp: number | null): boolean {
  return timestamp != null && timestamp < Date.now();
}

export function TokenHealth() {
  const health = useQuery(api.devTools.getTokenHealth);

  if (health === undefined) {
    return <div className="py-4 text-sm text-muted-foreground">Loading token health...</div>;
  }

  if (health === null) {
    return <div className="py-4 text-sm text-muted-foreground">No Tonal profile found</div>;
  }

  const tokenExpired = isExpired(health.tokenExpiresAt);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatusCard label="Token Expiry">
        {health.tokenExpiresAt ? (
          <div className="flex items-center gap-2">
            <Badge variant={tokenExpired ? "destructive" : "default"}>
              {tokenExpired ? "expired" : "valid"}
            </Badge>
            <span className="text-xs">{formatCountdown(health.tokenExpiresAt)}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">unknown</span>
        )}
      </StatusCard>

      <StatusCard label="Refresh Token">
        <Badge variant={health.hasRefreshToken ? "default" : "destructive"}>
          {health.hasRefreshToken ? "present" : "missing"}
        </Badge>
      </StatusCard>

      <StatusCard label="Refresh Lock">
        <Badge variant={health.refreshLockActive ? "destructive" : "outline"}>
          {health.refreshLockActive ? "active" : "idle"}
        </Badge>
        {health.refreshLockActive && health.refreshLockTimestamp && (
          <span className="ml-1 text-xs text-muted-foreground">
            since {new Date(health.refreshLockTimestamp).toLocaleTimeString()}
          </span>
        )}
      </StatusCard>

      <StatusCard label="Tonal Connected">
        {health.tonalConnectedAt
          ? new Date(health.tonalConnectedAt).toLocaleDateString()
          : "unknown"}
      </StatusCard>

      <StatusCard label="Last Active">{new Date(health.lastActiveAt).toLocaleString()}</StatusCard>
    </div>
  );
}
