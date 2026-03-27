"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function PhotoAnalysisToggle() {
  const profile = useQuery(api.account.getFullProfile, {});
  const updateSettings = useMutation(api.account.updateProfileSettings);

  if (profile === undefined) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-10 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (profile === null) return null;

  const enabled = profile.progressPhotoAnalysisEnabled;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {enabled ? (
              <Eye className="size-4 text-primary" />
            ) : (
              <EyeOff className="size-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">AI Progress Photo Analysis</p>
              <p className="text-xs text-muted-foreground">
                Allow AI to analyze your progress photos for body composition changes
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateSettings({ progressPhotoAnalysisEnabled: !enabled })
                .then(() => toast.success("Photo analysis preference saved"))
                .catch(() => toast.error("Failed to save"))
            }
          >
            {enabled ? "Disable" : "Enable"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
