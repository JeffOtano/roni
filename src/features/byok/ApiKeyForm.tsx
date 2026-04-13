"use client";

import { type FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProviderId } from "../../../convex/ai/providers";

// Keep in sync with PROVIDERS in convex/ai/providers.ts
// Client-side UI metadata only (no server-side createLanguageModel functions)
const PROVIDER_UI_CONFIG: Record<
  ProviderId,
  {
    label: string;
    keyRegex: RegExp;
    keyFormatError: string;
    keySourceUrl: string;
    keyPlaceholder: string;
  }
> = {
  gemini: {
    label: "Google Gemini",
    keyRegex: /^AIza[A-Za-z0-9_-]{35}$/,
    keyFormatError:
      "Key format looks wrong. Gemini keys start with 'AIza' and are 39 characters long.",
    keySourceUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza...",
  },
  claude: {
    label: "Anthropic Claude",
    keyRegex: /^sk-ant-/,
    keyFormatError: "Key format looks wrong. Claude keys start with 'sk-ant-'.",
    keySourceUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-...",
  },
  openai: {
    label: "OpenAI",
    keyRegex: /^sk-(?!ant-)(?!or-)/,
    keyFormatError:
      "Key format looks wrong. OpenAI keys start with 'sk-' (but not 'sk-ant-' or 'sk-or-').",
    keySourceUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
  },
  openrouter: {
    label: "OpenRouter",
    keyRegex: /^sk-or-/,
    keyFormatError: "Key format looks wrong. OpenRouter keys start with 'sk-or-'.",
    keySourceUrl: "https://openrouter.ai/keys",
    keyPlaceholder: "sk-or-...",
  },
};

interface ApiKeyFormProps {
  provider: ProviderId;
  onSave: (apiKey: string) => Promise<void> | void;
  initialValue?: string;
  disabled?: boolean;
}

export function ApiKeyForm({ provider, onSave, initialValue = "", disabled }: ApiKeyFormProps) {
  const config = PROVIDER_UI_CONFIG[provider];
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const inputId = `${provider}-api-key`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const trimmed = value.replace(/\s+/g, "");

    if (!config.keyRegex.test(trimmed)) {
      setError(config.keyFormatError);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await onSave(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{config.label} API Key</h2>
        <p className="text-sm text-muted-foreground">
          Using your own key means your conversations stay on your own account, not ours. Getting a
          key takes about 60 seconds.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={inputId} className="text-xs text-muted-foreground">
          API key
        </Label>
        <Input
          id={inputId}
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={config.keyPlaceholder}
          aria-invalid={error !== null}
          aria-describedby={error ? `${inputId}-error` : undefined}
          disabled={saving}
        />
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" size="sm" disabled={saving || disabled}>
          {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          Save key
        </Button>
        <a
          href={config.keySourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Get a key from {config.label}
        </a>
      </div>
    </form>
  );
}
