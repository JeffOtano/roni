"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAnalytics } from "@/lib/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  exercisesToCsv,
  externalActivitiesToCsv,
  strengthScoresToCsv,
  workoutsToCsv,
} from "./csvExport";

type ExportFormat = "json" | "csv-workouts" | "csv-exercises" | "csv-strength" | "csv-activities";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  json: "All Data (JSON)",
  "csv-workouts": "Workout History (CSV)",
  "csv-exercises": "Exercise Details (CSV)",
  "csv-strength": "Strength Scores (CSV)",
  "csv-activities": "External Activities (CSV)",
};

const FORMAT_FILENAMES: Record<ExportFormat, (date: string) => string> = {
  json: (d) => `tonal-coach-export-${d}.json`,
  "csv-workouts": (d) => `tonal-coach-workouts-${d}.csv`,
  "csv-exercises": (d) => `tonal-coach-exercises-${d}.csv`,
  "csv-strength": (d) => `tonal-coach-strength-scores-${d}.csv`,
  "csv-activities": (d) => `tonal-coach-external-activities-${d}.csv`,
};

export function DataExport() {
  const { track } = useAnalytics();
  const exportData = useAction(api.dataExport.exportData);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [format, setFormat] = useState<ExportFormat>("json");

  async function handleExport() {
    setStatus("loading");
    setErrorMessage("");

    try {
      const data = await exportData({});

      let content: string;
      let mimeType: string;
      switch (format) {
        case "json":
          content = JSON.stringify(data, null, 2);
          mimeType = "application/json";
          break;
        case "csv-workouts":
          content = workoutsToCsv(data.completedWorkouts);
          mimeType = "text/csv";
          break;
        case "csv-exercises":
          content = exercisesToCsv(data.exercisePerformance);
          mimeType = "text/csv";
          break;
        case "csv-strength":
          content = strengthScoresToCsv(data.strengthScoreSnapshots);
          mimeType = "text/csv";
          break;
        case "csv-activities":
          content = externalActivitiesToCsv(data.externalActivities);
          mimeType = "text/csv";
          break;
        default: {
          const _exhaustive: never = format;
          throw new Error(`Unknown export format: ${_exhaustive}`);
        }
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split("T")[0];

      const a = document.createElement("a");
      a.href = url;
      a.download = FORMAT_FILENAMES[format](date);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      track("data_export_requested");
      toast.success("Data exported");

      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Export failed.");
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Download className="size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Export My Data</p>
            <p className="text-xs text-muted-foreground">
              Download all your data as JSON or workout history as CSV
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            aria-label="Export format"
          >
            {Object.entries(FORMAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={status === "loading"}
          >
            {status === "loading" ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 size-3.5" />
            )}
            Export
          </Button>
        </div>

        {status === "error" && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
