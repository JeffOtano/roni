"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiKeyForm } from "@/features/byok/ApiKeyForm";
import { type ProviderId } from "../../../convex/ai/providers";

const PROVIDER_OPTIONS: { id: ProviderId; label: string }[] = [
  { id: "gemini", label: "Google Gemini" },
  { id: "claude", label: "Anthropic Claude" },
  { id: "openai", label: "OpenAI" },
  { id: "openrouter", label: "OpenRouter" },
];

export function ProviderKeyStep({ onComplete }: { readonly onComplete: () => void }) {
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [modelName, setModelName] = useState("");
  const saveKey = useAction(api.byok.saveProviderKey);
  const setModel = useMutation(api.byok.setModelOverride);

  const handleSave = async (apiKey: string) => {
    await saveKey({ provider, apiKey });
    if (provider === "openrouter" && modelName) {
      await setModel({ modelOverride: modelName });
    }
    onComplete();
  };

  const openrouterMissingModel = provider === "openrouter" && !modelName.trim();

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">One last step</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tonal Coach uses an AI model to design your workouts. Pick your preferred provider and
            enter your API key. Pricing varies by provider.
          </p>
        </div>

        <div className="mb-4 space-y-1.5">
          <Label htmlFor="provider-select" className="text-xs text-muted-foreground">
            AI Provider
          </Label>
          <select
            id="provider-select"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as ProviderId);
              setModelName("");
            }}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {provider === "openrouter" && (
          <div className="mb-4 space-y-1.5">
            <Label htmlFor="model-name" className="text-xs text-muted-foreground">
              Model name (required)
            </Label>
            <Input
              id="model-name"
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. anthropic/claude-sonnet-4-5 or openai/gpt-4o"
              autoComplete="off"
            />
          </div>
        )}

        <ApiKeyForm provider={provider} onSave={handleSave} disabled={openrouterMissingModel} />
      </CardContent>
    </Card>
  );
}
