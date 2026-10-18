"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface OperationsUtilizationFilter {
  facilityId?: string;
  unitTypeId?: string;
  limit?: number;
  offset?: number;
}

export function useOperationsUtilization(filter: OperationsUtilizationFilter) {
  const query = useQuery({
    queryKey: [
      "reports",
      "utilization",
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
