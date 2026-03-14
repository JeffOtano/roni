"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error" }
  | { status: "refreshing"; data: T };

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export function useActionData<T>(actionFn: (...args: [Record<string, never>]) => Promise<T>): {
  state: AsyncState<T>;
  refetch: () => void;
  lastUpdatedAt: number | null;
} {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    let cancelled = false;
    actionFn({}).then(
      (data) => {
        if (!cancelled) {
          setState({ status: "success", data });
          setLastUpdatedAt(Date.now());
        }
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [actionFn]);

  const refetch = useCallback(() => {
    setState((prev) => {
      if (prev.status === "success" || prev.status === "refreshing") {
        return { status: "refreshing", data: prev.data };
      }
      return { status: "loading" };
    });
    actionFn({}).then(
      (data) => {
        setState({ status: "success", data });
        setLastUpdatedAt(Date.now());
      },
      () =>
        setState((prev) => {
          // On refresh failure, keep showing old data if we had it
          if (prev.status === "refreshing") {
            return { status: "success", data: prev.data };
          }
          return { status: "error" };
        }),
    );
  }, [actionFn]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    intervalRef.current = setInterval(refetch, AUTO_REFRESH_MS);
    return () => clearInterval(intervalRef.current);
  }, [refetch]);

  return { state, refetch, lastUpdatedAt };
}
