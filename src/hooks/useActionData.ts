"use client";

import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error" };

export function useActionData<T>(actionFn: (...args: [Record<string, never>]) => Promise<T>): {
  state: AsyncState<T>;
  refetch: () => void;
} {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    actionFn({}).then(
      (data) => {
        if (!cancelled) setState({ status: "success", data });
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
    setState({ status: "loading" });
    actionFn({}).then(
      (data) => setState({ status: "success", data }),
      () => setState({ status: "error" }),
    );
  }, [actionFn]);

  return { state, refetch };
}
