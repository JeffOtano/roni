"use client";

import { type FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GEMINI_KEY_REGEX = /^AIza[A-Za-z0-9_-]{35}$/;
const FORMAT_ERROR =
  "Key format looks wrong. Gemini keys start with 'AIza' and are 39 characters long.";

interface ApiKeyFormProps {
  onSave: (apiKey: string) => Promise<void> | void;
  initialValue?: string;
}

export function ApiKeyForm({ onSave, initialValue = "" }: ApiKeyFormProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const trimmed = value.replace(/\s+/g, "");

    if (!GEMINI_KEY_REGEX.test(trimmed)) {
      setError(FORMAT_ERROR);
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
        <h2 className="text-lg font-semibold text-foreground">Gemini API Key</h2>
        <p className="text-sm text-muted-foreground">
          Tonal Coach uses Google&apos;s Gemini AI to design your workouts. Gemini is free for
          personal use, and using your own key means your conversations stay on your own Google
          account, not ours. Getting a key takes about 60 seconds.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gemini-api-key" className="text-xs text-muted-foreground">
          API key
        </Label>
        <Input
          id="gemini-api-key"
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="AIza..."
          aria-invalid={error !== null}
          aria-describedby={error ? "gemini-api-key-error" : undefined}
          disabled={saving}
        />
      </div>

      {error && (
        <p id="gemini-api-key-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          Save key
        </Button>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Get a key from Google AI Studio
        </a>
      </div>
    </form>
  );
}
