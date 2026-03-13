"use client";

import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { LastTimeAndSuggested } from "../../convex/progressiveOverload";

interface LastTimeSuggestedProps {
  movementIds: string[];
  /** Optional display name per movementId (e.g. from catalog). */
  movementNames?: Record<string, string>;
}

export function LastTimeSuggested({ movementIds, movementNames }: LastTimeSuggestedProps) {
  const runAction = useAction(api.progressiveOverload.getLastTimeAndSuggested);
  const [result, setResult] = useState<LastTimeAndSuggested[] | null>(null);

  const idsKey = movementIds.join(",");

  useEffect(() => {
    if (idsKey === "") return;
    const ids = idsKey.split(",");
    let cancelled = false;
    runAction({ movementIds: ids })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {
        if (!cancelled) setResult(null);
      });
    return () => {
      cancelled = true;
    };
  }, [runAction, idsKey]);

  if (movementIds.length === 0) return null;
  if (result === null || result.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border border-muted/50 bg-muted/20 px-3 py-2 text-xs">
      <p className="mb-1.5 font-medium text-foreground/90">Last time / Try this</p>
      <ul className="space-y-1">
        {result.map((item) => {
          const name = movementNames?.[item.movementId] ?? item.movementId.slice(0, 8);
          return (
            <li key={item.movementId} className="text-muted-foreground">
              <span className="font-medium text-foreground/80">{name}:</span> Last time:{" "}
              {item.lastTimeText}. Suggested: {item.suggestedText}.
              {item.plateauOptions != null && (
                <span className="ml-1 block text-muted-foreground/90">{item.plateauOptions}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
