"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "./JsonViewer";

const ENDPOINTS = [
  { value: "profile", label: "Profile", needsId: false, paginated: false },
  { value: "strengthScores", label: "Strength Scores", needsId: false, paginated: false },
  {
    value: "strengthDistribution",
    label: "Strength Distribution",
    needsId: false,
    paginated: false,
  },
  { value: "strengthHistory", label: "Strength History", needsId: false, paginated: false },
  { value: "muscleReadiness", label: "Muscle Readiness", needsId: false, paginated: false },
  { value: "workoutActivities", label: "Workout Activities", needsId: false, paginated: true },
  { value: "workoutDetail", label: "Workout Detail", needsId: true, paginated: false },
  { value: "customWorkouts", label: "Custom Workouts", needsId: false, paginated: false },
  { value: "externalActivities", label: "External Activities", needsId: false, paginated: false },
  { value: "formattedSummary", label: "Formatted Summary", needsId: true, paginated: false },
] as const;

type EndpointResult = {
  status: number;
  data: unknown;
  timing: number;
  source: "cache" | "api";
};

export function ApiExplorer() {
  const callEndpoint = useAction(api.devToolsActions.callTonalEndpoint);

  const [endpoint, setEndpoint] = useState<string>(ENDPOINTS[0].value);
  const [raw, setRaw] = useState(false);
  const [id, setId] = useState("");
  const [offset, setOffset] = useState("0");
  const [limit, setLimit] = useState("20");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EndpointResult | null>(null);

  const selected = ENDPOINTS.find((e) => e.value === endpoint)!;

  const handleSend = async () => {
    setLoading(true);
    setResult(null);
    try {
      const params: { id?: string; offset?: number; limit?: number } = {};
      if (selected.needsId && id) params.id = id;
      if (selected.paginated) {
        params.offset = Number(offset) || 0;
        params.limit = Number(limit) || 20;
      }
      const res = await callEndpoint({
        endpoint,
        raw,
        params: Object.keys(params).length > 0 ? params : undefined,
      });
      setResult(res as EndpointResult);
    } catch (err) {
      setResult({
        status: 500,
        data: { error: err instanceof Error ? err.message : String(err) },
        timing: 0,
        source: "api",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Endpoint</Label>
          <select
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="mt-1 block rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {ENDPOINTS.map((ep) => (
              <option key={ep.value} value={ep.value}>
                {ep.label}
              </option>
            ))}
          </select>
        </div>

        {selected.needsId && (
          <div>
            <Label className="text-xs">ID</Label>
            <Input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="activityId or summaryId"
              className="mt-1 w-56"
            />
          </div>
        )}

        {selected.paginated && (
          <>
            <div>
              <Label className="text-xs">Offset</Label>
              <Input
                type="number"
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
                className="mt-1 w-20"
              />
            </div>
            <div>
              <Label className="text-xs">Limit</Label>
              <Input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="mt-1 w-20"
              />
            </div>
          </>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={raw}
            onChange={(e) => setRaw(e.target.checked)}
            className="rounded border-border"
          />
          Raw (bypass cache)
        </label>

        <Button onClick={handleSend} disabled={loading} size="sm">
          {loading ? "Sending..." : "Send"}
        </Button>
      </div>

      {result && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant={result.status === 200 ? "default" : "destructive"}>
              {result.status}
            </Badge>
            <Badge variant="outline">{result.source}</Badge>
            <span className="text-xs text-muted-foreground">{result.timing}ms</span>
          </div>
          <JsonViewer data={result.data} label="Response" defaultExpanded />
        </div>
      )}
    </div>
  );
}
