"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GlobalLoadingContextValue } from "./global-loading.types";

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const [manualCount, setManualCount] = useState(0);
  const [navigationCount, setNavigationCount] = useState(0);
  const navigationStops = useRef(new Set<() => void>());
  const startNavigationLoading = useCallback(() => {
    let active = true;
    let timeout: number;
    const stop = () => {
      if (!active) return;
      active = false;
      window.clearTimeout(timeout);
      navigationStops.current.delete(stop);
      setNavigationCount((count) => Math.max(0, count - 1));
    };

    navigationStops.current.add(stop);
    setNavigationCount((count) => count + 1);
    timeout = window.setTimeout(stop, 10_000);
    return stop;
  }, []);
  const clearNavigationLoading = useCallback(() => {
    for (const stop of [...navigationStops.current]) stop();
  }, []);
  const runWithGlobalLoading = useCallback(async <T,>(operation: () => Promise<T>) => {
    setManualCount((count) => count + 1);
    try {
      return await operation();
    } finally {
      setManualCount((count) => Math.max(0, count - 1));
    }
  }, []);
  const value = useMemo(
    () => ({
      manualCount,
      navigationCount,
      clearNavigationLoading,
      runWithGlobalLoading,
      startNavigationLoading,
    }),
    [
      manualCount,
      navigationCount,
      clearNavigationLoading,
      runWithGlobalLoading,
      startNavigationLoading,
    ],
  );

  return <GlobalLoadingContext.Provider value={value}>{children}</GlobalLoadingContext.Provider>;
}

export function useGlobalLoading() {
  const context = useContext(GlobalLoadingContext);
  if (!context) throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  return context;
}
