"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";

export const rentalKeys = {
  all: ["rentals"] as const,
  mine: ["rentals", "mine"] as const,
  detail: (id: string) => ["rentals", "detail", id] as const,
};

export function useMyRentals(view: "current" | "history" = "current", enabled = true) {
  const identity = useFlow3Identity();
  return useInfiniteQuery({
    queryKey: [...rentalKeys.mine, view, identity],
    initialPageParam: undefined as { afterEndAt: string; afterId: string } | undefined,
    queryFn: ({ pageParam }) =>
      api.rentals.mine({ view, limit: 20, ...(pageParam ? pageParam : {}) }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}

async function loadRentals(view: "current" | "history") {
  const items = [];
  let cursor: { afterEndAt: string; afterId: string } | undefined;
  do {
    const page = await api.rentals.mine({ view, limit: 100, ...(cursor ?? {}) });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

export function useAllMyRentals(enabled = true) {
  const identity = useFlow3Identity();
  return useQuery({
    queryKey: [...rentalKeys.mine, "all", identity],
    queryFn: async () => {
      const [current, history] = await Promise.all([
        loadRentals("current"),
        loadRentals("history"),
      ]);
      return [...current, ...history].sort(
        (a, b) => Date.parse(b.endAt) - Date.parse(a.endAt) || b.id.localeCompare(a.id),
      );
    },
    enabled,
  });
}

export function useRental(id: string) {
  const identity = useFlow3Identity();
  return useQuery({
    queryKey: [...rentalKeys.detail(id), identity],
    queryFn: () => api.rentals.get(id),
  });
}
