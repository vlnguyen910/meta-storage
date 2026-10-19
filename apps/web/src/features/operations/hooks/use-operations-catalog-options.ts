"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useOperationsCatalogOptions() {
  const facilitiesQuery = useQuery({
    queryKey: ["facilities", "active-options"],
    queryFn: () => api.facilities.listActive({ limit: 100 }),
    staleTime: 5 * 60_000,
  });

  const pricingQuery = useQuery({
    queryKey: ["pricing", "configuration"],
    queryFn: () => api.pricing.getConfiguration({ limit: 100 }),
    staleTime: 5 * 60_000,
  });

  return {
    facilities: facilitiesQuery.data ?? [],
    unitTypes: pricingQuery.data?.prices ?? [],
    isLoading: facilitiesQuery.isPending || pricingQuery.isPending,
  };
}
