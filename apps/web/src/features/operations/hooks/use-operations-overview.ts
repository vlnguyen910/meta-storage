"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import type { OperationsOverviewFilter } from "./use-operations-overview.types";

export function useOperationsOverview(filter: OperationsOverviewFilter) {
  const actor = useAuthStore((state) => state.session?.user);
  const query = useQuery({
    queryKey: [
      "reports",
      "overview",
      actor?.id,
      actor?.role,
      actor?.assignedFacilityId,
      {
        from: filter.from,
        to: filter.to,
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
      },
    ],
    queryFn: () =>
      api.reports.getOverview({
        from: filter.from,
        to: filter.to,
        facilityId: filter.facilityId === "all" ? undefined : filter.facilityId,
        unitTypeId: filter.unitTypeId === "all" ? undefined : filter.unitTypeId,
      }),
    staleTime: 60_000,
  });

  return query;
}
