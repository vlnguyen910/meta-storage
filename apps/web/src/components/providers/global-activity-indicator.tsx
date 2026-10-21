"use client";

import { useIsMutating } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LOADING_MESSAGES } from "@/components/ui/loading.messages";
import { FullScreenLoading } from "@/components/ui/states";
import { useGlobalLoading } from "./global-loading-provider";

export function GlobalActivityIndicator() {
  const pathname = usePathname();
  const mutating = useIsMutating({
    predicate: (mutation) => mutation.options.meta?.globalLoading === true,
  });
  const { manualCount, navigationCount, clearNavigationLoading, startNavigationLoading } =
    useGlobalLoading();
  const stopNavigationRef = useRef<(() => void) | null>(null);
  const previousPathnameRef = useRef(pathname);
  const isProcessing = mutating + manualCount > 0;
  const active = isProcessing || navigationCount > 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return;
    previousPathnameRef.current = pathname;
    clearNavigationLoading();
  }, [clearNavigationLoading, pathname]);

  useEffect(() => {
    function onInternalNavigation(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")
      )
        return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === pathname)
        return;

      stopNavigationRef.current?.();
      const stop = startNavigationLoading();
      stopNavigationRef.current = () => {
        stop();
        stopNavigationRef.current = null;
      };
    }

    document.addEventListener("click", onInternalNavigation, true);
    return () => {
      document.removeEventListener("click", onInternalNavigation, true);
      stopNavigationRef.current?.();
      stopNavigationRef.current = null;
    };
  }, [pathname, startNavigationLoading]);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    const timeout = window.setTimeout(() => setVisible(true), 150);
    return () => window.clearTimeout(timeout);
  }, [active]);

  if (!visible) return null;

  return (
    <FullScreenLoading label={isProcessing ? LOADING_MESSAGES.processing : LOADING_MESSAGES.page} />
  );
}
