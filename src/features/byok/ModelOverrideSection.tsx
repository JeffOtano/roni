"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProviderId } from "../../../convex/ai/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_MODEL_BY_PROVIDER: Record<ProviderId, string> = {
  gemini: "gemini-3-flash-preview",
  claude: "claude-sonnet-4-6",
  openai: "gpt-5.4",
  openrouter: "openrouter/auto",
};

export function ModelOverrideSection({
  provider,
  modelOverride,
  onSave,
}: {
  readonly provider: ProviderId;
  readonly modelOverride: string | null;
  readonly onSave: (args: { modelOverride?: string }) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(modelOverride ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(modelOverride ?? "");
  }, [modelOverride]);

  const defaultModel = DEFAULT_MODEL_BY_PROVIDER[provider];

  const handleSave = async () => {
    setSaving(true);
    try {
      const trimmed = value.trim();
      await onSave({ modelOverride: trimmed || undefined });
      toast.success(trimmed ? "Model override saved" : "Reset to default model");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save model override");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await onSave({ modelOverride: undefined });
      setValue("");
      toast.success("Reset to default model");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset model");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          Advanced
        </button>

        {open && (
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="model-override" className="text-xs text-muted-foreground">
                Model override
              </Label>
              <Input
                id="model-override"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={defaultModel || "Enter model name"}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">Default: {defaultModel}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || value === (modelOverride ?? "")}
              >
                {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Save
              </Button>
              {modelOverride && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="text-sm text-primary underline-offset-4 hover:underline disabled:opacity-50"
                >
                  Reset to default
                </button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
