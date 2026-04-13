"use client";

import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { ProviderId } from "../../../convex/ai/providers";
import type { ProviderSettings } from "../../../convex/byok";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ModelOverrideSection } from "./ModelOverrideSection";
import { ProviderKeyDisplay } from "./ProviderKeyDisplay";

// Keep in sync with PROVIDERS in convex/ai/providers.ts
// Client-side UI metadata only (no server-side createLanguageModel functions)
const PROVIDER_UI_CONFIG: Record<ProviderId, { label: string; primaryModel: string }> = {
  gemini: { label: "Google Gemini", primaryModel: "gemini-3-flash-preview" },
  claude: { label: "Anthropic Claude", primaryModel: "claude-sonnet-4-6" },
  openai: { label: "OpenAI", primaryModel: "gpt-5.4" },
  openrouter: { label: "OpenRouter", primaryModel: "openrouter/auto" },
};

const PROVIDER_OPTIONS: { id: ProviderId; label: string }[] = [
  { id: "gemini", label: "Google Gemini" },
  { id: "claude", label: "Anthropic Claude" },
  { id: "openai", label: "OpenAI" },
  { id: "openrouter", label: "OpenRouter" },
];

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const SETTINGS_LOAD_ERROR = "Failed to load provider settings. Try again.";

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
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [isOptingIn, setIsOptingIn] = useState(false);

  const refreshSettings = useCallback(async () => {
    try {
      const result = await getSettings({});
      if (result) {
        setSettings(result);
        setViewProvider(result.selectedProvider);
        setSettingsError(null);
      } else {
        setSettings(null);
        setSettingsError(byokStatus?.hasKey ? SETTINGS_LOAD_ERROR : null);
      }
      return result;
    } catch (err) {
      setSettings(null);
      setSettingsError(SETTINGS_LOAD_ERROR);
      throw err;
    }
  }, [byokStatus?.hasKey, getSettings]);

  useEffect(() => {
    if (byokStatus === undefined) return;
    let cancelled = false;
    setSettingsError(null);
    getSettings({})
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setSettings(result);
          setViewProvider(result.selectedProvider);
          setSettingsError(null);
        } else {
          setSettings(null);
          setSettingsError(byokStatus.hasKey ? SETTINGS_LOAD_ERROR : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSettings(null);
          setSettingsError(SETTINGS_LOAD_ERROR);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [byokStatus, getSettings]);

  const handleProviderChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    if (!Object.prototype.hasOwnProperty.call(PROVIDER_UI_CONFIG, e.target.value)) {
      toast.error("That provider option is unavailable right now.");
      return;
    }

    if (settings === null || !Object.prototype.hasOwnProperty.call(settings.keys, e.target.value)) {
      toast.error("That provider option is unavailable right now.");
      return;
    }

    const newProvider = e.target.value as ProviderId;
    setViewProvider(newProvider);
    setRemoveError(null);

    if (settings.keys[newProvider].hasKey) {
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

  const isLoading =
    byokStatus === undefined || (byokStatus.hasKey && settings === null && settingsError === null);
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

  if (settingsError && settings === null) {
    return (
      <Card>
        <CardContent className="space-y-4 p-4">
          <p className="text-sm text-destructive">{settingsError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refreshSettings().catch(() => undefined);
            }}
          >
            Retry
          </Button>
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

      {viewProvider === "openrouter" && (
        <ModelOverrideSection
          provider={viewProvider}
          modelOverride={settings?.modelOverride ?? null}
          onSave={async (args) => {
            await setModelOverrideMut(args);
            if (
              currentKeyInfo.hasKey &&
              args.modelOverride?.trim() &&
              settings?.selectedProvider !== "openrouter"
            ) {
              await selectProvider({ provider: "openrouter" });
            }
            await refreshSettings();
          }}
        />
      )}
    </div>
  );
}
