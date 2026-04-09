"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAnalytics } from "@/lib/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

export function ChangePassword() {
  const { track } = useAnalytics();
  const [expanded, setExpanded] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const changePassword = useAction(api.account.changePassword);

  function resetForm() {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setStatus("idle");
    setErrorMessage("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setStatus("error");
      setErrorMessage("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setStatus("error");
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      await changePassword({ oldPassword, newPassword });
      track("password_changed");
      setStatus("success");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to change password.");
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            if (!expanded) resetForm();
          }}
          className="flex w-full items-center justify-between text-sm font-medium text-foreground transition-colors duration-200 hover:text-primary"
          aria-expanded={expanded}
        >
          Change Password
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="old-password" className="text-xs text-muted-foreground">
                Current password
              </Label>
              <Input
                id="old-password"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs text-muted-foreground">
                New password
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs text-muted-foreground">
                Confirm new password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            {status === "error" && (
              <p className="text-sm text-destructive" role="alert">
                {errorMessage}
              </p>
            )}

            {status === "success" && (
              <p className="text-sm text-green-500" role="status">
                Password changed successfully.
              </p>
            )}

            <Button type="submit" size="sm" disabled={status === "loading"}>
              {status === "loading" && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Update Password
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
