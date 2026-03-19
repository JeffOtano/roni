"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const TOTAL_BETA_SPOTS = 50;

/**
 * Live counter showing remaining free beta spots.
 * Reads from Convex in real-time so the number ticks down as people sign up.
 */
export function BetaCounter() {
  const userCount = useQuery(api.userProfiles.getBetaUserCount);

  if (userCount === undefined) return null;

  const remaining = Math.max(TOTAL_BETA_SPOTS - userCount, 0);

  if (remaining === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <span
          className="inline-block size-2 rounded-full"
          style={{ background: "oklch(0.65 0.2 25)" }}
        />
        Beta is full
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <span
        className="inline-block size-2 animate-pulse rounded-full"
        style={{ background: "oklch(0.78 0.154 195)" }}
      />
      <span className="font-semibold text-foreground">{remaining}</span>
      <span>of {TOTAL_BETA_SPOTS} free beta spots remaining</span>
    </span>
  );
}
