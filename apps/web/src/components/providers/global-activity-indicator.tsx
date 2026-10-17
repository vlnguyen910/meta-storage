"use client";

import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

export function GlobalActivityIndicator() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  if (fetching + mutating === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-4 right-4 z-[200] flex items-center gap-2 rounded-full border border-primary/15 bg-white px-3 py-2 text-sm font-semibold text-primary shadow-card"
      role="status"
      aria-label="Đang xử lý"
    >
      <LoaderCircle className="size-4 animate-spin" />
      <span>Đang xử lý…</span>
    </div>
  );
}
