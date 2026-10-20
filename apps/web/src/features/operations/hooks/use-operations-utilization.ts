"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import type { OperationsUtilizationFilter } from "./use-operations-utilization.types";

export function useOperationsUtilization(filter: OperationsUtilizationFilter) {
  const actor = useAuthStore((state) => state.session?.user);
  const query = useQuery({
    queryKey: [
      "reports",
      "utilization",
      actor?.id,
      actor?.role,
      actor?.assignedFacilityId,
      {
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
        limit: filter.limit,
        offset: filter.offset,
      },
    ],
    queryFn: () =>
      api.reports.getUtilization({
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
        limit: filter.limit,
        offset: filter.offset,
      }),
    staleTime: 60_000,
  });

  return query;
}
