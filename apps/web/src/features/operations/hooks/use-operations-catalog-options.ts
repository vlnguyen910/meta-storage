"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth-store";
import { loadActiveFacilities, loadPricingConfiguration } from "../operations.data";

export function useOperationsCatalogOptions() {
  const actor = useAuthStore((state) => state.session?.user);
  const facilitiesQuery = useQuery({
    queryKey: ["facilities", "active-options", actor?.id, actor?.role, actor?.assignedFacilityId],
    queryFn: loadActiveFacilities,
    staleTime: 5 * 60_000,
  });

  const pricingQuery = useQuery({
    queryKey: ["pricing", "configuration", actor?.id, actor?.role, actor?.assignedFacilityId],
    queryFn: loadPricingConfiguration,
    staleTime: 5 * 60_000,
  });

  return {
    facilities: facilitiesQuery.data ?? [],
    unitTypes: pricingQuery.data?.prices ?? [],
    isLoading: facilitiesQuery.isPending || pricingQuery.isPending,
  };
}
