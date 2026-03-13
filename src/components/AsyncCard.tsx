"use client";

import type { AsyncState } from "@/hooks/useActionData";
import { DashboardCardSkeleton } from "@/components/DashboardCardSkeleton";
import { DashboardCardError } from "@/components/DashboardCardError";

export function AsyncCard<T>({
  state,
  refetch,
  title,
  tall,
  children,
}: {
  state: AsyncState<T>;
  refetch: () => void;
  title: string;
  tall?: boolean;
  children: (data: T) => React.ReactNode;
}) {
  if (state.status === "loading") return <DashboardCardSkeleton tall={tall} />;
  if (state.status === "error") return <DashboardCardError title={title} onRetry={refetch} />;
  return <>{children(state.data)}</>;
}
