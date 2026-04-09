import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message }: PageLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-7 animate-spin text-primary/60" />
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}
