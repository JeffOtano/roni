import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type FailureReason =
  | "byok_key_invalid"
  | "byok_quota_exceeded"
  | "byok_safety_blocked"
  | "byok_unknown_error"
  | "byok_key_missing"
  | "byok_model_missing"
  | "house_key_quota_exhausted";

interface FailureBannerProps {
  reason: FailureReason;
}

const MESSAGES: Record<FailureReason, string> = {
  byok_key_invalid: "Your API key isn't working anymore. Check that it's still valid.",
  byok_quota_exceeded: "Your AI provider quota or credits are exhausted. Check your billing.",
  byok_safety_blocked: "The AI provider declined to answer this one. Try rephrasing.",
  byok_unknown_error: "Something went wrong with the AI provider. Try again in a moment.",
  byok_key_missing: "You need to add an API key to use chat.",
  byok_model_missing: "The selected provider needs a model name before chat can start.",
  house_key_quota_exhausted:
    "You've used your 500 free AI messages this month. Add your own API key to keep going.",
};

const isInfoReason = (reason: FailureReason): boolean => reason === "house_key_quota_exhausted";

export function FailureBanner({ reason }: FailureBannerProps) {
  const variant = isInfoReason(reason) ? "default" : "destructive";
  const linkText = isInfoReason(reason) ? "Add your key" : "Fix it";

  return (
    <Alert
      variant={variant}
      className={
        variant === "destructive" ? "border-destructive bg-destructive/10 text-destructive" : ""
      }
    >
      <AlertTriangle aria-hidden="true" />
      <AlertDescription
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 ${variant === "destructive" ? "text-destructive" : ""}`}
      >
        <span>{MESSAGES[reason]}</span>
        <a
          href="/settings#gemini-key"
          className={`font-medium underline underline-offset-4 ${variant === "destructive" ? "text-destructive hover:text-destructive/80" : "text-primary hover:text-primary/80"}`}
        >
          {linkText}
        </a>
      </AlertDescription>
    </Alert>
  );
}
