"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAnalytics } from "@/lib/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { toast } from "sonner";

const ACCESSORIES = [
  { key: "smartHandles", label: "Smart Handles" },
  { key: "smartBar", label: "Smart Bar" },
  { key: "rope", label: "Rope" },
  { key: "roller", label: "Roller" },
  { key: "weightBar", label: "Weight Bar" },
  { key: "pilatesLoops", label: "Pilates Loops" },
  { key: "ankleStraps", label: "Ankle Straps" },
] as const;

type AccessoryKey = (typeof ACCESSORIES)[number]["key"];

type OwnedAccessories = Record<AccessoryKey, boolean>;

const ALL_OWNED: OwnedAccessories = {
  smartHandles: true,
  smartBar: true,
  rope: true,
  roller: true,
  weightBar: true,
  pilatesLoops: true,
  ankleStraps: true,
};

export function EquipmentSettings() {
  const { track } = useAnalytics();
  const profile = useQuery(api.account.getFullProfile, {});
  const updateSettings = useMutation(api.account.updateProfileSettings);

  if (profile === undefined) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (profile === null) return null;

  const owned: OwnedAccessories =
    (profile.ownedAccessories as OwnedAccessories | null) ?? ALL_OWNED;

  async function handleToggle(key: AccessoryKey) {
    const updated: OwnedAccessories = { ...owned, [key]: !owned[key] };
    await updateSettings({ ownedAccessories: updated });
    track("equipment_settings_changed");
    toast.success("Equipment updated");
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <p className="text-xs text-muted-foreground">
          Select the accessories you have. Workouts will only include exercises for your available
          equipment.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ACCESSORIES.map(({ key, label }) => {
            const isOwned = owned[key];
            return (
              <Button
                key={key}
                variant={isOwned ? "default" : "outline"}
                size="sm"
                className="justify-start gap-2"
                aria-pressed={isOwned}
                onClick={() => handleToggle(key)}
              >
                {isOwned && <Check className="size-3.5" />}
                {label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
