"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import type { OperationsRentalsFilter } from "./use-operations-rentals.types";

export function useOperationsRentals(filter: OperationsRentalsFilter) {
  const actor = useAuthStore((state) => state.session?.user);
  const query = useQuery({
    queryKey: [
      "reports",
      "rentals",
      actor?.id,
      actor?.role,
      actor?.assignedFacilityId,
      {
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
        status: filter.status === "all" ? undefined : filter.status,
        limit: filter.limit,
        offset: filter.offset,
      },
    ],
    queryFn: () =>
      api.reports.getRentals({
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
        status: filter.status === "all" ? undefined : filter.status,
        limit: filter.limit,
        offset: filter.offset,
      }),
    staleTime: 60_000,
  });

  return query;
}
