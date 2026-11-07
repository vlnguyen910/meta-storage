"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import type { OperationsRevenueFilter } from "./use-operations-revenue.types";

export function useOperationsRevenue(filter: OperationsRevenueFilter) {
  const actor = useAuthStore((state) => state.session?.user);
  const query = useQuery({
    queryKey: [
      "reports",
      "revenue",
      actor?.id,
      actor?.role,
      actor?.assignedFacilityId,
      {
        from: filter.from,
        to: filter.to,
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
        limit: filter.limit,
        offset: filter.offset,
      },
    ],
    queryFn: () =>
      api.reports.getRevenue({
        from: filter.from,
        to: filter.to,
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
        limit: filter.limit,
        offset: filter.offset,
      }),
    staleTime: 60_000,
  });

  return query;
}
