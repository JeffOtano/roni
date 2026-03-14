"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error" }
  | { status: "refreshing"; data: T };

const REFRESH_MS = 5 * 60 * 1000;
export function useActionData<T>(actionFn: (...args: [Record<string, never>]) => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const tsRef = useRef<number | null>(null);
  const stamp = useCallback(() => {
    const now = Date.now();
    tsRef.current = now;
    setLastUpdatedAt(now);
  }, []);
  useEffect(() => {
    let cancelled = false;
    actionFn({}).then(
      (data) => {
        if (!cancelled) {
          setState({ status: "success", data });
          stamp();
        }
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [actionFn, stamp]);
  const refetch = useCallback(() => {
    setState((prev) =>
      prev.status === "success" || prev.status === "refreshing"
        ? { status: "refreshing", data: prev.data }
        : { status: "loading" },
    );
    actionFn({}).then(
      (data) => {
        setState({ status: "success", data });
        stamp();
      },
      () =>
        setState((prev) => {
          if (prev.status === "refreshing") return { status: "success", data: prev.data };
          return { status: "error" };
        }),
    );
  }, [actionFn, stamp]);
  // Pause refresh when tab hidden; refresh immediately on return if stale
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(id);
      id = setInterval(refetch, REFRESH_MS);
    };
    const onVis = () => {
      if (document.hidden) {
        clearInterval(id);
        return;
      }
      if (tsRef.current && Date.now() - tsRef.current > REFRESH_MS) refetch();
      start();
    };
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refetch]);
  return { state, refetch, lastUpdatedAt };
}
