"use client";

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { ApiKeyForm } from "@/components/byok/ApiKeyForm";

export function GeminiKeyStep({ onComplete }: { readonly onComplete: () => void }) {
  const saveKey = useMutation(api.byok.saveGeminiKey);

  const handleSave = async (apiKey: string) => {
    await saveKey({ apiKey });
    onComplete();
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">One last step</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tonal Coach uses your own Google Gemini key for AI. It&apos;s free for personal use, and
            means your conversations stay on your own Google account, not ours.
          </p>
        </div>
        <ApiKeyForm onSave={handleSave} />
      </CardContent>
    </Card>
  );
}
