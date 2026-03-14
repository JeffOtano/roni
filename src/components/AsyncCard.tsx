"use client";

import type { AsyncState } from "@/hooks/useActionData";
import { DashboardCardSkeleton } from "@/components/DashboardCardSkeleton";
import { DashboardCardError } from "@/components/DashboardCardError";
import { Loader2 } from "lucide-react";

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
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
  if (state.status === "loading") return <DashboardCardSkeleton tall={tall} />;
  if (state.status === "error") return <DashboardCardError title={title} onRetry={refetch} />;

  const isRefreshing = state.status === "refreshing";
  const data = state.data;

  return (
    <div className="relative">
      {isRefreshing && (
        <div className="absolute right-3 top-3 z-10">
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        </div>
      )}
      {children(data)}
      {lastUpdatedAt && (
        <p className="mt-1.5 px-1 text-[10px] text-muted-foreground/60">
          Updated {formatRelativeTime(lastUpdatedAt)}
        </p>
      )}
    </div>
  );
}
