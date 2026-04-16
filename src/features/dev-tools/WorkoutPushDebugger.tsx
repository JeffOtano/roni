"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "./JsonViewer";
import type { Id } from "../../../convex/_generated/dataModel";

const STATUS_COLORS: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
  draft: "outline",
  pushing: "secondary",
  pushed: "default",
  completed: "default",
  failed: "destructive",
  deleted: "outline",
};

export function WorkoutPushDebugger() {
  const pushes = useQuery(api.devTools.getRecentPushes, {});
  const reconstructPayload = useAction(api.devToolsActions.reconstructPushPayload);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [wireFormat, setWireFormat] = useState<Record<string, unknown>>({});
  const [loadingWire, setLoadingWire] = useState<string | null>(null);

  if (pushes === undefined) {
    return <div className="py-4 text-sm text-muted-foreground">Loading pushes...</div>;
  }

  const handleReconstruct = async (planId: string) => {
    setLoadingWire(planId);
    try {
      const payload = await reconstructPayload({
        planId: planId as Id<"workoutPlans">,
      });
      setWireFormat((prev) => ({ ...prev, [planId]: payload }));
    } catch (err) {
      setWireFormat((prev) => ({
        ...prev,
        [planId]: {
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    } finally {
      setLoadingWire(null);
    }
  };

  return (
    <div className="space-y-2">
      {pushes.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">No workout plans found</div>
      )}

      {pushes.map((push) => (
        <div key={push._id} className="rounded-md border border-border">
          <button
            type="button"
            onClick={() => setExpandedId(expandedId === push._id ? null : push._id)}
            className="flex w-full items-center gap-3 px-3 py-2 text-left"
          >
            <span className="flex-1 text-sm font-medium">{push.title}</span>
            <Badge variant={STATUS_COLORS[push.status] ?? "outline"}>{push.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(push.createdAt).toLocaleDateString()}
            </span>
          </button>

          {expandedId === push._id && (
            <div className="space-y-3 border-t border-border p-3">
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Created: {new Date(push.createdAt).toLocaleString()}</span>
                {push.pushedAt && <span>Pushed: {new Date(push.pushedAt).toLocaleString()}</span>}
                {push.tonalWorkoutId && <span>Tonal ID: {push.tonalWorkoutId}</span>}
                {push.estimatedDuration && <span>Duration: ~{push.estimatedDuration}min</span>}
              </div>

              {push.pushErrorReason && (
                <div className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                  {push.pushErrorReason}
                </div>
              )}

              <JsonViewer data={push.blocks} label="Workout Blocks" />

              <div>
                {wireFormat[push._id] ? (
                  <JsonViewer data={wireFormat[push._id]} label="Wire Format (Tonal API Payload)" />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReconstruct(push._id)}
                    disabled={loadingWire === push._id}
                  >
                    {loadingWire === push._id ? "Reconstructing..." : "Show Wire Format"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
