"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useFlow3Identity } from "@/features/returns/use-flow3-identity";
import { api } from "@/lib/api";

export const rentalKeys = {
  all: ["rentals"] as const,
  mine: ["rentals", "mine"] as const,
  detail: (id: string) => ["rentals", "detail", id] as const,
};

export function useMyRentals(view: "current" | "history" = "current") {
  const identity = useFlow3Identity();
  return useInfiniteQuery({
    queryKey: [...rentalKeys.mine, view, identity],
    initialPageParam: undefined as { afterEndAt: string; afterId: string } | undefined,
    queryFn: ({ pageParam }) =>
      api.rentals.mine({ view, limit: 20, ...(pageParam ? pageParam : {}) }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useRental(id: string) {
  const identity = useFlow3Identity();
  return useQuery({
    queryKey: [...rentalKeys.detail(id), identity],
    queryFn: () => api.rentals.get(id),
  });
}
