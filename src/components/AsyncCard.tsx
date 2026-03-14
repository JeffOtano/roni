"use client";

import { useEffect, useState } from "react";
import type { AsyncState } from "@/hooks/useActionData";
import { DashboardCardSkeleton } from "@/components/DashboardCardSkeleton";
import { DashboardCardError } from "@/components/DashboardCardError";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

function formatRelativeTime(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

function useRelativeTime(ts: number | null | undefined): string | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!ts) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [ts]);
  return ts ? formatRelativeTime(ts) : null;
}

export function AsyncCard<T>({
  state,
  refetch,
  lastUpdatedAt,
  title,
  tall,
  children,
}: {
  state: AsyncState<T>;
  refetch: () => void;
  lastUpdatedAt?: number | null;
  title: string;
  tall?: boolean;
  children: (data: T) => React.ReactNode;
}) {
  const relativeTime = useRelativeTime(lastUpdatedAt);
  if (state.status === "loading") return <DashboardCardSkeleton tall={tall} />;
  if (state.status === "error") return <DashboardCardError title={title} onRetry={refetch} />;

  return (
    <Card className="animate-in fade-in duration-300">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {state.status === "refreshing" && (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className={tall ? "min-h-[220px]" : ""}>{children(state.data)}</CardContent>
      {relativeTime && (
        <CardFooter>
          <p className="text-[10px] text-muted-foreground/60">Updated {relativeTime}</p>
        </CardFooter>
      )}
    </Card>
  );
}
