"use client";

import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ChevronDown, ChevronRight, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { ProviderId } from "../../../convex/ai/providers";
import type { ProviderSettings } from "../../../convex/byok";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProviderKeyDisplay } from "./ProviderKeyDisplay";

// Keep in sync with PROVIDERS in convex/ai/providers.ts
// Client-side UI metadata only (no server-side createLanguageModel functions)
const PROVIDER_UI_CONFIG: Record<ProviderId, { label: string; primaryModel: string }> = {
  gemini: { label: "Google Gemini", primaryModel: "gemini-3-flash-preview" },
  claude: { label: "Anthropic Claude", primaryModel: "claude-sonnet-4-5-20250514" },
  openai: { label: "OpenAI", primaryModel: "gpt-4o" },
  openrouter: { label: "OpenRouter", primaryModel: "" },
};

const PROVIDER_OPTIONS: { id: ProviderId; label: string }[] = [
  { id: "gemini", label: "Google Gemini" },
  { id: "claude", label: "Anthropic Claude" },
  { id: "openai", label: "OpenAI" },
  { id: "openrouter", label: "OpenRouter" },
];

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function ProviderSection() {
  const byokStatus = useQuery(api.byok.getBYOKStatus, {});
  const getSettings = useAction(api.byokProvider.getProviderSettings);
  const saveKey = useAction(api.byok.saveProviderKey);
  const removeKey = useMutation(api.byok.removeProviderKey);
  const selectProvider = useMutation(api.byok.setSelectedProvider);
  const setModelOverrideMut = useMutation(api.byok.setModelOverride);

  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [viewProvider, setViewProvider] = useState<ProviderId>("gemini");
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isOptingIn, setIsOptingIn] = useState(false);

  const refreshSettings = useCallback(async () => {
    const result = await getSettings({});
    if (result) {
      setSettings(result);
      setViewProvider(result.selectedProvider);
    }
    return result;
  }, [getSettings]);

  useEffect(() => {
    if (byokStatus === undefined) return;
    let cancelled = false;
    getSettings({})
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setSettings(result);
          setViewProvider(result.selectedProvider);
        } else {
          setSettings(null);
        }
      })
      .catch(() => {
        if (!cancelled) setSettings(null);
      });
    return () => {
      cancelled = true;
    };
  }, [byokStatus, getSettings]);

  const handleProviderChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as ProviderId;
    setViewProvider(newProvider);
    setRemoveError(null);

    if (settings?.keys[newProvider]?.hasKey) {
      try {
        await selectProvider({ provider: newProvider });
        await refreshSettings();
        toast.success(`Switched to ${PROVIDER_UI_CONFIG[newProvider].label}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to switch provider");
      }
    }
  };

  const handleSave = async (apiKey: string) => {
    await saveKey({ provider: viewProvider, apiKey });
    await refreshSettings();
    setIsOptingIn(false);
    toast.success(`${PROVIDER_UI_CONFIG[viewProvider].label} key saved`);
  };

  const handleRemove = async () => {
    setRemoving(true);
    setRemoveError(null);
    try {
      await removeKey({ provider: viewProvider });
      await refreshSettings();
      toast.success(`${PROVIDER_UI_CONFIG[viewProvider].label} key removed`);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Failed to remove key.");
    } finally {
      setRemoving(false);
    }
  };

  const isLoading = byokStatus === undefined || (byokStatus.hasKey && settings === null);
  const isGrandfathered = byokStatus !== undefined && !byokStatus.requiresBYOK;
  const currentKeyInfo = settings?.keys[viewProvider] ?? { hasKey: false as const };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isGrandfathered && !byokStatus.hasKey && !isOptingIn) {
    return (
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">Shared hosted AI</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;re using the shared hosted AI (grandfathered). You can switch to your own
                key any time.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsOptingIn(true)}>
            Add your own key
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="settings-provider-select" className="text-xs text-muted-foreground">
              AI Provider
            </Label>
            <select
              id="settings-provider-select"
              value={viewProvider}
              onChange={handleProviderChange}
              className={SELECT_CLASS}
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                  {settings?.keys[opt.id]?.hasKey ? " (key added)" : ""}
                </option>
              ))}
            </select>
          </div>

          {isGrandfathered && !byokStatus.hasKey && isOptingIn && (
            <Button variant="ghost" size="sm" onClick={() => setIsOptingIn(false)}>
              Cancel - use shared AI
            </Button>
          )}
        </CardContent>
      </Card>

      <ProviderKeyDisplay
        provider={viewProvider}
        keyInfo={currentKeyInfo}
        onSave={handleSave}
        onRemove={handleRemove}
        removing={removing}
        removeError={removeError}
      />

      <ModelOverrideSection
        provider={viewProvider}
        modelOverride={settings?.modelOverride ?? null}
        onSave={async (args) => {
          await setModelOverrideMut(args);
          await refreshSettings();
        }}
      />
    </div>
  );
}

function ModelOverrideSection({
  provider,
  modelOverride,
  onSave,
}: {
  readonly provider: ProviderId;
  readonly modelOverride: string | null;
  readonly onSave: (args: { modelOverride?: string }) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const defaultModel = PROVIDER_UI_CONFIG[provider].primaryModel;
  const [value, setValue] = useState(modelOverride ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(modelOverride ?? "");
  }, [modelOverride]);

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
              <p className="text-xs text-muted-foreground">
                Default: {defaultModel || "none (OpenRouter requires a model)"}
              </p>
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
