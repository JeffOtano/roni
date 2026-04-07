import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type FailureReason =
  | "byok_key_invalid"
  | "byok_quota_exceeded"
  | "byok_safety_blocked"
  | "byok_unknown_error"
  | "byok_key_missing";

interface FailureBannerProps {
  reason: FailureReason;
}

const MESSAGES: Record<FailureReason, string> = {
  byok_key_invalid: "Your Gemini API key isn't working anymore.",
  byok_quota_exceeded: "You've hit Gemini's free daily limit. It resets at midnight UTC.",
  byok_safety_blocked: "Gemini declined to answer this one. Try rephrasing.",
  byok_unknown_error: "Something went wrong with Gemini. Try again in a moment.",
  byok_key_missing: "You need to add your Gemini API key to use chat.",
};

export function FailureBanner({ reason }: FailureBannerProps) {
  return (
    <Alert variant="destructive" className="border-destructive bg-destructive/10 text-destructive">
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-destructive">
        <span>{MESSAGES[reason]}</span>
        <a
          href="/settings#gemini-key"
          className="font-medium text-destructive underline underline-offset-4 hover:text-destructive/80"
        >
          Fix it
        </a>
      </AlertDescription>
    </Alert>
  );
}
