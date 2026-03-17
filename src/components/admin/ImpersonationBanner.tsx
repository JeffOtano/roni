"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Loader2, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImpersonationBanner() {
  const status = useQuery(api.admin.getImpersonationStatus);
  const stopImpersonating = useMutation(api.admin.stopImpersonating);
  const [stopping, setStopping] = useState(false);

  // null = not admin or not authenticated; also hide when not impersonating
  if (!status || !status.isImpersonating || !status.impersonatingUser) {
    return null;
  }

  const { impersonatingUser } = status;
  const displayName = impersonatingUser.name ?? impersonatingUser.email ?? "Unknown user";

  async function handleStop() {
    setStopping(true);
    try {
      await stopImpersonating();
    } finally {
      setStopping(false);
    }
  }

  return (
    <div
      role="alert"
      className="relative z-50 flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-sm"
    >
      <ShieldAlert className="size-4 shrink-0 text-amber-400" />
      <span className="min-w-0 flex-1 truncate text-amber-300">
        <span className="font-semibold">Viewing as:</span> {displayName}
        {impersonatingUser.name && impersonatingUser.email && (
          <span className="text-amber-300/60"> ({impersonatingUser.email})</span>
        )}
      </span>
      <Button
        variant="ghost"
        size="xs"
        onClick={handleStop}
        disabled={stopping}
        className="shrink-0 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200"
      >
        {stopping ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
        Stop
      </Button>
      {/* Bottom glow line for visual emphasis */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
    </div>
  );
}
