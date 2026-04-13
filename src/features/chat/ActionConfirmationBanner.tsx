import { Check, CircleAlert } from "lucide-react";

interface ActionConfirmationBannerProps {
  variant: "success" | "error";
  message: string;
}

export function ActionConfirmationBanner({ variant, message }: ActionConfirmationBannerProps) {
  const isSuccess = variant === "success";

  return (
    <div
      role="status"
      className={`my-2 flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 ${
        isSuccess
          ? "border-green-900/30 bg-gradient-to-br from-green-500/[0.08] to-green-500/[0.02]"
          : "border-red-900/30 bg-gradient-to-br from-red-500/[0.08] to-red-500/[0.02]"
      }`}
    >
      <div
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
          isSuccess ? "bg-green-500/15" : "bg-red-500/15"
        }`}
      >
        {isSuccess ? (
          <Check data-testid="banner-icon-success" className="size-3.5 text-green-500" />
        ) : (
          <CircleAlert data-testid="banner-icon-error" className="size-3.5 text-red-500" />
        )}
      </div>
      <span className="text-sm font-semibold text-foreground">{message}</span>
    </div>
  );
}
