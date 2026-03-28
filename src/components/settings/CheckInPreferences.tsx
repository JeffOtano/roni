"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAnalytics } from "@/lib/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "every_other_day", label: "Every other day" },
  { value: "weekly", label: "Weekly" },
] as const;

type Frequency = (typeof FREQUENCY_OPTIONS)[number]["value"];

export function CheckInPreferences() {
  const { track } = useAnalytics();
  const prefs = useQuery(api.checkIns.getPreferences, {});
  const updatePreferences = useMutation(api.checkIns.updatePreferences);

  if (!prefs) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-8 w-full animate-pulse rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {/* Enable/disable toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {prefs.enabled ? (
              <Bell className="size-4 text-primary" />
            ) : (
              <BellOff className="size-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {prefs.enabled ? "Check-ins enabled" : "Check-ins disabled"}
              </p>
              <p className="text-xs text-muted-foreground">
                {prefs.enabled
                  ? "Your coach will send proactive messages"
                  : "You won't receive proactive messages"}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updatePreferences({ enabled: !prefs.enabled })
                .then(() => {
                  track("check_in_preferences_changed", {
                    enabled: !prefs.enabled,
                    frequency: prefs.frequency,
                  });
                  toast.success("Preferences saved");
                })
                .catch(() => toast.error("Failed to save"))
            }
          >
            {prefs.enabled ? "Disable" : "Enable"}
          </Button>
        </div>

        {/* Frequency selector - only shown when enabled */}
        {prefs.enabled && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-xs font-semibold text-muted-foreground">Frequency</p>
            <div className="flex gap-2">
              {FREQUENCY_OPTIONS.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={prefs.frequency === value ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    updatePreferences({ frequency: value as Frequency })
                      .then(() => {
                        track("check_in_preferences_changed", {
                          enabled: prefs.enabled,
                          frequency: value,
                        });
                        toast.success("Preferences saved");
                      })
                      .catch(() => toast.error("Failed to save"))
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
