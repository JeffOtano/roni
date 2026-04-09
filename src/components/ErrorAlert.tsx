"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription className="flex items-center justify-between gap-2">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="xs" onClick={onRetry}>
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
