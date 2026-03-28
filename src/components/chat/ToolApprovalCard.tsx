"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/lib/analytics";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

const TOOL_LABELS: Record<string, string> = {
  approve_week_plan: "Push workouts to your Tonal",
  create_workout: "Create workout on Tonal",
  delete_workout: "Delete workout from Tonal",
  delete_week_plan: "Delete current week plan",
};

interface ToolApprovalCardProps {
  toolName: string;
  input?: unknown;
  approvalId: string;
  threadId: string;
}

export function ToolApprovalCard({ toolName, approvalId, threadId }: ToolApprovalCardProps) {
  const [status, setStatus] = useState<"pending" | "approving" | "denying" | "done">("pending");
  const respond = useMutation(api.chat.respondToToolApproval);
  const continueAgent = useAction(api.chat.continueAfterApproval);
  const { track } = useAnalytics();
  const shownTimeRef = useRef(Date.now());

  useEffect(() => {
    track("tool_approval_shown", { tool_name: toolName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = TOOL_LABELS[toolName] ?? toolName;

  const handleResponse = async (approved: boolean) => {
    setStatus(approved ? "approving" : "denying");
    try {
      const { messageId } = await respond({ threadId, approvalId, approved });
      await continueAgent({ threadId, messageId });
      if (approved) {
        track("tool_approved", {
          tool_name: toolName,
          response_time_ms: Date.now() - shownTimeRef.current,
        });
      } else {
        track("tool_denied", { tool_name: toolName });
      }
      setStatus("done");
      toast.success(approved ? "Action approved" : "Action denied");
    } catch (err) {
      console.error("Approval failed:", err);
      setStatus("pending");
    }
  };

  if (status === "done") return null;

  return (
    <div className="my-2 rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => handleResponse(true)}
          disabled={status !== "pending"}
          className="gap-1.5"
        >
          {status === "approving" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleResponse(false)}
          disabled={status !== "pending"}
          className="gap-1.5"
        >
          {status === "denying" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <X className="size-3.5" />
          )}
          Deny
        </Button>
      </div>
    </div>
  );
}
