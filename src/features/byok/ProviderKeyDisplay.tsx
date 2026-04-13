"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiKeyForm } from "./ApiKeyForm";
import type { ProviderId } from "../../../convex/ai/providers";

// Keep in sync with PROVIDERS in convex/ai/providers.ts
// Client-side UI metadata only (no server-side createLanguageModel functions)
const PROVIDER_UI_CONFIG: Record<ProviderId, { label: string }> = {
  gemini: { label: "Google Gemini" },
  claude: { label: "Anthropic Claude" },
  openai: { label: "OpenAI" },
  openrouter: { label: "OpenRouter" },
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatAddedAt(timestamp: number): string {
  if (!timestamp) return "recently";
  return DATE_FORMATTER.format(new Date(timestamp));
}

type KeyInfo = { hasKey: false } | { hasKey: true; maskedLast4: string; addedAt: number };

export function ProviderKeyDisplay({
  provider,
  keyInfo,
  onSave,
  onRemove,
  removing,
  removeError,
}: {
  readonly provider: ProviderId;
  readonly keyInfo: KeyInfo;
  readonly onSave: (apiKey: string) => Promise<void>;
  readonly onRemove: () => Promise<void>;
  readonly removing: boolean;
  readonly removeError: string | null;
}) {
  const [isReplacing, setIsReplacing] = useState(false);
  const config = PROVIDER_UI_CONFIG[provider];

  const handleSave = async (apiKey: string) => {
    await onSave(apiKey);
    setIsReplacing(false);
  };

  if (!keyInfo.hasKey) {
    return (
      <Card>
        <CardContent className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            Add your {config.label} API key to use this provider.
          </p>
          <ApiKeyForm provider={provider} onSave={onSave} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 size-4 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {config.label} key ending in{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                {keyInfo.maskedLast4}
              </code>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Added {formatAddedAt(keyInfo.addedAt)}
            </p>
          </div>
        </div>

        {removeError && (
          <p role="alert" className="text-sm text-destructive">
            {removeError}
          </p>
        )}

        {isReplacing ? (
          <div className="space-y-3 border-t border-border pt-4">
            <ApiKeyForm provider={provider} onSave={handleSave} />
            <Button variant="ghost" size="sm" onClick={() => setIsReplacing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReplacing(true)}
              disabled={removing}
            >
              Replace key
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={removing}
              className="text-muted-foreground hover:text-destructive"
            >
              {removing && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Remove key
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
