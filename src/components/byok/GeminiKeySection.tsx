"use client";

import { useCallback, useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiKeyForm } from "@/components/byok/ApiKeyForm";

type KeyStatus = { hasKey: false } | { hasKey: true; maskedLast4: string; addedAt: number };

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatAddedAt(timestamp: number): string {
  if (!timestamp) return "recently";
  return DATE_FORMATTER.format(new Date(timestamp));
}

export function GeminiKeySection() {
  const byokStatus = useQuery(api.byok.getBYOKStatus, {});
  const getKeyStatus = useAction(api.byok.getGeminiKeyStatus);
  const saveKey = useMutation(api.byok.saveGeminiKey);
  const removeKey = useMutation(api.byok.removeGeminiKey);

  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isOptingIn, setIsOptingIn] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const refreshKeyStatus = useCallback(async () => {
    const result = await getKeyStatus({});
    setKeyStatus(result);
    return result;
  }, [getKeyStatus]);

  // Fetch masked status when we know the user has a key. We re-run whenever
  // byokStatus.hasKey flips so save/remove mutations get reflected in the UI.
  useEffect(() => {
    if (byokStatus === undefined) return;

    let cancelled = false;

    if (!byokStatus.hasKey) {
      setKeyStatus({ hasKey: false });
      return;
    }

    getKeyStatus({})
      .then((result) => {
        if (!cancelled) setKeyStatus(result);
      })
      .catch(() => {
        if (!cancelled) setKeyStatus({ hasKey: false });
      });

    return () => {
      cancelled = true;
    };
  }, [byokStatus, getKeyStatus]);

  const handleSave = async (apiKey: string) => {
    await saveKey({ apiKey });
    await refreshKeyStatus();
    setIsReplacing(false);
    setIsOptingIn(false);
    toast.success("Gemini key saved");
  };

  const handleRemove = async () => {
    setRemoving(true);
    setRemoveError(null);
    try {
      await removeKey({});
      await refreshKeyStatus();
      toast.success("Gemini key removed");
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Failed to remove key.");
    } finally {
      setRemoving(false);
    }
  };

  const isLoading = byokStatus === undefined || (byokStatus.hasKey && keyStatus === null);

  return (
    <div id="gemini-key" className="scroll-mt-20">
      {isLoading ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading...
            </div>
          </CardContent>
        </Card>
      ) : keyStatus?.hasKey ? (
        <HasKeyState
          maskedLast4={keyStatus.maskedLast4}
          addedAt={keyStatus.addedAt}
          isReplacing={isReplacing}
          onStartReplace={() => setIsReplacing(true)}
          onCancelReplace={() => setIsReplacing(false)}
          onSave={handleSave}
          onRemove={handleRemove}
          removing={removing}
          removeError={removeError}
        />
      ) : byokStatus?.requiresBYOK ? (
        <MissingKeyState onSave={handleSave} />
      ) : (
        <GrandfatheredNoKeyState
          isOptingIn={isOptingIn}
          onStartOptIn={() => setIsOptingIn(true)}
          onCancelOptIn={() => setIsOptingIn(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function HasKeyState({
  maskedLast4,
  addedAt,
  isReplacing,
  onStartReplace,
  onCancelReplace,
  onSave,
  onRemove,
  removing,
  removeError,
}: {
  readonly maskedLast4: string;
  readonly addedAt: number;
  readonly isReplacing: boolean;
  readonly onStartReplace: () => void;
  readonly onCancelReplace: () => void;
  readonly onSave: (apiKey: string) => Promise<void>;
  readonly onRemove: () => Promise<void>;
  readonly removing: boolean;
  readonly removeError: string | null;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Using your own Gemini key ending in{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {maskedLast4}
                </code>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Added {formatAddedAt(addedAt)}</p>
            </div>
          </div>
        </div>

        {removeError && (
          <p role="alert" className="text-sm text-destructive">
            {removeError}
          </p>
        )}

        {isReplacing ? (
          <div className="space-y-3 border-t border-border pt-4">
            <ApiKeyForm onSave={onSave} />
            <Button variant="ghost" size="sm" onClick={onCancelReplace}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onStartReplace} disabled={removing}>
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

function MissingKeyState({ onSave }: { readonly onSave: (apiKey: string) => Promise<void> }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          You need to add your Gemini API key to use chat.
        </p>
        <ApiKeyForm onSave={onSave} />
      </CardContent>
    </Card>
  );
}

function GrandfatheredNoKeyState({
  isOptingIn,
  onStartOptIn,
  onCancelOptIn,
  onSave,
}: {
  readonly isOptingIn: boolean;
  readonly onStartOptIn: () => void;
  readonly onCancelOptIn: () => void;
  readonly onSave: (apiKey: string) => Promise<void>;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">Shared hosted AI</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;re using the shared hosted AI (grandfathered). You can switch to your own key
              any time.
            </p>
          </div>
        </div>

        {isOptingIn ? (
          <div className="space-y-3 border-t border-border pt-4">
            <ApiKeyForm onSave={onSave} />
            <Button variant="ghost" size="sm" onClick={onCancelOptIn}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={onStartOptIn}>
            Add your own key
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
