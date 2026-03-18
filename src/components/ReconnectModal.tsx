"use client";

import { type FormEvent, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ErrorAlert";

type ReconnectModalProps = {
  tonalEmail: string;
  open: boolean;
  onDismiss: () => void;
};

export function ReconnectModal({ tonalEmail, open, onDismiss }: ReconnectModalProps) {
  const connectTonal = useAction(api.tonal.connectPublic.connectTonal);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setPassword("");
    setError(null);
    setSubmitting(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState();
      onDismiss();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await connectTonal({ tonalEmail, tonalPassword: password });
      resetState();
      onDismiss();
    } catch {
      setError("Authentication failed. Please check your password and try again.");
      setSubmitting(false);
      passwordRef.current?.focus();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reconnect Tonal</DialogTitle>
          <DialogDescription>
            Your Tonal session has expired. Enter your password to reconnect.
          </DialogDescription>
        </DialogHeader>

        <form id="reconnect-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tonal Email</Label>
            <p className="text-sm font-medium text-foreground">{tonalEmail}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reconnect-password">Password</Label>
            <Input
              ref={passwordRef}
              id="reconnect-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your Tonal password"
              required
              autoComplete="off"
              disabled={submitting}
              aria-describedby={error ? "reconnect-error" : undefined}
            />
          </div>

          {error && (
            <div id="reconnect-error">
              <ErrorAlert message={error} />
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="submit" form="reconnect-form" disabled={submitting || !password}>
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Reconnecting...
              </span>
            ) : (
              "Reconnect"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
