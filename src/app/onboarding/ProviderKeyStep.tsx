"use client";

import { useState } from "react";
import { useAction } from "convex/react";
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

  const handleSave = async (apiKey: string) => {
    const trimmedModelName = modelName.trim();
    await saveKey({
      provider,
      apiKey,
      ...(provider === "openrouter" && trimmedModelName ? { modelOverride: trimmedModelName } : {}),
    });
    onComplete();
  };

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
              Model name (optional)
            </Label>
            <Input
              id="model-name"
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. openrouter/auto or anthropic/claude-sonnet-4-6"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the quality-first default: <code>openrouter/auto</code>.
            </p>
          </div>
        )}

        <ApiKeyForm provider={provider} onSave={handleSave} />
      </CardContent>
    </Card>
  );
}
