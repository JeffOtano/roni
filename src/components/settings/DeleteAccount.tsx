"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { useAnalytics } from "@/lib/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

export function DeleteAccount() {
  const { track } = useAnalytics();
  const deleteAccount = useAction(api.account.deleteAccount);
  const { signOut } = useAuthActions();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const isConfirmed = confirmation === "DELETE";

  async function handleDelete() {
    setStatus("loading");
    setErrorMessage("");

    try {
      track("account_deleted");
      await deleteAccount({});
      await signOut();
      router.replace("/login");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete account.");
    }
  }

  return (
    <Card className="ring-destructive/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-4 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">Danger Zone</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
          </div>

          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) {
                setConfirmation("");
                setStatus("idle");
                setErrorMessage("");
              }
            }}
          >
            <DialogTrigger render={<Button variant="destructive" size="sm" className="gap-1.5" />}>
              <Trash2 className="size-3.5" />
              Delete Account
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  This will permanently delete your account, all training data, workout plans, and
                  check-in history. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="delete-confirmation" className="text-xs text-muted-foreground">
                  Type <span className="font-mono font-semibold text-destructive">DELETE</span> to
                  confirm
                </Label>
                <Input
                  id="delete-confirmation"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                  aria-describedby={status === "error" ? "delete-error" : undefined}
                />
              </div>

              {status === "error" && (
                <p id="delete-error" className="text-sm text-destructive" role="alert">
                  {errorMessage}
                </p>
              )}

              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={!isConfirmed || status === "loading"}
                >
                  {status === "loading" && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                  Confirm Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
