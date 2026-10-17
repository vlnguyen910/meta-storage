"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const rentalKeys = {
  all: ["rentals"] as const,
  mine: ["rentals", "mine"] as const,
  detail: (id: string) => ["rentals", "detail", id] as const,
};

export function useMyRentals() {
  return useQuery({ queryKey: rentalKeys.mine, queryFn: api.rentals.mine });
}

export function useRental(id: string) {
  return useQuery({ queryKey: rentalKeys.detail(id), queryFn: () => api.rentals.get(id) });
}
