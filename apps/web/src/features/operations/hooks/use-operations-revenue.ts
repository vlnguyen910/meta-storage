"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface OperationsRevenueFilter {
  from: string;
  to: string;
  facilityId?: string;
  unitTypeId?: string;
  limit?: number;
  offset?: number;
}

export function useOperationsRevenue(filter: OperationsRevenueFilter) {
  const query = useQuery({
    queryKey: [
      "reports",
      "revenue",
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
